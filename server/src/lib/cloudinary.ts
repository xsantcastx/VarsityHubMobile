import crypto from 'node:crypto';
import { runWithBreaker } from './circuitBreaker.js';

// Placeholder values from .env.example — treat as "not configured" so local dev fails fast
// instead of silently failing uploads. Use real Cloudinary credentials in server/.env
const CLOUDINARY_PLACEHOLDERS = {
  cloudName: ['your-cloud-name', ''],
  apiKey: ['your-api-key', '123456789012345', ''],
  apiSecret: ['your-api-secret', 'your-cloudinary-secret', 'abcdefghijklmnopqrstuvwxyz', ''],
};

function isPlaceholder(
  value: string | undefined,
  key: keyof typeof CLOUDINARY_PLACEHOLDERS
): boolean {
  if (!value) return true;
  return CLOUDINARY_PLACEHOLDERS[key].some(p => p && value.trim() === p);
}

function trimEnv(key: string): string {
  const v = process.env[key];
  return (v && typeof v === 'string' ? v.trim() : '') || '';
}

// Single source of truth: trimmed env values (avoids 401 from quotes/whitespace in .env)
function getRawCredentials(): { cloudName: string; apiKey: string; apiSecret: string } {
  return {
    cloudName: trimEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: trimEnv('CLOUDINARY_API_KEY'),
    apiSecret: trimEnv('CLOUDINARY_API_SECRET'),
  };
}

// Check if Cloudinary is properly configured with real credentials (not placeholders)
export const isCloudinaryConfigured = (): boolean => {
  const { cloudName, apiKey, apiSecret } = getRawCredentials();
  if (!cloudName || !apiKey || !apiSecret) return false;
  if (
    isPlaceholder(cloudName, 'cloudName') ||
    isPlaceholder(apiKey, 'apiKey') ||
    isPlaceholder(apiSecret, 'apiSecret')
  ) {
    return false;
  }
  return true;
};

/** Returns trimmed, validated credentials. Use this everywhere — never read process.env directly. */
export function getCloudinaryCredentials(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} {
  const { cloudName, apiKey, apiSecret } = getRawCredentials();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env'
    );
  }
  if (
    isPlaceholder(cloudName, 'cloudName') ||
    isPlaceholder(apiKey, 'apiKey') ||
    isPlaceholder(apiSecret, 'apiSecret')
  ) {
    throw new Error(
      'Cloudinary has placeholder credentials. Replace with real values from Cloudinary Console → API Keys.'
    );
  }
  return { cloudName, apiKey, apiSecret };
}

// Get folder name based on environment
// v1.0.3: trim NODE_ENV defensively. A trailing newline or space on the env
// var would make our signed string include the whitespace while Cloudinary's
// reconstructed string strips it, causing a silent signature mismatch with
// the same params on both sides. Cheap insurance.
export const getCloudinaryFolder = (): string => {
  const env = (process.env.NODE_ENV || 'development').trim();
  return `varsityhub/${env}`;
};

type CloudinaryResourceType = 'image' | 'video' | 'auto';

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url?: string;
  url?: string;
  resource_type: string;
  bytes: number;
  format: string;
}

const getCloudinaryConfig = () => getCloudinaryCredentials();

const createSignature = (params: Record<string, string>, apiSecret: string) => {
  const toSign = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
};

/**
 * Optional content moderation provider.
 * Set `CLOUDINARY_MODERATION` to one of: 'aws_rek', 'manual', 'google_video_moderation', 'webpurify'.
 * Requires the corresponding Cloudinary add-on to be enabled.
 * If unset, uploads proceed without provider-side moderation.
 */
function getModerationParam(): string | null {
  const raw = (process.env.CLOUDINARY_MODERATION || '').trim().toLowerCase();
  if (!raw) return null;
  const allowed = ['aws_rek', 'manual', 'google_video_moderation', 'webpurify'];
  return allowed.includes(raw) ? raw : null;
}

/**
 * Sentinel type: an upstream provider (Cloudinary) rejected the request. This
 * is an infrastructure failure — not a caller authorization problem. The HTTP
 * route handler reads `.isUpstreamFailure` to surface a 502/503 to the client
 * instead of leaking Cloudinary's 401 through as the user's session problem.
 */
export class CloudinaryUpstreamError extends Error {
  readonly isUpstreamFailure = true as const;
  readonly provider = 'cloudinary' as const;
  constructor(
    message: string,
    public readonly http_code: number,
    public readonly cloudinary_message: string | undefined,
    public readonly kind: 'invalid_signature' | 'unauthorized' | 'server_error' | 'other'
  ) {
    super(message);
    this.name = 'CloudinaryUpstreamError';
  }
}

