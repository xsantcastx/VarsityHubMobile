import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Ensure a picked asset URI is a local file path suitable for upload.
 * - On iOS, ImagePicker may return `ph://` URIs from PhotoKit.
 * - For both images & videos: Use MediaLibrary to export to a real file:// path
 * - For images: Also re-encode via ImageManipulator to compress
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
    try {
      // Request media library permissions if needed
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Media library permission denied');
      }
      
      // Extract the asset ID from the ph:// URI
      const assetId = uri.replace('ph://', '');
      if (__DEV__) console.log('[media] Exporting ph:// asset:', assetId);
      
      // Use MediaLibrary to get the actual file path
      const assets = await MediaLibrary.getAssetsAsync({ first: 1, assetIds: [assetId] });
      if (!assets.assets || !assets.assets.length) {
        throw new Error('Could not find asset in media library');
      }
      
      const asset = assets.assets[0];
      let fileUri = asset.uri;
      
      if (__DEV__) console.log('[media] Asset exported to:', fileUri, '| type:', asset.mediaType);
      
      // For images: also re-encode to compress
      if (isPhoto && fileUri.startsWith('file://')) {
        try {
          if (__DEV__) console.log('[media] Re-encoding image for compression...');
          const manip = await ImageManipulator.manipulateAsync(fileUri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
          if (manip && manip.uri) {
            fileUri = manip.uri;
            if (__DEV__) console.log('[media] Image re-encoded to:', fileUri);
          }
        } catch (e) {
          console.warn('[media] Failed to re-encode image:', e);
          // Continue with un-compressed version
        }
      }
      
      return { uri: fileUri, mimeType };
    } catch (e: any) {
      console.error('[media] Failed to handle ph:// URI:', e?.message || e);
      // Fallback: return original and hope the upload handler can deal with it
      return { uri, mimeType };
    }
  }
  
  return { uri, mimeType };
}

export default ensureUploadableUri;
