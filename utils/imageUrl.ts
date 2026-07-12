function applyCloudinaryTransform(
  url: string | undefined | null,
  transform: string
): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/${transform}/`);
}

/**
 * Apply Cloudinary transforms to an image URL for optimized delivery.
 * Only transforms Cloudinary URLs; returns others unchanged.
 */
export function optimizeImageUrl(
  url: string | undefined | null,
  width?: number
): string | undefined {
  return applyCloudinaryTransform(url, `w_${width || 600},q_auto,f_auto`);
}

/**
 * Apply Cloudinary transforms to a video URL for optimized playback delivery.
 * Only transforms Cloudinary URLs; returns others unchanged.
 */
export function optimizeVideoUrl(url: string | undefined | null): string | undefined {
  return applyCloudinaryTransform(url, 'q_auto');
}
