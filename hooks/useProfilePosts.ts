import { User } from '@/api/entities';
import { useCallback, useRef, useState } from 'react';

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
 * Includes request-in-flight guards to prevent duplicate fetches
 */
export function useProfilePosts(sort: 'newest' | 'most_upvoted' | 'most_commented' = 'newest'): UseProfilePostsResult {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState<PostsCounts | null>(null);
  const requestInFlight = useRef(false);

  const refresh = useCallback(async (userId: string) => {
    // Prevent concurrent requests
    if (requestInFlight.current) return;
    // Guard against undefined/null user IDs
    if (!userId || userId === 'undefined' || userId === 'null') {
      if (__DEV__) console.warn('[useProfilePosts] Skipping refresh — invalid userId:', userId);
      return;
    }
    
    requestInFlight.current = true;
    setLoading(true);

    try {
      const page = await User.postsForProfile(String(userId), { limit: 10, sort });
      
      setPosts(page.items || []);
      setCursor(page.nextCursor || null);
      setHasMore(Boolean(page.nextCursor));
      
      if (page.counts) {
        setCounts(page.counts);
      }
    } catch (error: any) {
      console.error('[useProfilePosts] Failed to refresh posts:', error);
      // Don't throw - let parent handle via error state
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [sort]);

  const loadMore = useCallback(async (userId: string) => {
    if (loading || !hasMore || requestInFlight.current) return;
    if (!userId || userId === 'undefined' || userId === 'null') return;

    requestInFlight.current = true;
    setLoading(true);

    try {
      const page = await User.postsForProfile(String(userId), {
        limit: 10,
        sort,
        cursor: cursor || undefined,
      });

      setPosts((prev) => [...prev, ...(page.items || [])]);
      setCursor(page.nextCursor || null);
      setHasMore(Boolean(page.nextCursor));

      if (page.counts) {
        setCounts(page.counts);
      }
    } catch (error: any) {
      console.error('[useProfilePosts] Failed to load more posts:', error);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [cursor, hasMore, loading, sort]);

  return {
    posts,
    loading,
    hasMore,
    cursor,
    counts,
    refresh,
    loadMore,
    setPosts,
  };
}
