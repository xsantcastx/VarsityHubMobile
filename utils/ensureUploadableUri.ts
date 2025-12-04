import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Ensure a picked asset URI is suitable for upload via FormData.
 * - On iOS, ImagePicker may return `ph://` PhotoKit URIs which FormData can handle
 * - For images: Re-encode via ImageManipulator to compress
 * 
 * Note: React Native's FormData sends the URI as-is to the server,
 * which iOS HTTP layer translates to the actual file content.
 */
export async function ensureUploadableUri(uri: string, mimeType?: string): Promise<{ uri: string; mimeType?: string }> {
  const isPhoto = mimeType ? mimeType.startsWith('image') : uri.toLowerCase().endsWith('.jpg') || uri.toLowerCase().endsWith('.jpeg') || uri.toLowerCase().endsWith('.png');
  
  // If already a file path, return as is
  if (uri.startsWith('file://')) {
    return { uri, mimeType };
  }
  
  // For images: re-encode to compress (works with both file:// and ph:// URIs)
  if (isPhoto) {
    try {
      if (__DEV__) console.log('[media] Re-encoding image for compression...');
      const manip = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      if (manip && manip.uri) {
        if (__DEV__) console.log('[media] Image re-encoded to:', manip.uri);
        return { uri: manip.uri, mimeType };
      }
    } catch (e) {
      console.warn('[media] Failed to re-encode image:', e);
      // Fallback: return original URI
    }
  }
  
  return { uri, mimeType };
}

export default ensureUploadableUri;