export async function uploadBufferToCloudinary(
  file: Express.Multer.File,
  opts?: { resourceType?: CloudinaryResourceType; folder?: string }
): Promise<CloudinaryUploadResult> {
  if (!file?.buffer) {
    throw new Error('No file buffer provided for Cloudinary upload');
  }

  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const folder = opts?.folder || getCloudinaryFolder();
  const timestamp = Math.floor(Date.now() / 1000);
  const resourceType: CloudinaryResourceType =
    opts?.resourceType || (file.mimetype.startsWith('video/') ? 'video' : 'image');

  const isVideo = resourceType === 'video';
  const moderation = getModerationParam();

  // v1.0.3: single source of truth for SIGNED params. Any param added here is
  // AUTOMATICALLY included in both the signature computation and the POST body.
  //
  // Intentionally minimal. Production Sentry showed Cloudinary computing its
  // string-to-sign as 'folder=...&timestamp=...' — only two params — even when
  // our server included `flags=exif_autostrip,strip_profile`. The only way for
  // our signature to match Cloudinary's reconstruction is to sign and send
  // exactly the set Cloudinary hashes. EXIF/ICC stripping is still achievable
  // via a Cloudinary upload preset or account-level transformation pipeline
  // (out of scope here) — the functional upload path comes first.
  const signedParams: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
  };
  if (moderation) signedParams.moderation = moderation;
  if (isVideo) {
    signedParams.audio_codec = 'aac';
    signedParams.video_codec = 'auto';
  }

  const signature = createSignature(signedParams, apiSecret);

  const form = new FormData();
  form.set(
    'file',
    new File([new Uint8Array(file.buffer)], file.originalname || `upload-${Date.now()}`, {
      type: file.mimetype || 'application/octet-stream',
    })
  );
  // Body mirrors signedParams 1:1 — never add form fields here without updating
  // signedParams above (and vice versa). The loop below enforces this.
  for (const [key, value] of Object.entries(signedParams)) {
    form.set(key, value);
  }
  // Cloudinary protocol extras that are NOT part of the signed string.
  form.set('api_key', apiKey);
  form.set('signature', signature);

  // Behind the Cloudinary upload breaker: only network-level failures reject
  // here (HTTP 4xx/5xx are handled below via response.ok), so a thrown error
  // means real upstream trouble and should count toward tripping. Generous
  // timeout to accommodate large stadium video uploads.
  const response = await runWithBreaker(
    'cloudinary-upload',
    () =>
      fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
        method: 'POST',
        body: form,
      }),
    { timeout: 120000 }
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const message = errorPayload?.error?.message || `Cloudinary upload failed (${response.status})`;

    // v1.0.3: classify the failure so the HTTP route can translate an upstream
    // 401 ("Invalid Signature" / "Unknown API key") into a 502 for the client
    // instead of letting it masquerade as the caller's session-expired state.
    let kind: CloudinaryUpstreamError['kind'] = 'other';
    if (response.status === 401) {
      kind = /invalid signature/i.test(message) ? 'invalid_signature' : 'unauthorized';
    } else if (response.status >= 500) {
      kind = 'server_error';
    }

    // v1.0.3: emit structured diagnostics to Railway logs when Cloudinary
    // rejects the upload. Logs what we signed, what we sent, and an
    // anonymized secret fingerprint (first 3 chars + length). Compare the
    // reconstructed string against the "String to sign" in Cloudinary's
    // error response — if they match but the signature still fails, the
    // API_SECRET on Railway doesn't match the real Cloudinary secret (most
    // common cause: rotated in dashboard but not updated in env).
    const toSignString = Object.keys(signedParams)
      .sort()
      .map(k => `${k}=${signedParams[k]}`)
      .join('&');
    const secretFingerprint = `${apiSecret.slice(0, 3)}…[${apiSecret.length}ch]`;
    console.error('[cloudinary] Upload rejected — diagnostic dump', {
      status: response.status,
      cloudinary_message: message,
      kind,
      our_string_to_sign: toSignString,
      signed_params_sent: Object.keys(signedParams).sort(),
      computed_signature: signature,
      secret_fingerprint: secretFingerprint,
      cloud_name: cloudName,
      api_key_prefix: `${apiKey.slice(0, 4)}…`,
      resource_type: resourceType,
      folder,
      file_bytes: file.buffer.byteLength,
    });

    throw new CloudinaryUpstreamError(message, response.status, message, kind);
  }

  const result = (await response.json()) as CloudinaryUploadResult;
  return result;
}

