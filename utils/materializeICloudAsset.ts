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
 *
 * v1.0.3: throws a tagged error when materialization fails on an iOS `ph://`
 * URI so callers can surface a clear "photo is in iCloud, open Photos first"
 * message. Previously this swallowed the failure and returned the unusable
 * ph:// URI — downstream code then threw a generic error with an empty message
 * that surfaced as the useless "Image Error — something went wrong" fallback.
 */
export class ICloudMaterializationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ICloudMaterializationError';
  }
}

export async function materializeICloudAssetIfNeeded(uri: string): Promise<string> {
  if (Platform.OS !== 'ios') return uri;

  // Only ph:// URIs reference Apple Photos cloud assets
  if (!uri.startsWith('ph://')) return uri;

  // Require permission to read from the photo library so the asset-info call
  // can actually reach iCloud. Without this, getAssetInfoAsync returns a
  // non-localUri result and we'd throw even when the asset exists.
  // Cast through `any` — some TS configs don't expose getPermissionsAsync
  // from the expo-media-library namespace import, same reason getAssetInfoAsync
  // is cast below.
  const MediaLibAny = MediaLibrary as any;
  const getPerm = MediaLibAny.getPermissionsAsync;
  if (typeof getPerm === 'function') {
    const perm = await getPerm();
    if (perm && perm.status !== 'granted') {
      const reqPerm = await MediaLibAny.requestPermissionsAsync?.();
      if (reqPerm && reqPerm.status !== 'granted') {
        throw new ICloudMaterializationError(
          'Photo library permission is required to access iCloud photos. ' +
            'Grant access in Settings → Privacy → Photos, then try again.'
        );
      }
    }
  }

  try {
    const assetId = uri.replace('ph://', '').split('/')[0];
    if (!assetId) {
      throw new ICloudMaterializationError('iCloud asset identifier is missing.');
    }

    // getAssetInfoAsync with shouldDownloadFromNetwork forces iOS to fetch the
    // full-resolution image from iCloud before returning. The resulting localUri
    // is a file:// path to the downloaded content.
    // expo-media-library ~18.2 exports getAssetInfoAsync but some TS configs
    // don't resolve it from the namespace import. Cast to any for the call.
    const getInfo = (MediaLibrary as any).getAssetInfoAsync;
    if (typeof getInfo !== 'function') {
      // Platform can't materialize — return the ph:// URI and let the caller
      // throw a more specific error on the first failed read.
      return uri;
    }
    const info = await (getInfo as (id: string, opts?: any) => Promise<{ localUri?: string }>)(
      assetId,
      {
        shouldDownloadFromNetwork: true,
      }
    );

    if (info?.localUri) {
      if (__DEV__) console.log('[media] iCloud asset materialized to:', info.localUri);
      return info.localUri;
    }

    // No localUri came back — this is the common "asset is in iCloud and
    // couldn't be downloaded" path. Throw so the caller shows a clear alert.
    throw new ICloudMaterializationError(
      'This photo is stored in iCloud and could not be downloaded. ' +
        'Open it in the Photos app to download it, then try again.'
    );
  } catch (e) {
    if (e instanceof ICloudMaterializationError) throw e;
    if (__DEV__) console.warn('[media] iCloud materialization failed:', e);
    throw new ICloudMaterializationError(
      'This photo is stored in iCloud and could not be downloaded. ' +
        'Open it in the Photos app to download it, then try again.',
      e
    );
  }
}
