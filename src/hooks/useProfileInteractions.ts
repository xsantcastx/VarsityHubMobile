import { User } from '@/api/entities';
import { useCallback, useRef, useState } from 'react';
import type { PostsCounts } from './useProfilePosts';

export type InteractionType = 'all' | 'like' | 'comment' | 'repost' | 'save';
export type InteractionSort = 'newest' | 'most_upvoted' | 'most_commented';

export interface UseProfileInteractionsResult {
  interactions: any[];
  loading: boolean;
  hasMore: boolean;
  cursor: string | null;
  counts: PostsCounts | null;
  type: InteractionType;
  setType: (type: InteractionType) => void;
  refresh: (userId: string) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
}

/**
 * Hook for managing user's interactions (likes, comments, etc.) with pagination
 * Includes filtering by interaction type and request-in-flight guards
 */
export function useProfileInteractions(
  sort: InteractionSort = 'newest',
  initialType: InteractionType = 'all'
): UseProfileInteractionsResult {
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState<PostsCounts | null>(null);
  const [type, setType] = useState<InteractionType>(initialType);
  const requestInFlight = useRef(false);

  const refresh = useCallback(
    async (userId: string) => {
      // Prevent concurrent requests
      if (requestInFlight.current) return;
      // Guard against undefined/null user IDs
      if (!userId || userId === 'undefined' || userId === 'null') {
        if (__DEV__)
          console.warn('[useProfileInteractions] Skipping refresh — invalid userId:', userId);
        return;
      }

      requestInFlight.current = true;
      setLoading(true);

      try {
        const page = await User.interactionsForProfile(String(userId), {
          limit: 10,
          type,
          sort,
        });

        setInteractions(page.items || []);
        setCursor(page.nextCursor || null);
        setHasMore(Boolean(page.nextCursor));

        if (page.counts) {
          setCounts(page.counts);
        }
      } catch (error: any) {
        console.error('[useProfileInteractions] Failed to refresh interactions:', error);
        // Don't throw - let parent handle via error state
      } finally {
        requestInFlight.current = false;
        setLoading(false);
      }
    },
    [type, sort]
  );

  const loadMore = useCallback(
    async (userId: string) => {
      if (loading || !hasMore || requestInFlight.current) return;
      if (!userId || userId === 'undefined' || userId === 'null') return;

      requestInFlight.current = true;
      setLoading(true);

      try {
        const page = await User.interactionsForProfile(String(userId), {
          limit: 10,
          type,
          sort,
          cursor: cursor || undefined,
        });

        setInteractions(prev => [...prev, ...(page.items || [])]);
        setCursor(page.nextCursor || null);
        setHasMore(Boolean(page.nextCursor));

        if (page.counts) {
          setCounts(page.counts);
        }
      } catch (error: any) {
        console.error('[useProfileInteractions] Failed to load more interactions:', error);
      } finally {
        requestInFlight.current = false;
        setLoading(false);
      }
    },
    [cursor, hasMore, loading, type, sort]
  );

  return {
    interactions,
    loading,
    hasMore,
    cursor,
    counts,
    type,
    setType,
    refresh,
    loadMore,
  };
}
