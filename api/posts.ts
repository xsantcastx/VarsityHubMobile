import { httpDelete, httpGet, httpPatch, httpPost, httpPostLongTimeout } from './http';

const normalizePostItems = (input: any) => {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.items)) return input.items;
  return [] as any[];
};

const normalizePostPage = (input: any) => {
  if (!input) return { items: [] as any[], nextCursor: null, followed_feed_meta: undefined, followed_teams_feed_meta: undefined };
  if (Array.isArray(input)) return { items: input, nextCursor: null, followed_feed_meta: undefined, followed_teams_feed_meta: undefined };
  return {
    items: Array.isArray(input.items) ? input.items : [],
    nextCursor: typeof input.nextCursor === 'string' ? input.nextCursor : null,
    followed_feed_meta: input.followed_feed_meta ?? undefined,
    followed_teams_feed_meta: input.followed_teams_feed_meta ?? undefined,
  };
};

export const Post = {
  list: async (sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''), {}, 15000, 1);
    return normalizePostItems(res);
  },
  create: (data: any) => httpPostLongTimeout('/posts', data),
  filter: async (where: { game_id?: string; type?: string; user_id?: string } = {}, sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
    return normalizePostItems(res);
  },
  count: (where: { game_id?: string; type?: string } = {}) => {
    const q: string[] = [];
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    return httpGet('/posts/count' + (q.length ? '?' + q.join('&') : ''));
  },
  listPage: async (cursor?: string | null, limit: number = 10, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
    return normalizePostPage(res);
  },
  filterPage: async (where: { game_id?: string; type?: string; user_id?: string; followed_only?: boolean; followed_teams?: boolean } = {}, cursor?: string | null, limit: number = 20, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
    if (where.followed_only) q.push('followed_only=true');
    if (where.followed_teams) q.push('followed_teams=true');
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
    return normalizePostPage(res);
  },
  feedForGame: async (gameId: string, options: { cursor?: string | null; limit?: number; sort?: string } = {}) => {
    const q: string[] = [];
    q.push('game_id=' + encodeURIComponent(gameId));
    const sortValue = options.sort || 'trending';
    if (sortValue) q.push('sort=' + encodeURIComponent(sortValue));
    const limitValue = typeof options.limit === 'number' ? options.limit : 10;
    if (limitValue) q.push('limit=' + String(limitValue));
    if (options.cursor) q.push('cursor=' + encodeURIComponent(options.cursor));
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''), {}, 15000, 1);
    return normalizePostPage(res);
  },
  trendingPage: async (cursor?: string | null, limit: number = 20) => {
    try {
      const q: string[] = [];
      if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
      if (limit) q.push('limit=' + String(limit));
      const res = await httpGet('/posts/trending' + (q.length ? '?' + q.join('&') : ''), {}, 12000, 0);
      return normalizePostPage(res);
    } catch (error: any) {
      if (__DEV__) console.log('[Post.trendingPage] Trending endpoint not available, falling back to recent posts');
      const q: string[] = [];
      if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
      if (limit) q.push('limit=' + String(limit));
      q.push('sort=-created_at');
      try {
        const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''), {}, 12000, 0);
        return normalizePostPage(res);
      } catch (_fallbackError) {
        return { items: [], nextCursor: null };
      }
    }
  },
  createCollage: (data: any) => httpPost('/posts/collage', data),
  get: (id: string) => httpGet('/posts/' + encodeURIComponent(id)),
  comments: (id: string) => httpGet(`/posts/${encodeURIComponent(id)}/comments`),
  addComment: (id: string, content: string, parentId?: string) =>
    httpPost(`/posts/${encodeURIComponent(id)}/comments`, { content, ...(parentId ? { parent_id: parentId } : {}) }),
  deleteComment: (postId: string, commentId: string) => httpDelete(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
  updateComment: (postId: string, commentId: string, content: string) => httpPatch(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { content }),
  delete: (id: string) => httpDelete('/posts/' + encodeURIComponent(id)),
  update: (id: string, data: { content?: string; title?: string }) => httpPatch('/posts/' + encodeURIComponent(id), data),
  toggleUpvote: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/upvote`, {}),
  toggleBookmark: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/bookmark`, {}),
  share: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/share`, {}),
  getByEvent: (eventId: string) => httpGet(`/posts?event_id=${encodeURIComponent(eventId)}`),
  createPoll: (id: string, data: { options: string[], expires_at?: string }) => httpPost(`/posts/${encodeURIComponent(id)}/poll`, data),
  voteOnPoll: (id: string, optionId: string) => httpPost(`/posts/${encodeURIComponent(id)}/poll/vote`, { option_id: optionId }),
};
