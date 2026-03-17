import crypto from 'node:crypto';
import { FormData, File, fetch } from 'undici';

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

  const params = {
    folder,
    timestamp: String(timestamp),
  };
  const signature = createSignature(params, apiSecret);

  const form = new FormData();
  form.set(
    'file',
    new File([file.buffer], file.originalname || `upload-${Date.now()}`, {
      type: file.mimetype || 'application/octet-stream',
    })
  );
  form.set('api_key', apiKey);
  form.set('timestamp', String(timestamp));
  form.set('folder', folder);
  form.set('signature', signature);

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
