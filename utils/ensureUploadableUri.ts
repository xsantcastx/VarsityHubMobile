import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Ensure a picked asset URI is a local file path suitable for upload.
 * - On iOS, ImagePicker may return `ph://` URIs which can fail with PHPhotos errors.
 * - For images, we re-encode via ImageManipulator to a temporary `file://` path.
 * - For videos, we attempt to copy to cache if already a file path; otherwise let caller handle.
 */
export async function ensureUploadableUri(uri: string, mimeType?: string): Promise<{ uri: string; mimeType?: string }> {
  const isIOS = Platform.OS === 'ios';
  const isPhoto = mimeType ? mimeType.startsWith('image') : uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg') || uri.toLowerCase().endsWith('.png');
  // If already a file path, return as is
  if (uri.startsWith('file://')) {
    return { uri, mimeType };
  }
  // iOS Photos URI handling
  if (isIOS && uri.startsWith('ph://')) {
    if (isPhoto) {
      try {
        const manip = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
        if (manip && manip.uri) {
          return { uri: manip.uri, mimeType: 'image/jpeg' };
        }
      } catch (e) {
        console.warn('[media] Failed to re-encode ph:// image, falling back:', e);
      }
    }
    // For videos or failed re-encode, try to copy to cache if possible
    try {
      const baseDir: string = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || '/tmp/';
      const dest = baseDir + 'upload-' + Date.now() + (isPhoto ? '.jpg' : '');
      await FileSystem.copyAsync({ from: uri, to: dest });
      return { uri: dest, mimeType };
    } catch (e) {
      console.warn('[media] Failed to copy ph:// asset to cache:', e);
      // As last resort, return original URI; upload may still succeed depending on picker/source
      return { uri, mimeType };
    }
  }
  return { uri, mimeType };
}

export default ensureUploadableUri;
