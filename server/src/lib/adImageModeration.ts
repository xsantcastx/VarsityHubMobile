import { Prisma } from '@prisma/client';
import { DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { promises as dns } from 'node:dns';
import net from 'node:net';
import { prisma } from './prisma.js';
import { env } from './env.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;

/**
 * SSRF guard for fetchImageBytes. The banner URL comes from user-submitted
 * ad payload (`z.string().url()` only checks shape, not destination). Without
 * this, an attacker submitting an ad with banner_url=http://localhost:6379
 * or banner_url=http://postgres-tngr.railway.internal:5432 would trigger a
 * server-side fetch from inside Railway's network — usable for internal
 * port scanning, service probing, or DNS-oracle exfiltration.
 *
 * The check enforces:
 *   - http: or https: scheme only (no file:, gopher:, dict:, etc.)
 *   - Hostname must resolve to a public unicast IP
 *   - Rejects RFC 1918 private ranges, loopback, link-local, IPv6 equivalents
 *   - Rejects literal localhost / *.local / *.internal hostnames before DNS
 *   - DNS rebinding mitigation: pin to first-resolved IP and pass that as
 *     the connection target (currently relies on the URL's host; full
 *     pinning would require a custom dispatcher — left as backlog if the
 *     moderation feature ships at scale)
 */
export async function assertSafeFetchTarget(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Banner URL is not a valid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Banner URL scheme not allowed: ${parsed.protocol}`);
  }

  // URL.hostname returns IPv6 literals wrapped in brackets ("[::1]"); strip
  // them so net.isIP and DNS lookup see a usable address. Hostname is also
  // lowercased here so suffix matches and DNS lookups are case-stable.
  const hostnameRaw = parsed.hostname.toLowerCase();
  const hostname =
    hostnameRaw.startsWith('[') && hostnameRaw.endsWith(']')
      ? hostnameRaw.slice(1, -1)
      : hostnameRaw;

  // Reject obvious local hostnames before DNS resolution. Catches the
  // common case (localhost, *.localhost, *.internal, *.local mDNS) plus
  // Railway's internal hostname pattern (*.railway.internal).
  const blockedHostSuffixes = ['.local', '.internal', '.localhost'];
  const blockedHostNames = ['localhost', 'ip6-localhost', 'ip6-loopback'];
  if (blockedHostNames.includes(hostname)) {
    throw new Error(`Banner URL host not allowed: ${hostname}`);
  }
  if (blockedHostSuffixes.some(suffix => hostname.endsWith(suffix))) {
    throw new Error(`Banner URL host not allowed: ${hostname}`);
  }

  // Resolve and validate every IP the host points at. If ANY of them is in
  // a blocked range we refuse the request (DNS round-robin must not bypass
  // the gate by serving a public IP first and a private IP on the second
  // resolution).
  let addresses: string[];
  if (net.isIP(hostname)) {
    addresses = [hostname];
  } else {
    try {
      const records = await dns.lookup(hostname, { all: true });
      addresses = records.map(r => r.address);
    } catch {
      throw new Error(`Banner URL host could not be resolved: ${hostname}`);
    }
  }

  for (const addr of addresses) {
    if (isBlockedAddress(addr)) {
      throw new Error(`Banner URL resolves to blocked address: ${addr}`);
    }
  }
}

function isBlockedAddress(addr: string): boolean {
  if (net.isIPv4(addr)) {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => Number.isNaN(p))) return true;
    const [a, b] = parts;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 loopback
    if (a === 127) return true;
    // 169.254.0.0/16 link-local + AWS/GCP metadata (169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 "this network"
    if (a === 0) return true;
    // 100.64.0.0/10 carrier-grade NAT (Railway's edge proxy)
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(addr)) {
    const lower = addr.toLowerCase();
    // ::1 loopback
    if (lower === '::1') return true;
    // v4-mapped IPv6 (::ffff:a.b.c.d / ::ffff:WXYZ:WXYZ) — refused
    // unconditionally. Node normalizes the dotted-decimal form to hex
    // (::ffff:7f00:1) so a precise dotted-decimal parse is fragile;
    // there is no legitimate reason to fetch banner images via a
    // v4-mapped IPv6 literal, so block the whole prefix.
    if (lower.startsWith('::ffff:')) return true;
    // fc00::/7 unique local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // fe80::/10 link-local
    if (
      lower.startsWith('fe8') ||
      lower.startsWith('fe9') ||
      lower.startsWith('fea') ||
      lower.startsWith('feb')
    )
      return true;
    return false;
  }
  // Anything else (malformed, etc.) — refuse
  return true;
}
const DEFAULT_MIN_CONFIDENCE = 75;
const PROVIDER = 'aws_rekognition';

type BannerModerationLabel = {
  name: string;
  parent_name: string | null;
  confidence: number;
};

type StoredBannerModeration = {
  banner_moderation_status: 'clean' | 'flagged' | 'error';
  banner_moderation_labels: Prisma.InputJsonValue | typeof Prisma.DbNull;
  banner_moderation_score: number | null;
  banner_moderation_provider: string;
  banner_moderation_error: string | null;
  banner_moderated_at: Date;
};

let client: RekognitionClient | null = null;

function isEnabled() {
  const raw = env.AD_IMAGE_MODERATION_ENABLED?.toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function getMinConfidence() {
  const parsed = Number(env.AD_IMAGE_MODERATION_MIN_CONFIDENCE || DEFAULT_MIN_CONFIDENCE);
  if (!Number.isFinite(parsed)) return DEFAULT_MIN_CONFIDENCE;
  return Math.max(1, Math.min(parsed, 100));
}

function getRegion() {
  return env.REKOGNITION_REGION || process.env.AWS_REGION || undefined;
}

function getClient() {
  if (client) return client;
  const region = getRegion();
  if (!region) {
    throw new Error(
      'REKOGNITION_REGION or AWS_REGION is required when ad image moderation is enabled'
    );
  }
  client = new RekognitionClient({ region });
  return client;
}

async function fetchImageBytes(url: string) {
  await assertSafeFetchTarget(url);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) {
    throw new Error(`Banner fetch failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType && !contentType.toLowerCase().startsWith('image/')) {
    throw new Error('Banner URL did not return an image');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error(`Banner image exceeds ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`Banner image exceeds ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  return new Uint8Array(buffer);
}

export function clearBannerModerationFields() {
  return {
    banner_moderation_status: null,
    banner_moderation_labels: Prisma.DbNull,
    banner_moderation_score: null,
    banner_moderation_provider: null,
    banner_moderation_error: null,
    banner_moderated_at: null,
  };
}

export async function moderateBannerUrl(url: string): Promise<StoredBannerModeration | null> {
  if (!isEnabled()) return null;

  try {
    const bytes = await fetchImageBytes(url);
    const response = await getClient().send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: bytes },
        MinConfidence: getMinConfidence(),
      })
    );

    const labels: BannerModerationLabel[] = (response.ModerationLabels || []).map(label => ({
      name: label.Name || 'Unknown',
      parent_name: label.ParentName || null,
      confidence: Number((label.Confidence || 0).toFixed(2)),
    }));

    const maxConfidence = labels.reduce<number>(
      (highest, label) => Math.max(highest, label.confidence),
      0
    );

    return {
      banner_moderation_status: labels.length > 0 ? 'flagged' : 'clean',
      banner_moderation_labels:
        labels.length > 0 ? (labels as Prisma.InputJsonValue) : Prisma.DbNull,
      banner_moderation_score: labels.length > 0 ? maxConfidence : null,
      banner_moderation_provider: PROVIDER,
      banner_moderation_error: null,
      banner_moderated_at: new Date(),
    };
  } catch (error) {
    return {
      banner_moderation_status: 'error',
      banner_moderation_labels: Prisma.DbNull,
      banner_moderation_score: null,
      banner_moderation_provider: PROVIDER,
      banner_moderation_error:
        error instanceof Error ? error.message.slice(0, 500) : 'Unknown moderation error',
      banner_moderated_at: new Date(),
    };
  }
}

export async function moderateAndStoreAdBanner(adId: string, bannerUrl?: string | null) {
  if (!bannerUrl) {
    return prisma.ad.update({
      where: { id: adId },
      data: clearBannerModerationFields(),
    });
  }

  const moderation = await moderateBannerUrl(bannerUrl);
  if (!moderation) {
    return prisma.ad.findUnique({ where: { id: adId } });
  }

  return prisma.ad.update({
    where: { id: adId },
    data: moderation,
  });
}