/**
 * Generate a still JPG poster for a remote video by uploading it to Cloudinary
 * BY URL (Cloudinary's upload endpoint accepts an https URL as `file`) with an
 * eager frame-extraction transformation. This is core upload — it does NOT
 * require Cloudinary's "fetch" delivery type to be enabled — so it works for
 * R2-hosted story/highlight videos that have no server-derivable poster.
 *
 * Returns the poster's delivery URL, or null on any failure. NEVER throws —
 * callers use it fire-and-forget to backfill a poster without risking the
 * request that triggered it.
 */
export async function generateVideoPosterFromUrl(videoUrl: string): Promise<string | null> {
  if (!videoUrl || !/^https:\/\//i.test(videoUrl) || !isCloudinaryConfigured()) return null;
  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
    const folder = `${getCloudinaryFolder()}/video-posters`;
    const timestamp = Math.floor(Date.now() / 1000);
    // Extract frame 0, scale to 480px wide, deliver as JPG.
    const eager = 'so_0,w_480,c_scale,q_auto,f_jpg';
    const signedParams: Record<string, string> = {
      eager,
      folder,
      timestamp: String(timestamp),
    };
    const signature = createSignature(signedParams, apiSecret);
    const body = new URLSearchParams({
      ...signedParams,
      file: videoUrl,
      api_key: apiKey,
      signature,
    });
    // Own breaker name so poster failures never trip the main upload breaker.
    const response = await runWithBreaker(
      'cloudinary-poster',
      () =>
        fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        }),
      { timeout: 120000 }
    );
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      console.warn(
        '[cloudinary] video poster generation failed:',
        err?.error?.message || response.status
      );
      return null;
    }
    const data = (await response.json().catch(() => ({}))) as {
      eager?: Array<{ secure_url?: string; url?: string }>;
    };
    return data?.eager?.[0]?.secure_url || data?.eager?.[0]?.url || null;
  } catch (err: any) {
    console.warn('[cloudinary] video poster generation error:', err?.message || err);
    return null;
  }
}

/**
 * Parse a Cloudinary delivery URL and extract the `public_id` + resource type.
 * Handles optional transformations and version segments. Returns null if the URL
 * is not a recognizable Cloudinary asset URL.
 */
export function extractCloudinaryPublicId(
  url: string | null | undefined
): { publicId: string; resourceType: 'image' | 'video' } | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (!/(^|\.)cloudinary\.com$/i.test(u.hostname)) return null;
    // Path shape: /<cloud>/<resource_type>/upload/[transformations/]/[vNNN/]<public_id>.<ext>
    const parts = u.pathname.split('/').filter(Boolean);
    const uploadIdx = parts.indexOf('upload');
    if (uploadIdx < 1) return null;
    const resourceType = parts[uploadIdx - 1];
    if (resourceType !== 'image' && resourceType !== 'video') return null;
    let after = parts.slice(uploadIdx + 1);
    // Transformation segments contain a comma (e.g. c_fill,w_300). Strip leading transforms.
    while (after.length && after[0].includes(',')) after.shift();
    // Strip a version segment (vNNN) if present.
    if (after.length && /^v\d+$/.test(after[0])) after.shift();
    if (after.length === 0) return null;
    // Strip the trailing extension from the last segment.
    const last = after[after.length - 1];
    const dot = last.lastIndexOf('.');
    if (dot > 0) after[after.length - 1] = last.slice(0, dot);
    return { publicId: after.join('/'), resourceType };
  } catch {
    return null;
  }
}

/**
 * Delete a Cloudinary asset. Fire-and-forget from the caller's perspective — this
 * function throws on failure so the caller can decide to log/retry. Intended to be
 * called on post/user asset deletion so orphan media does not accumulate.
 */
export async function destroyCloudinaryAsset(
  publicId: string,
  resourceType: 'image' | 'video' = 'image'
): Promise<{ ok: boolean; result?: string; error?: string }> {
  if (!publicId) return { ok: false, error: 'missing public_id' };
  if (!isCloudinaryConfigured()) return { ok: false, error: 'cloudinary_not_configured' };
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    public_id: publicId,
    timestamp: String(timestamp),
    invalidate: 'true',
  };
  const signature = createSignature(params, apiSecret);
  const body = new URLSearchParams({
    ...params,
    api_key: apiKey,
    signature,
  });
  const response = await runWithBreaker('cloudinary-destroy', () =>
    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, error: err?.error?.message || `destroy_failed_${response.status}` };
  }
  const data = (await response.json().catch(() => ({}))) as { result?: string };
  return { ok: data?.result === 'ok' || data?.result === 'not found', result: data?.result };
}
