import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

/**
 * Ensure a picked asset URI is a local file path suitable for upload.
 * - On iOS, ImagePicker may return `ph://` URIs which can fail with PHPhotos errors.
 * - For images, we re-encode via ImageManipulator to a temporary `file://` path.
 * - For videos, we use the native asset directly if picker supports it, or fallback gracefully.
 * 
 * Note: For iOS videos from MediaLibrary, ensure the picker returns a file:// path
 * by using appropriate ImagePicker options or MediaLibrary.getAssetInfoAsync separately.
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
    // For images: re-encode via ImageManipulator
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
    
    // For videos: ph:// URIs cannot be directly accessed by FileSystem
    // The solution is to configure ImagePicker to return file:// paths instead:
    // Use exif:false, mediaTypes:All, and ensure the picker exports to cache
    // For now, return original URI and let the upload handler deal with it
    if (isVideo) {
      console.warn('[media] Video ph:// URI detected. Ensure ImagePicker is configured to return file:// paths via caching.');
      // Note: This should be resolved by the picker returning file:// paths
      // If this fallback is hit, the upload will likely fail with PHPhotosErrorDomain
      return { uri, mimeType };
    }
    
    // Fallback for unrecognized types
    console.warn('[media] Unhandled ph:// URI type, returning original');
    return { uri, mimeType };
  }
  
  return { uri, mimeType };
}

export default ensureUploadableUri;
