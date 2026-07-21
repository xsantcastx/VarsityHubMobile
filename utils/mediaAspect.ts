/**
 * Orientation-correct media display.
 *
 * Consumption surfaces (feed, stories, post-detail) render inside a portrait
 * frame. Historically they forced `contentFit: 'cover'`, which crops a
 * landscape clip down to its centre strip — a horizontal video was never shown
 * the way it was filmed. Given the intrinsic media dimensions we can instead
 * show a landscape clip WHOLE (letterboxed), while portrait/square/unknown
 * media keep the immersive fill so nothing regresses for the (many) existing
 * rows that have no stored dimensions.
 */

export type MediaFit = {
  /** width / height, or null when dimensions are unknown. */
  aspectRatio: number | null;
  /** `'contain'` shows a landscape clip whole; `'cover'` fills the frame. */
  contentFit: 'cover' | 'contain';
  isLandscape: boolean;
};

// Slightly above 1 so a ~square clip (e.g. 1080x1080) keeps the immersive
// fill rather than getting thin letterbox bars it doesn't need.
const LANDSCAPE_RATIO_THRESHOLD = 1.05;

/**
 * Decide how to display a video/image from its intrinsic dimensions.
 * Unknown or invalid dimensions fall back to today's behaviour (`cover`).
 */
export function resolveMediaFit(width?: number | null, height?: number | null): MediaFit {
  if (
    typeof width === 'number' &&
    typeof height === 'number' &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    const aspectRatio = width / height;
    const isLandscape = aspectRatio >= LANDSCAPE_RATIO_THRESHOLD;
    return {
      aspectRatio,
      contentFit: isLandscape ? 'contain' : 'cover',
      isLandscape,
    };
  }
  return { aspectRatio: null, contentFit: 'cover', isLandscape: false };
}
