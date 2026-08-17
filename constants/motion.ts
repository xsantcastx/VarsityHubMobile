/**
 * Canonical motion vocabulary — the Apple-design spring/physics constants,
 * in code, so no screen hand-tunes its own values.
 *
 * The numbers here mirror the canonical values documented in the `apple-design`
 * skill (spring damping/response, momentum-projection decel 0.998, rubber-band
 * constant 0.55). If a value ever changes, change it in `apple-design` first,
 * then mirror it here — never let the two diverge.
 *
 * Reanimated 4's `withSpring` takes { duration, dampingRatio }, which map 1:1 to
 * Apple's response + damping. Default everything to dampingRatio 1.0 (no
 * overshoot); use bounce (0.8) only when a gesture carried momentum (a flick).
 */

export type SpringConfig = { duration: number; dampingRatio: number };

/** Critically damped, no overshoot. The default for repositions/reveals. */
export const SPRING_DEFAULT: SpringConfig = { duration: 400, dampingRatio: 1.0 };

/** Slight bounce — ONLY after a gesture carried momentum (flick / throw / drag release). */
export const SPRING_MOMENTUM: SpringConfig = { duration: 400, dampingRatio: 0.8 };

/** Drawers / bottom sheets. */
export const SPRING_SHEET: SpringConfig = { duration: 300, dampingRatio: 0.8 };

/** Snappy press feedback (scale punch on press-in). */
export const SPRING_PRESS: SpringConfig = { duration: 120, dampingRatio: 1.0 };

/**
 * Apple's momentum-projection function (decay form, NOT v²/2a): given a release
 * velocity in px/s, returns the offset the content would coast to. Add it to the
 * current position to find where a flick is "going", then snap to the nearest
 * target from there.
 *
 * Marked `'worklet'` so it can run on the UI thread inside a gesture handler.
 */
export function project(velocity: number, decel = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decel) / (1 - decel);
}

/**
 * Progressive boundary resistance (rubber-banding): the further past a bound the
 * user drags, the less the element follows. `overshoot` is how far past the bound
 * (signed), `dim` the relevant dimension (e.g. screen height), `c` the resistance
 * constant. Returns the damped offset to actually apply.
 *
 * Marked `'worklet'` for UI-thread use inside a gesture handler.
 */
export function rubberband(overshoot: number, dim: number, c = 0.55): number {
  'worklet';
  return (overshoot * dim * c) / (dim + c * Math.abs(overshoot));
}
