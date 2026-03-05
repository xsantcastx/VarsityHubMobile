const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'];

export const detectMediaType = (url?: string | null): 'video' | 'image' => {
  if (!url) return 'image';
  const sanitized = url.split('?')[0].split('#')[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => sanitized.endsWith(ext)) ? 'video' : 'image';
};

/**
 * Derive an animated WebP preview URL from a Cloudinary video URL.
 * Returns null for non-Cloudinary URLs or non-video URLs.
 */
export const getVideoPreviewUrl = (url?: string | null): string | null => {
  if (!url || detectMediaType(url) !== 'video') return null;
  const match = url.match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)((?:[^v][^/]*\/)*)?(v\d+\/.+)$/
  );
  if (!match) return null;
  const [, base, , rest] = match;
  return `${base}f_webp,fl_awebp,du_3,so_0,w_480,q_60/${rest}`;
};
