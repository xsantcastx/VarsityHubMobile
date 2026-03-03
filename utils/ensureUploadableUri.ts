import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Ensure a picked asset URI is suitable for upload via FormData.
 * - On iOS, ImagePicker may return `ph://` PhotoKit URIs which FormData can handle directly
 * - For images: Re-encode via ImageManipulator to compress
 * - For videos: Pass through as-is (FormData handles ph:// URIs properly)
 * 
 * Note: React Native's FormData sends the URI as-is to the server,
 * which iOS HTTP layer translates to the actual file content.
 */
export async function ensureUploadableUri(uri: string, mimeType?: string): Promise<{ uri: string; mimeType?: string }> {
  const isPhoto = mimeType ? mimeType.startsWith('image') : uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg') || uri.toLowerCase().endsWith('.png');
  
  // For images: re-encode to compress and ensure it's a local file
  if (isPhoto) {
    // Attempt 1: re-encode with no transforms
    try {
      if (__DEV__) console.log('[media] Re-encoding image for compression...');
      const manip = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      if (manip && manip.uri) {
        if (__DEV__) console.log('[media] Image re-encoded to:', manip.uri);
        return { uri: manip.uri, mimeType };
      }
    } catch (e) {
      console.warn('[media] Re-encode attempt 1 failed, retrying with resize:', e);
    }
    // Attempt 2: resize to force iOS to materialize the file from PhotoKit
    try {
      const manip = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      if (manip && manip.uri) {
        if (__DEV__) console.log('[media] Image re-encoded (resize fallback) to:', manip.uri);
        return { uri: manip.uri, mimeType };
      }
    } catch (e) {
      console.warn('[media] Re-encode attempt 2 (resize) also failed:', e);
      // Fallback: return original URI
    }
  }
  
  // All other cases (videos, ph:// URIs, etc) return as-is
  // FormData handles ph:// URIs directly on iOS
  return { uri, mimeType };
}
