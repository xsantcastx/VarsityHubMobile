import crypto from 'node:crypto';
import { FormData, File, fetch } from 'undici';

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

/**
 * Rewrite a Cloudinary delivery URL to strip image metadata (EXIF/GPS/IPTC).
 *
 * Cloudinary retains EXIF on the stored original; the canonical way to deliver
 * a privacy-safe asset is to insert `fl_strip_profile` into the transformation
 * segment of the URL. For video and non-image resources we return the URL
 * unchanged — Cloudinary's video pipeline already strips metadata.
 *
 * Input:  https://res.cloudinary.com/<cloud>/image/upload/v123/<public_id>.jpg
 * Output: https://res.cloudinary.com/<cloud>/image/upload/fl_strip_profile/v123/<public_id>.jpg
 *
 * If the URL already has a transformation segment, we prepend `fl_strip_profile,`
 * so existing transforms survive.
 */
export function stripImageMetadataUrl(secureUrl: string | undefined, resourceType: string): string | undefined {
  if (!secureUrl) return secureUrl;
  if (resourceType !== 'image') return secureUrl;
  const match = secureUrl.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!match) return secureUrl;
  const [, prefix, rest] = match;
  // If `rest` starts with a version segment (v1234/...) there is no transform yet.
  if (/^v\d+\//.test(rest)) {
    return `${prefix}fl_strip_profile/${rest}`;
  }
  // Otherwise a transform block already exists up to the first `/`.
  const slash = rest.indexOf('/');
  if (slash === -1) return secureUrl;
  const transform = rest.slice(0, slash);
  const tail = rest.slice(slash + 1);
  if (transform.split(',').includes('fl_strip_profile')) return secureUrl;
  return `${prefix}fl_strip_profile,${transform}/${tail}`;
}

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
  // Ensure delivered URLs strip EXIF/GPS/IPTC from image originals.
  const stripped = stripImageMetadataUrl(result.secure_url, result.resource_type);
  if (stripped) result.secure_url = stripped;
  const strippedHttp = stripImageMetadataUrl(result.url, result.resource_type);
  if (strippedHttp) result.url = strippedHttp;
  return result;
}
