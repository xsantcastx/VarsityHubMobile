/**
 * Dev/sim-only marketing feed helpers — pure and testable.
 *
 * The feed screen calls these ONLY behind a `__DEV__` + `EXPO_PUBLIC_MARKETING_FEED`
 * gate to capture a lively, shuffled reel of the most-active event pages for
 * marketing. Nothing here ships to production users (the caller is dead code in
 * a release bundle). Kept dependency-free so the shuffle is unit-testable with a
 * deterministic RNG. See
 * docs/superpowers/specs/2026-08-15-marketing-feed-devonly-design.md.
 */

/**
 * Fisher-Yates shuffle in place. `rng` defaults to Math.random but is injectable
 * so tests can assert a deterministic permutation.
 */
export function shuffleInPlace<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Take the top `count` items (input is assumed already ranked, most-active
 * first) and return a shuffled copy — the source array is never mutated.
 */
export function pickTopShuffled<T>(
  items: readonly T[],
  count: number,
  rng: () => number = Math.random
): T[] {
  const top = items.slice(0, Math.max(0, count));
  return shuffleInPlace(top, rng);
}
