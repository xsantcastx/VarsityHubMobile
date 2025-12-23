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

const createSignature = (params: Record<string, string>, apiSecret: string, algorithm: 'sha1' | 'sha256') => {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');

  // Cloudinary’s v1 API expects a hex digest of params + apiSecret.
  // Prefer HMAC-SHA256, but fall back to SHA1 for compatibility if needed.
  return crypto.createHmac(algorithm, apiSecret).update(toSign).digest('hex');
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

  const buildRequest = (algo: 'sha1' | 'sha256') => {
    const params = {
      folder,
      timestamp: String(timestamp),
    };
    const signature = createSignature(params, apiSecret, algo);

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
    // Cloudinary defaults to SHA-1. Provide hint when using SHA-256; if unsupported, caller will retry with SHA-1.
    if (algo !== 'sha1') {
      form.set('signature_algorithm', algo);
    }

    return form;
  };

  const primaryAlgo = (process.env.CLOUDINARY_SIGNATURE_ALGO || 'sha256').toLowerCase() === 'sha1' ? 'sha1' : 'sha256';
  const fallbackAlgo: 'sha1' = 'sha1';

  const attemptUpload = async (algo: 'sha1' | 'sha256') => {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: buildRequest(algo),
    });
    return response;
  };

  let response = await attemptUpload(primaryAlgo);

  // If SHA-256 is rejected by the API, retry once with SHA-1 to preserve functionality.
  if (!response.ok && primaryAlgo !== fallbackAlgo) {
    response = await attemptUpload(fallbackAlgo);
  }

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = errorPayload?.error?.message || `Cloudinary upload failed (${response.status})`;
    throw new Error(message);
  }

  const result = (await response.json()) as CloudinaryUploadResult;
  return result;
}
