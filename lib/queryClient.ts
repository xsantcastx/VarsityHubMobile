import { QueryClient } from '@tanstack/react-query';

/**
 * Shared react-query client tuned for stale-while-revalidate on mobile.
 *
 * The goal is to kill the "loading wheel on every navigation" feel: once a
 * screen has fetched, navigating away and back returns the cached data
 * instantly and only re-fetches in the background when the data is stale.
 *
 * Migration rule for screens: gate the full-screen spinner on `isPending`
 * (no cached data yet) — NOT on `isFetching` (a background revalidation).
 * Showing the spinner on `isFetching` re-introduces the wheel we're removing.
 *
 * Pure-JS dependency (no native module), so this ships safely via `eas update`
 * without a new App Store binary.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 30s — repeated navigation within that
      // window is instant with zero network calls.
      staleTime: 30_000,
      // Keep unused cache entries for 5 minutes so back-navigation still hits
      // a warm cache.
      gcTime: 5 * 60_000,
      // The HTTP client (api/http.ts) already retries with backoff; don't
      // stack a second retry layer on top.
      retry: 1,
      // No window-focus concept on native; avoid spurious refetches.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
