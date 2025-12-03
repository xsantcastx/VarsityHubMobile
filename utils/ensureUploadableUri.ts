import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Ensure a picked asset URI is a local file path suitable for upload.
 * - On iOS, ImagePicker may return `ph://` URIs from PhotoKit.
 * - For images, we re-encode via ImageManipulator to a temporary `file://` path.
 * - For videos, we pass `ph://` URIs directly to the upload handler.
 *   The native upload bridge should handle PhotoKit assets if permissions are set.
 */
export async function ensureUploadableUri(uri: string, mimeType?: string): Promise<{ uri: string; mimeType?: string }> {
  const isIOS = Platform.OS === 'ios';
  const isVideo = mimeType ? mimeType.startsWith('video') : uri.toLowerCase().endsWith('.mp4') || uri.toLowerCase().endsWith('.mov');
  const isPhoto = mimeType ? mimeType.startsWith('image') : uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg') || uri.toLowerCase().endsWith('.png');
  
  // If already a file path, return as is
  if (uri.startsWith('file://')) {
    return { uri, mimeType };
  }
  
  // iOS Photos URI handling
  if (isIOS && uri.startsWith('ph://')) {
    // For images: re-encode via ImageManipulator to get a real file path
    if (isPhoto) {
      try {
        if (__DEV__) console.log('[media] Re-encoding ph:// image...');
        const manip = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
        if (manip && manip.uri) {
          if (__DEV__) console.log('[media] Image re-encoded to:', manip.uri);
          return { uri: manip.uri, mimeType: 'image/jpeg' };
        }
      } catch (e) {
        console.warn('[media] Failed to re-encode ph:// image:', e);
        // Fall through to return original
      }
    }
    
    // For videos: return the ph:// URI as-is
    // The upload handler should pass this to the native bridge, which handles PhotoKit access
    if (isVideo) {
      if (__DEV__) console.log('[media] Passing ph:// video URI directly to upload:', uri);
      return { uri, mimeType };
    }
    
    // Fallback for unrecognized types
    if (__DEV__) console.log('[media] Unhandled ph:// URI type, returning original');
    return { uri, mimeType };
  }
  
  return { uri, mimeType };
}

export default ensureUploadableUri;
