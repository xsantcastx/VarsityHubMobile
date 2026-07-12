/**
 * Cloudflare R2 storage — presigned direct-upload support.
 *
 * R2 is S3-compatible and, critically, charges ZERO egress — so at scale it
 * beats Cloudinary's per-GB credits and per-minute video streaming. This module
 * is the server half of a future direct-to-R2 upload path that mirrors the
 * existing Cloudinary flow: the client asks for a short-lived presigned PUT URL,
 * uploads the bytes straight to R2, then posts the resulting public URL.
 *
 * DORMANT BY DEFAULT. Every function no-ops (isR2Configured() === false) until
 * all four env vars are set, so importing/mounting this changes nothing in
 * production until R2 is deliberately provisioned:
 *   R2_ACCOUNT_ID        — Cloudflare account id (the S3 endpoint host)
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET            — target bucket name
 *   R2_PUBLIC_BASE_URL   — public/custom-domain base for delivery (optional;
 *                          if unset, presign still works but no public URL is
 *                          returned and the caller must serve via a worker)
 *
 * The AWS SDK v3 (@aws-sdk/client-s3 + s3-request-presigner) is already a
 * dependency — no new install, no new binary, so activation ships via OTA.
 */
import crypto from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function env(key: string): string {
  const v = process.env[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function isR2Configured(): boolean {
  return Boolean(
    env('R2_ACCOUNT_ID') &&
      env('R2_ACCESS_KEY_ID') &&
      env('R2_SECRET_ACCESS_KEY') &&
      env('R2_BUCKET')
  );
}

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (_client) return _client;
  if (!isR2Configured()) {
    throw new Error('R2 is not configured (R2_ACCOUNT_ID / keys / bucket missing)');
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    },
  });
  return _client;
}

/** Environment-scoped key prefix, mirroring getCloudinaryFolder(). */
export function getR2KeyPrefix(): string {
  const e = (process.env.NODE_ENV || 'development').trim();
  return `varsityhub/${e}`;
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const ALLOWED_MIME = new Set(Object.keys(MIME_EXTENSION));

export interface R2PresignResult {
  uploadUrl: string;
  key: string;
  publicUrl: string | null;
  expiresIn: number;
}

/**
 * Generate a presigned PUT URL for a single object. The key is server-chosen
 * (random id under the env prefix) so a client can never overwrite another's
 * object or escape the prefix. ContentType is pinned into the signature, so the
 * client must upload exactly that type. Returns null if R2 isn't configured.
 */
export async function createR2UploadTicket(opts: {
  contentType: string;
  expiresIn?: number;
}): Promise<R2PresignResult | null> {
  if (!isR2Configured()) return null;

  const contentType = opts.contentType.toLowerCase();
  if (!ALLOWED_MIME.has(contentType)) {
    throw new Error(`Unsupported content type for R2 upload: ${contentType}`);
  }
  const ext = MIME_EXTENSION[contentType];
  const id = crypto.randomBytes(16).toString('hex');
  const key = `${getR2KeyPrefix()}/${id}.${ext}`;
  const expiresIn = Math.min(Math.max(opts.expiresIn ?? 600, 60), 3600);

  const command = new PutObjectCommand({
    Bucket: env('R2_BUCKET'),
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn });

  const publicBase = env('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
  const publicUrl = publicBase ? `${publicBase}/${key}` : null;

  return { uploadUrl, key, publicUrl, expiresIn };
}
