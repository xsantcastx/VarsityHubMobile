import crypto from 'node:crypto';

// Placeholder values from .env.example — treat as "not configured" so local dev fails fast
// instead of silently failing uploads. Use real Cloudinary credentials in server/.env
const CLOUDINARY_PLACEHOLDERS = {
  cloudName: ['your-cloud-name', ''],
  apiKey: ['your-api-key', '123456789012345', ''],
  apiSecret: ['your-api-secret', 'your-cloudinary-secret', 'abcdefghijklmnopqrstuvwxyz', ''],
};

function isPlaceholder(value: string | undefined, key: keyof typeof CLOUDINARY_PLACEHOLDERS): boolean {
  if (!value) return true;
  return CLOUDINARY_PLACEHOLDERS[key].some((p) => p && value.trim() === p);
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
  if (isPlaceholder(cloudName, 'cloudName') || isPlaceholder(apiKey, 'apiKey') || isPlaceholder(apiSecret, 'apiSecret')) {
    return false;
  }
  return true;
};

/** Returns trimmed, validated credentials. Use this everywhere — never read process.env directly. */
export function getCloudinaryCredentials(): { cloudName: string; apiKey: string; apiSecret: string } {
  const { cloudName, apiKey, apiSecret } = getRawCredentials();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env');
  }
  if (isPlaceholder(cloudName, 'cloudName') || isPlaceholder(apiKey, 'apiKey') || isPlaceholder(apiSecret, 'apiSecret')) {
    throw new Error('Cloudinary has placeholder credentials. Replace with real values from Cloudinary Console → API Keys.');
  }
  return { cloudName, apiKey, apiSecret };
}

// Get folder name based on environment
export const getCloudinaryFolder = (): string => {
  const env = process.env.NODE_ENV || 'development';
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
    .map((key) => `${key}=${params[key]}`)
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
  const isImage = resourceType === 'image';
  // EXIF / embedded metadata (including GPS) is a child-safety concern on a youth
  // sports platform. `exif_autostrip` removes EXIF from the stored original;
  // keep `strip_profile` as well to avoid retaining embedded ICC/profile data.
  const imageFlags = isImage ? 'exif_autostrip,strip_profile' : undefined;
  const moderation = getModerationParam();

  const params: Record<string, string> = {
    folder,
    timestamp: String(timestamp),
    image_metadata: 'false',
    ...(imageFlags ? { flags: imageFlags } : {}),
    ...(moderation ? { moderation } : {}),
    ...(isVideo ? { audio_codec: 'aac', video_codec: 'auto' } : {}),
  };
  const signature = createSignature(params, apiSecret);

  const form = new FormData();
  form.set(
    'file',
    new File([new Uint8Array(file.buffer)], file.originalname || `upload-${Date.now()}`, {
      type: file.mimetype || 'application/octet-stream',
    })
  );
  form.set('api_key', apiKey);
  form.set('timestamp', String(timestamp));
  form.set('folder', folder);
  form.set('signature', signature);
  form.set('image_metadata', 'false');
  if (imageFlags) form.set('flags', imageFlags);
  if (moderation) form.set('moderation', moderation);
  if (isVideo) {
    form.set('audio_codec', 'aac');
    form.set('video_codec', 'auto');
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = errorPayload?.error?.message || `Cloudinary upload failed (${response.status})`;
    throw new Error(message);
  }

  const result = (await response.json()) as CloudinaryUploadResult;
  return result;
}

/**
 * Parse a Cloudinary delivery URL and extract the `public_id` + resource type.
 * Handles optional transformations and version segments. Returns null if the URL
 * is not a recognizable Cloudinary asset URL.
 */
export function extractCloudinaryPublicId(url: string | null | undefined):
  | { publicId: string; resourceType: 'image' | 'video' }
  | null {
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
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    return { ok: false, error: err?.error?.message || `destroy_failed_${response.status}` };
  }
  const data = (await response.json().catch(() => ({}))) as { result?: string };
  return { ok: data?.result === 'ok' || data?.result === 'not found', result: data?.result };
}
