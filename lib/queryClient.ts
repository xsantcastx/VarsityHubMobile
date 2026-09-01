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
 * AsyncStorage-backed persister. Keep this selective: large volatile timelines
 * make cold-start hydration slower over time and are cheap to refetch after the
 * first screen is interactive.
 *
 * AsyncStorage is already a native dependency in the shipped binary, and the
 * persist packages are pure-JS, so this ships safely via `eas update`.
 *
 * `CACHE_BUSTER` must be bumped whenever a persisted query's shape changes or
 * when the persistence policy changes so stale/oversized entries are dropped.
 */
export const CACHE_BUSTER = 'vh-rq-2';

const VOLATILE_PERSIST_PREFIXES = [
  'feed',
  'feed-',
  'discover-',
  'highlights',
  'profile-posts',
  'profile-replies',
  'profile-upvotes',
  'messages',
  'notifications',
];

export function shouldPersistQuery(query: {
  queryKey?: readonly unknown[];
  state?: { status?: string };
}) {
  if (query.state?.status !== 'success') return false;
  const firstKey = query.queryKey?.[0];
  if (typeof firstKey !== 'string') return true;
  return !VOLATILE_PERSIST_PREFIXES.some(prefix => firstKey.startsWith(prefix));
}

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
