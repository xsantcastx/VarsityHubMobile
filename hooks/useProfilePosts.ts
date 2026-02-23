import { User } from '@/api/entities';
import { useCallback } from 'react';
import { usePaginatedQuery } from './usePaginatedQuery';

export interface PostsCounts {
  posts: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
}

export interface UseProfilePostsResult {
  posts: any[];
  loading: boolean;
  hasMore: boolean;
  cursor: string | null;
  counts: PostsCounts | null;
  refresh: (userId: string) => Promise<void>;
  loadMore: (userId: string) => Promise<void>;
  setPosts: React.Dispatch<React.SetStateAction<any[]>>;
}

/**
 * Hook for managing user's posts with pagination
 */
export function useProfilePosts(sort: 'newest' | 'most_upvoted' | 'most_commented' = 'newest'): UseProfilePostsResult {
  const fetchPage = useCallback(
    async (params: { userId: string }, opts: { limit: number; cursor?: string | null }) => {
      const page = await User.postsForProfile(String(params.userId), {
        limit: opts.limit,
        sort,
        cursor: opts.cursor ?? undefined,
      });
      return {
        items: page.items ?? [],
        nextCursor: page.nextCursor ?? null,
        counts: page.counts ?? null,
      };
    },
    [sort]
  );

  const result = usePaginatedQuery<unknown, { userId: string }>(fetchPage, { limit: 10 });

  return {
    posts: result.items as any[],
    loading: result.loading,
    hasMore: result.hasMore,
    cursor: result.cursor,
    counts: result.counts as PostsCounts | null,
    refresh: (userId: string) => result.refresh({ userId }),
    loadMore: (userId: string) => result.loadMore({ userId }),
    setPosts: result.setItems as React.Dispatch<React.SetStateAction<any[]>>,
  };
}
