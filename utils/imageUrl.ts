/**
 * Apply Cloudinary transforms to an image URL for optimized delivery.
 * Only transforms Cloudinary URLs; returns others unchanged.
 */
export function optimizeImageUrl(url: string | undefined | null, width?: number): string | undefined {
  if (!url) return undefined;
  if (!url.includes('res.cloudinary.com')) return url;
  // Insert transform before /upload/ path segment
  const transform = `w_${width || 600},q_auto,f_auto`;
  return url.replace('/upload/', `/upload/${transform}/`);
}
