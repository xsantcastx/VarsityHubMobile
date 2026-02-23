import { User } from '@/api/entities';
import { useCallback, useState } from 'react';
import { usePaginatedQuery } from './usePaginatedQuery';
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
 */
export function useProfileInteractions(
  sort: InteractionSort = 'newest',
  initialType: InteractionType = 'all'
): UseProfileInteractionsResult {
  const [type, setType] = useState<InteractionType>(initialType);

  const fetchPage = useCallback(
    async (params: { userId: string }, opts: { limit: number; cursor?: string | null }) => {
      const page = await User.interactionsForProfile(String(params.userId), {
        limit: opts.limit,
        type,
        sort,
        cursor: opts.cursor ?? undefined,
      });
      return {
        items: page.items ?? [],
        nextCursor: page.nextCursor ?? null,
        counts: page.counts ?? null,
      };
    },
    [type, sort]
  );

  const result = usePaginatedQuery<unknown, { userId: string }>(fetchPage, { limit: 10 });

  return {
    interactions: result.items as any[],
    loading: result.loading,
    hasMore: result.hasMore,
    cursor: result.cursor,
    counts: result.counts as PostsCounts | null,
    type,
    setType,
    refresh: (userId: string) => result.refresh({ userId }),
    loadMore: (userId: string) => result.loadMore({ userId }),
  };
}
