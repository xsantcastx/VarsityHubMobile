import React, { createContext, useContext, useCallback } from 'react';

interface CachedPost {
  id: string;
  [key: string]: any;
}

interface PostCacheContextType {
  cache: Map<string, CachedPost>;
  get: (id: string) => CachedPost | undefined;
  set: (id: string, post: CachedPost) => void;
  setBatch: (posts: CachedPost[]) => void;
  clear: () => void;
}

const PostCacheContext = createContext<PostCacheContextType | undefined>(undefined);

export const PostCacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cache] = React.useState(new Map<string, CachedPost>());

  const get = useCallback(
    (id: string) => {
      return cache.get(id);
    },
    [cache]
  );

  const set = useCallback(
    (id: string, post: CachedPost) => {
      cache.set(id, post);
    },
    [cache]
  );

  const setBatch = useCallback(
    (posts: CachedPost[]) => {
      posts.forEach(post => {
        if (post?.id) {
          cache.set(post.id, post);
        }
      });
    },
    [cache]
  );

  const clear = useCallback(() => {
    cache.clear();
  }, [cache]);

  const value: PostCacheContextType = {
    cache,
    get,
    set,
    setBatch,
    clear,
  };

  return <PostCacheContext.Provider value={value}>{children}</PostCacheContext.Provider>;
};

export const usePostCache = () => {
  const context = useContext(PostCacheContext);
  if (!context) {
    throw new Error('usePostCache must be used within PostCacheProvider');
  }
  return context;
};
