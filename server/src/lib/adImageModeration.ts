import { Prisma } from '@prisma/client';
import { DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { prisma } from './prisma.js';
import { env } from './env.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
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
    throw new Error('REKOGNITION_REGION or AWS_REGION is required when ad image moderation is enabled');
  }
  client = new RekognitionClient({ region });
  return client;
}

async function fetchImageBytes(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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

    const labels: BannerModerationLabel[] = (response.ModerationLabels || []).map((label) => ({
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
      banner_moderation_labels: labels.length > 0 ? (labels as Prisma.InputJsonValue) : Prisma.DbNull,
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
