import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Share a game/event card to an Instagram Story.
 *
 * The event's image (its venue photo, or the WWE league default) becomes the
 * full-screen story background, centered on a VarsityHub-navy fill, with the
 * VarsityHub logo as a sticker and the event deep link attached.
 *
 * `react-native-share` is a NATIVE module added after the current App Store
 * binary, so it is dynamically imported behind try/catch (the OfflineBanner
 * pattern) — on an older binary the import fails and we report 'unavailable'
 * so the caller can fall back to the OS share sheet. This whole feature only
 * works in a build produced by `eas build` (native config + a Meta App ID);
 * OTA can never light it up on an older binary.
 */
export type IgStoryResult = 'shared' | 'unavailable' | 'error';

// Bundled sticker (ships in the binary). Reuse the app logo.
const STICKER_ASSET = require('../assets/logo.png');

const BRAND_NAVY = '#0F172A';

/** Public, numeric Meta/Facebook App ID (safe to ship). No secret is used here. */
function metaAppId(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const id =
    (extra.EXPO_PUBLIC_META_APP_ID as string | undefined) ||
    process.env.EXPO_PUBLIC_META_APP_ID ||
    '';
  return id ? String(id) : null;
}

/**
 * Whether the IG-Story path can work at all: it needs a Meta App ID. Callers
 * gate the "Share to Instagram Story" affordance on this so we don't show a
 * button that silently falls back to the plain share sheet.
 */
export function isInstagramStoryShareConfigured(): boolean {
  return !!metaAppId();
}

function mimeForUrl(url: string): string {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function remoteImageToDataUri(remoteUrl: string): Promise<string | null> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;
  try {
    const target = `${cacheDir}ig-story-bg`;
    const { uri } = await FileSystem.downloadAsync(remoteUrl, target);
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mimeForUrl(remoteUrl)};base64,${b64}`;
  } catch {
    return null;
  }
}

async function stickerDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(STICKER_ASSET);
    await asset.downloadAsync();
    const uri = asset.localUri || asset.uri;
    if (!uri) return null;
    const b64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function shareToInstagramStory(opts: {
  backgroundImageUrl?: string | null;
  linkUrl?: string | null;
}): Promise<IgStoryResult> {
  const appId = metaAppId();
  if (!appId) return 'unavailable';
  if (!opts.backgroundImageUrl) return 'unavailable';

  let Share: any;
  try {
    Share = (await import('react-native-share')).default;
  } catch {
    return 'unavailable';
  }
  const storiesConst = Share?.Social?.INSTAGRAM_STORIES;
  if (!Share?.shareSingle || !storiesConst) return 'unavailable';

  const backgroundImage = await remoteImageToDataUri(opts.backgroundImageUrl);
  if (!backgroundImage) return 'error';
  const stickerImage = await stickerDataUri();

  try {
    await Share.shareSingle({
      social: storiesConst,
      appId,
      backgroundImage,
      backgroundTopColor: BRAND_NAVY,
      backgroundBottomColor: BRAND_NAVY,
      ...(stickerImage ? { stickerImage } : {}),
      ...(opts.linkUrl ? { attributionURL: opts.linkUrl } : {}),
    });
    return 'shared';
  } catch (e: any) {
    // A user cancel isn't a failure worth surfacing.
    const msg = String(e?.message ?? e ?? '');
    if (/cancel|dismiss/i.test(msg)) return 'shared';
    if (__DEV__) console.warn('[shareToInstagramStory]', msg);
    return 'error';
  }
}
