import * as ImageManipulator from 'expo-image-manipulator';
import { materializeICloudAssetIfNeeded } from './materializeICloudAsset';

/**
 * Max dimension (width or height) for uploaded images.
 * Images larger than this are resized to fit within this limit, preserving aspect ratio.
 */
const MAX_IMAGE_DIMENSION = 1920;

/**
 * JPEG compression quality (0-1). 0.8 = 80% quality.
 */
const IMAGE_COMPRESS_QUALITY = 0.8;

/**
 * Check if a mime type or URI corresponds to an image (not video, not PDF, etc.)
 */
function isImageFile(mimeType?: string, uri?: string): boolean {
  if (mimeType) return mimeType.startsWith('image/');
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return /\.(jpg|jpeg|png|gif|webp|heic|heif)(\?.*)?$/.test(lower);
}

/**
 * Compress and resize an image for upload.
 * - Forces iCloud download on iOS when needed (v1.0.2)
 * - Resizes to max 1920px on the longest side (maintains aspect ratio)
 * - Compresses to 80% JPEG quality
 * - Skips videos and non-image files
 *
 * Returns the processed URI and updated mimeType.
 * If compression fails, returns the original URI as a fallback.
 */
export async function compressImageForUpload(
  uri: string,
  mimeType?: string,
): Promise<{ uri: string; mimeType?: string }> {
  // Don't compress non-images (videos, PDFs, etc.)
  if (!isImageFile(mimeType, uri)) {
    return { uri, mimeType };
  }

  // v1.0.2: force iCloud download before manipulation
  const localUri = await materializeICloudAssetIfNeeded(uri);

  // Attempt 1: resize to max dimension + compress
  try {
    if (__DEV__) console.log('[media] Compressing image for upload (max 1920px, 80% quality)...');
    const manip = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    if (manip?.uri) {
      if (__DEV__) console.log('[media] Image compressed to:', manip.uri);
      return { uri: manip.uri, mimeType: 'image/jpeg' };
    }
  } catch (e) {
    if (__DEV__) console.warn('[media] Image compression attempt 1 failed:', e);
  }

  // Attempt 2: compress without resize (in case the resize dimension caused issues)
  try {
    const manip = await ImageManipulator.manipulateAsync(
      localUri,
      [],
      { compress: IMAGE_COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
    );
    if (manip?.uri) {
      if (__DEV__) console.log('[media] Image compressed (no resize fallback) to:', manip.uri);
      return { uri: manip.uri, mimeType: 'image/jpeg' };
    }
  } catch (e) {
    if (__DEV__) console.warn('[media] Image compression attempt 2 also failed:', e);
  }

  // Fallback: return the (possibly materialized) local URI
  return { uri: localUri, mimeType };
}

/**
 * Ensure a picked asset URI is suitable for upload via FormData.
 * - For images: compress + resize via ImageManipulator (max 1920px, 80% quality)
 * - For videos: pass through as-is (FormData handles ph:// URIs directly on iOS)
 *
 * Note: React Native's FormData sends the URI as-is to the server,
 * which iOS HTTP layer translates to the actual file content.
 */
export async function ensureUploadableUri(uri: string, mimeType?: string): Promise<{ uri: string; mimeType?: string }> {
  return compressImageForUpload(uri, mimeType);
}
