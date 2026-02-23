import { useCallback, useRef, useState } from 'react';

export interface PageResult<T> {
  items: T[];
  nextCursor?: string | null;
  counts?: Record<string, number> | null;
}

export interface UsePaginatedQueryResult<T> {
  items: T[];
  loading: boolean;
  hasMore: boolean;
  cursor: string | null;
  counts: Record<string, number> | null;
  refresh: (params: Record<string, unknown>) => Promise<void>;
  loadMore: (params: Record<string, unknown>) => Promise<void>;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Base hook for cursor-based paginated queries.
 * fetchPage receives params (e.g. userId) and opts (limit, cursor).
 * Handles refresh, loadMore, request-in-flight guards, and cursor state.
 */
export function usePaginatedQuery<T, P extends Record<string, unknown> = Record<string, unknown>>(
  fetchPage: (params: P, opts: { limit: number; cursor?: string | null }) => Promise<PageResult<T>>,
  options: { limit?: number } = {}
): UsePaginatedQueryResult<T> {
  const limit = options.limit ?? 10;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const requestInFlight = useRef(false);
  const lastParamsRef = useRef<P | null>(null);

  const refresh = useCallback(async (params: P) => {
    if (requestInFlight.current) return;
    lastParamsRef.current = params;

    requestInFlight.current = true;
    setLoading(true);

    try {
      const page = await fetchPage(params, { limit });
      setItems(page.items ?? []);
      setCursor(page.nextCursor ?? null);
      setHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } catch (error: any) {
      console.error('[usePaginatedQuery] Failed to refresh:', error);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [fetchPage, limit]);

  const loadMore = useCallback(async (params: P) => {
    if (loading || !hasMore || requestInFlight.current) return;
    const p = lastParamsRef.current ?? params;
    lastParamsRef.current = p;

    requestInFlight.current = true;
    setLoading(true);

    try {
      const page = await fetchPage(p, { limit, cursor: cursor || undefined });
      setItems((prev) => [...prev, ...(page.items ?? [])]);
      setCursor(page.nextCursor ?? null);
      setHasMore(Boolean(page.nextCursor));
      if (page.counts) setCounts(page.counts);
    } catch (error: any) {
      console.error('[usePaginatedQuery] Failed to load more:', error);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [fetchPage, limit, cursor, hasMore, loading]);

  return {
    items,
    loading,
    hasMore,
    cursor,
    counts,
    refresh: refresh as (params: Record<string, unknown>) => Promise<void>,
    loadMore: loadMore as (params: Record<string, unknown>) => Promise<void>,
    setItems,
  };
}
