import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
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
      //
      // This said `retry: 1`, which contradicted the line above: api/http.ts
      // gives a non-critical GET 3 retries, so react-query's extra attempt made
      // it 8 requests and ~4 minutes of wall-clock before `isError` flipped.
      // Worse, an aborted request closes the RN socket but does NOT cancel the
      // in-flight Postgres query, so a marginally slow endpoint got 8x server-side
      // amplification per tab tap — turning slow into down.
      retry: 0,
      // No window-focus concept on native; avoid spurious refetches.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * AsyncStorage-backed persister. On cold start the cache rehydrates from disk
 * so the app opens to the user's last-seen feed/profile/team data instantly,
 * then revalidates in the background (per the 30s staleTime).
 *
 * AsyncStorage is already a native dependency in the shipped binary, and the
 * persist packages are pure-JS, so this ships safely via `eas update`.
 *
 * `CACHE_BUSTER` must be bumped whenever a persisted query's shape changes so
 * stale-shaped entries are dropped instead of rehydrated.
 */
export const CACHE_BUSTER = 'vh-rq-1';

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'VH_REACT_QUERY_CACHE',
});

/**
 * Wipe both the in-memory cache and the persisted copy. MUST be called on
 * sign-out so one account's cached data can never rehydrate into the next
 * session on a shared device.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  queryClient.clear();
  try {
    await asyncStoragePersister.removeClient();
  } catch {
    // Best-effort: a failed disk wipe must not block sign-out.
  }
}
