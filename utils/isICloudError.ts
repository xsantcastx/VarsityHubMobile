/**
 * Detect iOS iCloud-related media errors.
 *
 * When a user selects a photo/video that hasn't been downloaded from iCloud,
 * iOS surfaces a variety of generic error strings depending on the picker
 * path and OS version. This helper centralises the detection so every media
 * picker in the app reacts consistently.
 *
 * v1.0.2 audit fix: BannerUpload already had this, but create-post.tsx only
 * checked for 'public.png'. Now both share the same list.
 */
export function isICloudError(error: unknown): boolean {
  const msg = String((error as any)?.message || '').toLowerCase();
  return (
    msg.includes('icloud') ||
    msg.includes('not downloaded') ||
    msg.includes('cloud asset') ||
    msg.includes('ph://') ||
    msg.includes('no such file') ||
    msg.includes('unable to decode') ||
    msg.includes('could not read') ||
    msg.includes('public.png') ||
    msg.includes('failed to read picked image')
  );
}

/** User-facing alert copy for iCloud errors. */
export const ICLOUD_ERROR_TITLE = 'Photo Not Available Locally';
export const ICLOUD_ERROR_MESSAGE =
  'This photo or video is stored in iCloud and could not be downloaded. ' +
  'Open it in Photos first to download it, then try again.';
