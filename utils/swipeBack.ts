import { project } from '@/constants/motion';

/** Fraction of screen width past which a released swipe commits to going back. */
export const SWIPE_DISMISS_THRESHOLD = 0.4;

/**
 * Decide whether an edge-swipe-back should commit (navigate back) or return
 * (spring to origin) at release. Uses momentum projection (apple-design §6): a
 * short drag flicked hard still commits, and a long drag being flung back does
 * not. Decision is on the *projected* resting point, not the raw release point.
 *
 * `'worklet'` so it can be called from the gesture's onEnd on the UI thread.
 */
export function shouldDismissSwipe(
  translationX: number,
  velocityX: number,
  width: number,
  threshold: number = SWIPE_DISMISS_THRESHOLD
): boolean {
  'worklet';
  const projected = translationX + project(velocityX);
  return projected > width * threshold;
}
