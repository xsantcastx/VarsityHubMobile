import { useCallback, useRef, useState } from 'react';

export interface PaginationState<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface PaginationOptions {
  limit?: number;
  onError?: (error: Error) => void;
  onCountsUpdate?: (counts: any) => void;
}

/**
 * Reusable pagination hook for managing paginated data with cursor-based pagination.
 * Prevents duplicate concurrent requests automatically.
 *
 * @template T The type of items being paginated
 * @param fetchFn Async function that returns { items, nextCursor, counts }
 * @param options Configuration options
 * @returns Pagination state and control functions
 *
 * @example
 * const { items, isLoading, hasMore, loadMore } = usePagination(
 *   (cursor) => User.postsForProfile(userId, { cursor, limit: 10 }),
 *   { limit: 10 }
 * );
 */
export function usePagination<T>(
  fetchFn: (cursor: string | null | undefined) => Promise<{
    items: T[];
    nextCursor: string | null;
    counts?: any;
  }>,
  options: PaginationOptions = {}
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent duplicate concurrent requests
  const requestInFlightRef = useRef(false);

  /**
   * Load first page of results (resets pagination)
   */
  const refresh = useCallback(async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const page = await fetchFn(null);
      setItems(page.items || []);
      setCursor(page.nextCursor || null);
      setHasMore(Boolean(page.nextCursor));
      if (page.counts) options.onCountsUpdate?.(page.counts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
      options.onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [fetchFn, options]);

  /**
   * Load next page and append to items
   */
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const page = await fetchFn(cursor || undefined);
      setItems((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.nextCursor || null);
      setHasMore(Boolean(page.nextCursor));
      if (page.counts) options.onCountsUpdate?.(page.counts);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load more';
      setError(message);
      options.onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [fetchFn, cursor, hasMore, isLoading, options]);

  /**
   * Reset pagination state
   */
  const reset = useCallback(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    items,
    cursor,
    hasMore,
    isLoading,
    error,
    refresh,
    loadMore,
    reset,
  };
}
