import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';

interface CachedPost {
  id: string;
  [key: string]: any;
}

interface PostCacheContextType {
  get: (id: string) => CachedPost | undefined;
  set: (id: string, post: CachedPost) => void;
  setBatch: (posts: CachedPost[]) => void;
  clear: () => void;
}

/**
 * A session-long feed cache must be size- and time-bounded. Unbounded maps
 * grow with every scroll and leak across navigations; the cap + TTL below
 * keep memory predictable on long-running sessions without hurting hit rate
 * on the recently-viewed window that users actually revisit.
 */
const MAX_CACHED_POSTS = 500;
const POST_TTL_MS = 5 * 60 * 1000;

interface Entry {
  post: CachedPost;
  expiresAt: number;
}

class BoundedPostCache {
  private store = new Map<string, Entry>();
  constructor(
    private readonly maxSize: number,
    private readonly ttlMs: number
  ) {}

  get(id: string): CachedPost | undefined {
    const hit = this.store.get(id);
    if (!hit) return undefined;
    if (hit.expiresAt <= Date.now()) {
      this.store.delete(id);
      return undefined;
    }
    // Touch for LRU.
    this.store.delete(id);
    this.store.set(id, hit);
    return hit.post;
  }

  set(id: string, post: CachedPost): void {
    if (!id) return;
    if (this.store.has(id)) this.store.delete(id);
    this.store.set(id, { post, expiresAt: Date.now() + this.ttlMs });
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

const PostCacheContext = createContext<PostCacheContextType | undefined>(undefined);

export const PostCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // useRef so the cache instance survives re-renders but doesn't trigger them.
  const cacheRef = useRef<BoundedPostCache | null>(null);
  if (!cacheRef.current) cacheRef.current = new BoundedPostCache(MAX_CACHED_POSTS, POST_TTL_MS);
  const cache = cacheRef.current;

  const get = useCallback((id: string) => cache.get(id), [cache]);
  const set = useCallback((id: string, post: CachedPost) => cache.set(id, post), [cache]);
  const setBatch = useCallback(
    (posts: CachedPost[]) => {
      for (const post of posts) {
        if (post?.id) cache.set(post.id, post);
      }
    },
    [cache]
  );
  const clear = useCallback(() => cache.clear(), [cache]);

  const value = useMemo<PostCacheContextType>(
    () => ({ get, set, setBatch, clear }),
    [get, set, setBatch, clear]
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
