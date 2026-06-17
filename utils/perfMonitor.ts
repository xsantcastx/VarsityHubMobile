import { useEffect, useRef } from 'react';

// Timestamp of the most recent navigation intent (set by markNavStart). The next
// instrumented screen to become interactive consumes it to report tap->interactive.
let navStartAt: number | null = null;

/**
 * Dev-only: call at the moment a navigation is initiated (e.g. inside the back
 * helper or a push wrapper) so the destination screen can report the full
 * tap -> interactive latency, not just its own mount cost.
 */
export function markNavStart(): void {
  if (!__DEV__) return;
  navStartAt = Date.now();
}

/**
 * Dev-only navigation/render instrumentation.
 *
 * Purpose: PROVE where time goes during navigation before changing anything
 * (measure-first). Every output is `console.*`, which babel strips from
 * production builds, so this compiles to a no-op in prod — zero runtime cost.
 *
 * Pass the screen's own `loading` flag. It logs once, on the first completed
 * load (loading true -> false), measured from mount. This handles both screens
 * that start loading=true and screens that start false then load in an effect.
 *
 * Usage (call once, unconditionally, at the top level):
 *   useScreenLoadTime('GameDetails', loading);
 *
 * Logs:
 *   [perf] GameDetails interactive in 842ms after 6 renders
 *
 * - high ms  => slow mount (refetch-on-open / serial await waterfall)
 * - high renders => excessive re-renders before interactive (context/props churn)
 */
export function useScreenLoadTime(screenName: string, loading: boolean): void {
  const mountedAt = useRef(Date.now());
  const renders = useRef(0);
  const prevLoading = useRef(loading);
  const logged = useRef(false);
  renders.current += 1;

  useEffect(() => {
    if (!__DEV__ || logged.current) return;
    // Log on the first completed load cycle: loading true -> false.
    if (prevLoading.current && !loading) {
      logged.current = true;
      const ms = Date.now() - mountedAt.current;
      console.log(`[perf] ${screenName} interactive in ${ms}ms after ${renders.current} renders`);
      if (navStartAt != null) {
        console.log(`[perf-nav] -> ${screenName} tap->interactive ${Date.now() - navStartAt}ms`);
        navStartAt = null;
      }
    }
    prevLoading.current = loading;
  }, [loading, screenName]);
}

/**
 * Dev-only: log total renders + lifetime when a screen unmounts. Use to catch
 * screens that keep re-rendering after they're interactive (context churn).
 *   useRenderCounter('GameDetails');
 */
export function useRenderCounter(screenName: string): void {
  const renders = useRef(0);
  const mountedAt = useRef(Date.now());
  renders.current += 1;

  useEffect(() => {
    return () => {
      if (!__DEV__) return;
      const ms = Date.now() - mountedAt.current;
      console.log(`[perf] ${screenName} unmounted after ${renders.current} renders over ${ms}ms`);
    };
  }, [screenName]);
}
