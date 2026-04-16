import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

/**
 * v1.0.2: On iOS, images stored in iCloud Photos may not be locally available.
 * expo-image-picker returns a ph:// URI pointing at the cloud asset, and
 * ImageManipulator fails when it tries to read the file.
 *
 * This helper uses expo-media-library to force iOS to download the image
 * from iCloud before any manipulation or upload. Returns the local file:// URI.
 *
 * On Android or for non-ph:// URIs this is a no-op.
 */
export async function materializeICloudAssetIfNeeded(uri: string): Promise<string> {
  if (Platform.OS !== 'ios') return uri;

  // Only ph:// URIs reference Apple Photos cloud assets
  if (!uri.startsWith('ph://')) return uri;

  try {
    const assetId = uri.replace('ph://', '').split('/')[0];
    if (!assetId) return uri;

    // getAssetInfoAsync with shouldDownloadFromNetwork forces iOS to fetch the
    // full-resolution image from iCloud before returning. The resulting localUri
    // is a file:// path to the downloaded content.
    // expo-media-library ~18.2 exports getAssetInfoAsync but some TS configs
    // don't resolve it from the namespace import. Cast to any for the call.
    const getInfo = (MediaLibrary as any).getAssetInfoAsync;
    if (typeof getInfo !== 'function') return uri;
    const info = await (getInfo as (id: string, opts?: any) => Promise<{ localUri?: string }>)(assetId, {
      shouldDownloadFromNetwork: true,
    });

    if (info?.localUri) {
      if (__DEV__) console.log('[media] iCloud asset materialized to:', info.localUri);
      return info.localUri;
    }
  } catch (e) {
    if (__DEV__) console.warn('[media] iCloud materialization failed, will try original URI:', e);
  }

  return uri;
}
