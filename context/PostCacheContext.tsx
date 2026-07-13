import React, { createContext, useContext, useCallback, useMemo, useRef, useEffect } from 'react';

const MAX_CACHE_SIZE = 500;

interface CachedPost {
  id: string;
  [key: string]: any;
}

interface PostCacheContextType {
  cache: Map<string, CachedPost>;
  get: (id: string) => CachedPost | undefined;
  set: (id: string, post: CachedPost) => void;
  setBatch: (posts: CachedPost[]) => void;
  remove: (id: string) => void;
  invalidate: (id: string) => void;
  clear: () => void;
}

const PostCacheContext = createContext<PostCacheContextType | undefined>(undefined);

// Module-level ref so clearPostCacheOnLogout can reach the active cache
let activeCacheRef: Map<string, CachedPost> | null = null;

/**
 * Call this from signOut to wipe the post cache without needing useAuth inside the provider.
 * Import: `import { clearPostCacheOnLogout } from '@/context/PostCacheContext';`
 */
export function clearPostCacheOnLogout() {
  activeCacheRef?.clear();
}

/** Evict oldest entries when cache exceeds MAX_CACHE_SIZE */
function evictIfNeeded(cache: Map<string, CachedPost>) {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const excess = cache.size - MAX_CACHE_SIZE;
  const iter = cache.keys();
  for (let i = 0; i < excess; i++) {
    const key = iter.next().value;
    if (key !== undefined) cache.delete(key);
  }
}

export const PostCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cache] = React.useState(new Map<string, CachedPost>());

  // Keep module-level ref in sync with the active cache instance
  useEffect(() => {
    activeCacheRef = cache;
    return () => {
      activeCacheRef = null;
    };
  }, [cache]);

  const get = useCallback(
    (id: string) => {
      return cache.get(id);
    },
    [cache]
  );

  const set = useCallback(
    (id: string, post: CachedPost) => {
      // Delete-then-set to move the key to the end (most recent) for eviction ordering
      cache.delete(id);
      cache.set(id, post);
      evictIfNeeded(cache);
    },
    [cache]
  );

  const setBatch = useCallback(
    (posts: CachedPost[]) => {
      posts.forEach(post => {
        if (post?.id) {
          cache.delete(post.id);
          cache.set(post.id, post);
        }
      });
      evictIfNeeded(cache);
    },
    [cache]
  );

  const remove = useCallback(
    (id: string) => {
      cache.delete(id);
    },
    [cache]
  );

  /** Alias for remove — drops a single post so the next fetch gets fresh data */
  const invalidate = useCallback(
    (id: string) => {
      cache.delete(id);
    },
    [cache]
  );

  const clear = useCallback(() => {
    cache.clear();
  }, [cache]);

  const value = useMemo<PostCacheContextType>(
    () => ({
      cache,
      get,
      set,
      setBatch,
      remove,
      invalidate,
      clear,
    }),
    [cache, get, set, setBatch, remove, invalidate, clear]
  );

  return <PostCacheContext.Provider value={value}>{children}</PostCacheContext.Provider>;
};

export const usePostCache = () => {
  const context = useContext(PostCacheContext);
  if (!context) {
    throw new Error('usePostCache must be used within PostCacheProvider');
  }
  return context;
};
