/**
 * Cloudinary URL transform helper.
 *
 * Rewrites a raw Cloudinary upload URL to include resize/quality transforms
 * so the client never downloads a full-resolution image for thumbnails.
 *
 * Usage:
 *   optimizeImage(url, 400, 400)        → c_fill,w_400,h_400,q_auto,f_auto
 *   optimizeImage(url, 80, 80)          → avatar-sized
 *   optimizeImage(url)                  → q_auto,f_auto only (no resize)
 */

const CLOUDINARY_UPLOAD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

export function optimizeImage(
  url: string | null | undefined,
  width?: number,
  height?: number
): string | undefined {
  if (!url) return undefined;

  // Only transform Cloudinary URLs
  const match = url.match(CLOUDINARY_UPLOAD_RE);
  if (!match) return url;

  const parts: string[] = [];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push('c_fill');
  parts.push('q_auto', 'f_auto');

  const transform = parts.join(',') + '/';
  // Insert transforms immediately after /upload/ so versioned and unversioned
  // Cloudinary URLs both get optimized safely.
  return match[1] + transform + match[2];
}

/** Shortcut for avatar-sized images (80×80) */
export const avatarUrl = (url: string | null | undefined) => optimizeImage(url, 80, 80);

/** Shortcut for thumbnail grid (400×400) */
export const thumbUrl = (url: string | null | undefined) => optimizeImage(url, 400, 400);

/** Shortcut for banner/cover images (800×400) */
export const bannerUrl = (url: string | null | undefined) => optimizeImage(url, 800, 400);

/** Shortcut for feed card images (600 wide, auto height) */
export const feedImageUrl = (url: string | null | undefined) => optimizeImage(url, 600);
