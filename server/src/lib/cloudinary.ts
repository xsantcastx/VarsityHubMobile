import crypto from 'node:crypto';
import { File, FormData, fetch } from 'undici';

// Check if Cloudinary is properly configured
export const isCloudinaryConfigured = (): boolean => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

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

const getCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured');
  }

  return { cloudName, apiKey, apiSecret };
};

const createSignature = (params: Record<string, string>, apiSecret: string) => {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // ⚠️  SHA-1 is required by Cloudinary API for request signatures
  // https://cloudinary.com/documentation/upload_widget#signed_uploads
  // Although SHA-1 is cryptographically weak for general use,
  // Cloudinary requires it for API authentication. This is not a security risk
  // for signed upload requests.
  // snyk-ignore-next-line Use of Password Hash With Insufficient Computational Effort (Cloudinary requires SHA-1 signatures)
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
