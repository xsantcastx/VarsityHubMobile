// Local REST client wrappers. Swaps out Base44 for a self-hosted API.
import auth from './auth';
import { httpDelete, httpGet, httpPatch, httpPost, httpPostLongTimeout, httpPostWithOptions, httpPut } from './http';

export const User = {
  me: () => auth.me(),
  register: (email: string, password: string, display_name?: string) => auth.register(email, password, display_name),
  loginViaEmailPassword: (email: string, password: string) => auth.login(email, password),
  loginViaGoogle: (idToken: string) => auth.loginWithGoogle(idToken),
  loginViaApple: (identityToken: string) => auth.loginWithApple(identityToken),
  logout: () => auth.logout(),
  updateMe: (data: any) => httpPut('/auth/me', data),
  patchMe: (data: any) => httpPatch('/me', data),
  updatePreferences: (patch: any) => httpPatch('/me/preferences', patch),
  completeOnboarding: (data: any) => httpPost('/me/complete-onboarding', data),
  requestVerification: () => auth.requestEmailVerification(),
  verifyEmail: (code: string) => auth.verifyEmail(code),
  usernameAvailable: (username: string) => httpGet('/users/username-available?username=' + encodeURIComponent(username)),
  lookupByEmail: (email: string) => httpGet('/users/lookup?email=' + encodeURIComponent(email)),
  listAll: async (q?: string, limit: number = 100, banned?: boolean) => {
    try {
      const qq: string[] = [];
      if (q) qq.push('q=' + encodeURIComponent(q));
      if (banned) qq.push('banned=1');
      qq.push('limit=' + String(limit));
      return await httpGet('/users' + (qq.length ? '?' + qq.join('&') : ''));
    } catch (error: any) {
      // If admin-only, return empty array instead of throwing
      if (error?.message?.includes('Admin only') || error?.status === 403) {
        console.log('[User.listAll] Admin-only endpoint, returning empty results');
        return [];
      }
      throw error;
    }
  },
  ban: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.ban] Invalid user ID'); return httpPost('/users/' + encodeURIComponent(id) + '/ban', {}); },
  unban: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.unban] Invalid user ID'); return httpPost('/users/' + encodeURIComponent(id) + '/unban', {}); },
  getFull: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.getFull] Invalid user ID'); return httpGet('/users/' + encodeURIComponent(id) + '/full'); },
  followers: (id: string, cursor?: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.followers] Invalid user ID'); return httpGet(`/users/${encodeURIComponent(id)}/followers` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')); },
  following: (id: string, cursor?: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.following] Invalid user ID'); return httpGet(`/users/${encodeURIComponent(id)}/following` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')); },
  follow: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.follow] Invalid user ID'); return httpPost(`/users/${encodeURIComponent(id)}/follow`, {}); },
  unfollow: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.unfollow] Invalid user ID'); return httpDelete(`/users/${encodeURIComponent(id)}/follow`); },
  postsForProfile: (id: string, opts: { cursor?: string | null; limit?: number; sort?: 'newest' | 'most_upvoted' | 'most_commented' } = {}) => {
    if (!id || id === 'undefined' || id === 'null') throw new Error('[User.postsForProfile] Invalid user ID');
    const q: string[] = [];
    if (typeof opts.limit === 'number') q.push('limit=' + String(opts.limit));
    if (opts.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
    if (opts.sort) q.push('sort=' + encodeURIComponent(opts.sort));
    const qs = q.length ? '?' + q.join('&') : '';
    return httpGet(`/users/${encodeURIComponent(id)}/posts` + qs);
  },
  interactionsForProfile: (id: string, opts: { type?: 'all' | 'like' | 'comment' | 'repost' | 'save'; cursor?: string | null; limit?: number; sort?: 'newest' | 'most_upvoted' | 'most_commented' } = {}) => {
    if (!id || id === 'undefined' || id === 'null') throw new Error('[User.interactionsForProfile] Invalid user ID');
    const q: string[] = [];
    if (opts.type) q.push('type=' + encodeURIComponent(opts.type));
    if (typeof opts.limit === 'number') q.push('limit=' + String(opts.limit));
    if (opts.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
    if (opts.sort) q.push('sort=' + encodeURIComponent(opts.sort));
    const qs = q.length ? '?' + q.join('&') : '';
    return httpGet(`/users/${encodeURIComponent(id)}/interactions` + qs);
  },
  // Password reset helpers (delegates to auth)
  requestPasswordReset: (email: string) => auth.requestPasswordReset(email),
  resetPassword: (email: string, code: string, password: string) => auth.resetPassword(email, code, password),
  // Public profile fetch
  getPublic: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.getPublic] Invalid user ID'); return httpGet('/users/' + encodeURIComponent(id)); },
  // Search users for mentions
  searchForMentions: (query: string, limit: number = 10) => httpGet('/users/search/mentions?q=' + encodeURIComponent(query) + '&limit=' + String(limit)),
  // Lookup user by username
  lookupByUsername: (username: string) => httpGet('/users/lookup?username=' + encodeURIComponent(username)),
  // Block/unblock users
  block: (id: string) => httpPost('/users/' + encodeURIComponent(id) + '/block', {}),
  unblock: (id: string) => httpDelete('/users/' + encodeURIComponent(id) + '/block'),
  blockedUsers: () => httpGet('/users/blocked'),
  // GDPR/CCPA data portability - export all user data as JSON (longer timeout for large exports)
  exportMyData: () => httpGet('/users/me/export', {}, 60000),
};

export const Game = {
  list: (
    sort?: string,
    options?: {
      cursor?: string | null;
      limit?: number;
      lat?: number;
      lng?: number;
      distance?: number;
      dateFrom?: string;
      dateTo?: string;
      approvalStatus?: 'pending' | 'approved' | 'rejected';
      showPending?: boolean;
    }
  ) => {
    const params: string[] = [];
    if (sort) params.push(`sort=${encodeURIComponent(sort)}`);
    if (options?.cursor) params.push(`cursor=${encodeURIComponent(options.cursor)}`);
    if (typeof options?.limit === 'number') params.push(`limit=${encodeURIComponent(String(options.limit))}`);
    if (typeof options?.lat === 'number') params.push(`lat=${encodeURIComponent(String(options.lat))}`);
    if (typeof options?.lng === 'number') params.push(`lng=${encodeURIComponent(String(options.lng))}`);
    if (typeof options?.distance === 'number') params.push(`distance=${encodeURIComponent(String(options.distance))}`);
    if (options?.dateFrom) params.push(`from=${encodeURIComponent(options.dateFrom)}`);
    if (options?.dateTo) params.push(`to=${encodeURIComponent(options.dateTo)}`);
    if (options?.approvalStatus) params.push(`approval_status=${encodeURIComponent(options.approvalStatus)}`);
    if (options?.showPending) params.push('show_pending=true');
    const qs = params.length ? `?${params.join('&')}` : '';
    return httpGet('/games' + qs);
  },
  // Lightweight record fetch used as fallback when summary is unavailable.
  get: (id: string) => httpGet('/games/' + encodeURIComponent(id), {}, 15000, 1),
  // Summary drives the game-details screen critical path.
  // Keep it bounded; caller can fall back to Game.get when unavailable.
  summary: (id: string) => httpGet('/games/' + encodeURIComponent(id) + '/summary', {}, 15000, 1),
  create: (data: any) => httpPost('/games', data),
  delete: (id: string) => httpDelete('/games/' + encodeURIComponent(id)),
  posts: (id: string, options: { limit?: number; cursor?: string } = {}) => {
    const q: string[] = [];
    if (typeof options.limit === 'number') q.push('limit=' + encodeURIComponent(String(options.limit)));
    if (options.cursor) q.push('cursor=' + encodeURIComponent(options.cursor));
    const qs = q.length ? '?' + q.join('&') : '';
    return httpGet(`/games/${encodeURIComponent(id)}/posts` + qs);
  },
  // Media is non-critical for first render; keep this bounded.
  media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`, {}, 15000, 1),
  deleteMedia: (gameId: string, mediaId: string) => httpDelete(`/games/${encodeURIComponent(gameId)}/media/${encodeURIComponent(mediaId)}`),
  votesSummary: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/votes/summary`),
  votesSummaryBatch: (ids: string[]) => {
    if (ids.length === 0) return Promise.resolve({});
    const qs = '?ids=' + ids.map((id) => encodeURIComponent(id)).join(',');
    return httpGet('/games/votes-summary' + qs);
  },
  castVote: (id: string, team: 'A' | 'B') => httpPost(`/games/${encodeURIComponent(id)}/votes`, { team }),
  clearVote: (id: string) => httpDelete(`/games/${encodeURIComponent(id)}/votes`),
  update: (id: string, data: any) => httpPut('/games/' + encodeURIComponent(id), data),
  setApprovalStatus: (id: string, approval: 'approved' | 'rejected') =>
    httpPut(`/games/${encodeURIComponent(id)}/approve`, { approval_status: approval }),
  stories: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/stories`, {}, 15000, 1),
  // Story creation can be slower under server load; allow a longer timeout but avoid retries to prevent duplicates.
  addStory: (id: string, data: { media_url: string; caption?: string; location?: { lat: number; lng: number; source?: 'device' | 'places' | 'zip' | 'derived' } }) =>
    httpPostWithOptions(`/games/${encodeURIComponent(id)}/stories`, data, 45000, 0),
};


const normalizePostItems = (input: any) => {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.items)) return input.items;
  return [] as any[];
};

const normalizePostPage = (input: any) => {
  if (!input) return { items: [] as any[], nextCursor: null, followed_feed_meta: undefined };
  if (Array.isArray(input)) return { items: input, nextCursor: null, followed_feed_meta: undefined };
  return {
    items: Array.isArray(input.items) ? input.items : [],
    nextCursor: typeof input.nextCursor === 'string' ? input.nextCursor : null,
    followed_feed_meta: input.followed_feed_meta ?? undefined,
  };
};



export const Post = {
  list: async (sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    // Non-critical content; avoid long retry storms on weak networks.
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
  filterPage: async (where: { game_id?: string; type?: string; user_id?: string; followed_only?: boolean } = {}, cursor?: string | null, limit: number = 20, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
    if (where.followed_only) q.push('followed_only=true');
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
  // Additional helpers used in UI
  trendingPage: async (cursor?: string | null, limit: number = 20) => {
    try {
      const q: string[] = [];
      if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
      if (limit) q.push('limit=' + String(limit));
      const res = await httpGet('/posts/trending' + (q.length ? '?' + q.join('&') : ''), {}, 12000, 0);
      // normalize to page shape
      return normalizePostPage(res);
    } catch (error: any) {
      // If trending endpoint doesn't exist, fallback to regular posts sorted by created_at
      console.log('[Post.trendingPage] Trending endpoint not available, falling back to recent posts');
      const q: string[] = [];
      if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
      if (limit) q.push('limit=' + String(limit));
      q.push('sort=-created_at'); // Sort by most recent
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
  restore: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/restore`, {}),
  update: (id: string, data: { content?: string; title?: string }) => httpPatch('/posts/' + encodeURIComponent(id), data),
  toggleUpvote: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/upvote`, {}),
  toggleBookmark: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/bookmark`, {}),
  share: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/share`, {}),
  getByEvent: (eventId: string) => httpGet(`/posts?event_id=${encodeURIComponent(eventId)}`),
  createPoll: (id: string, data: { options: string[], expires_at?: string }) => httpPost(`/posts/${encodeURIComponent(id)}/poll`, data),
  voteOnPoll: (id: string, optionId: string) => httpPost(`/posts/${encodeURIComponent(id)}/poll/vote`, { option_id: optionId }),
};

export const Event = {
  create: (data: any) => httpPost('/events', data),
  filter: (where: { status?: string; approval_status?: string; event_type?: string; q?: string; include_cancelled?: boolean } = {}, sort?: string, limit?: number) => {
    const q: string[] = [];
    if (where.status) q.push('status=' + encodeURIComponent(where.status));
    if (where.approval_status) q.push('approval_status=' + encodeURIComponent(where.approval_status));
    if (where.event_type) q.push('event_type=' + encodeURIComponent(where.event_type));
    if (where.include_cancelled) q.push('include_cancelled=true');
    if (where.q) q.push('q=' + encodeURIComponent(where.q));
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (typeof limit === 'number') q.push('limit=' + String(limit));
    return httpGet('/events' + (q.length ? '?' + q.join('&') : ''));
  },
  get: (id: string) => httpGet('/events/' + encodeURIComponent(id)),
  cancel: (id: string) => httpPatch('/events/' + encodeURIComponent(id) + '/cancel'),
  rsvpStatus: (id: string) => httpGet(`/events/${encodeURIComponent(id)}/rsvp`),
  rsvp: (id: string, going?: boolean) => httpPost(`/events/${encodeURIComponent(id)}/rsvp`, typeof going === 'boolean' ? { going } : {}),
  myRsvps: () => httpGet('/events/my-rsvps'),
};

export const Message = {
  list: (sort: string = '-created_at', limit: number = 50) => {
    const q = [`sort=${encodeURIComponent(sort)}`, `limit=${limit}`];
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'If-None-Match': '',
      },
    };
    return httpGet('/messages?' + q.join('&'), options);
  },
  listAll: (limit: number = 200) => httpGet('/messages?all=1&limit=' + String(limit)),
  filter: (_where: any = {}, sort: string = '-created_at') => {
    const options = {
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        'If-None-Match': '',
      },
    };
    return httpGet('/messages?sort=' + encodeURIComponent(sort), options);
  },
  threadByConversation: (conversationId: string, limit: number = 100) => {
    const q = [`conversation_id=${encodeURIComponent(conversationId)}`, `sort=${encodeURIComponent('-created_at')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  threadWith: (email: string, limit: number = 100) => {
    const q = [`with=${encodeURIComponent(email)}`, `sort=${encodeURIComponent('-created_at')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  send: (data: { content: string; conversation_id?: string; recipient_id?: string; recipient_email?: string }) => httpPost('/messages', data),
  markReadByConversation: (conversationId: string) => httpPost('/messages/mark-read', { conversation_id: conversationId }),
  markReadWith: (email: string) => httpPost('/messages/mark-read', { with: email }),
};

// Stubs for future entities
export const Organization = {
  list: (q?: string, limit: number = 50) => {
    const params: string[] = [];
    if (q) params.push('q=' + encodeURIComponent(q));
    if (typeof limit === 'number') params.push('limit=' + encodeURIComponent(String(limit)));
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/organizations' + qs);
  },
  mine: () => httpGet('/organizations/mine'),
  get: (id: string) => httpGet('/organizations/' + encodeURIComponent(id)),
  follow: (id: string) => httpPost(`/organizations/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/organizations/${encodeURIComponent(id)}/follow`),
  members: (id: string) => httpGet(`/organizations/${encodeURIComponent(id)}/members`),
  createOrganization: (data: {
    name: string;
    description?: string;
    sport?: string;
    season_start?: string;
    season_end?: string;
    org_type?: string;
    location?: string;
    formatted_address?: string;
    place_id?: string;
    zip_code?: string;
    latitude?: number;
    longitude?: number;
  }) => httpPost('/organizations', data),
  createWithTeams: (data: any) => httpPost('/organizations/create', data),
  invite: (organizationId: string, email: string, role?: string) => httpPost(`/organizations/${encodeURIComponent(organizationId)}/invite`, { email, role }),
  myInvites: () => httpGet('/organizations/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/decline`, {}),
  // Organization join requests (coach/admin workflows)
  requestToJoin: (organizationId: string, message?: string, role?: string) =>
    httpPost(`/organizations/${encodeURIComponent(organizationId)}/join-requests`, { message, role }),
  getJoinRequests: (organizationId: string, status?: 'pending' | 'approved' | 'rejected') => {
    const params: string[] = [];
    if (status) params.push('status=' + encodeURIComponent(status));
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet(`/organizations/${encodeURIComponent(organizationId)}/join-requests` + qs);
  },
  approveJoinRequest: (requestId: string) => httpPost(`/organizations/join-requests/${encodeURIComponent(requestId)}/approve`, {}),
  rejectJoinRequest: (requestId: string, reason?: string) => httpPost(`/organizations/join-requests/${encodeURIComponent(requestId)}/reject`, { reason }),
};

export const Team = {
  list: (q?: string, mine?: boolean, options?: { directory?: boolean; limit?: number }) => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    if (mine) params.push('mine=1');
    if (options?.directory) params.push('directory=1');
    if (typeof options?.limit === 'number') params.push(`limit=${String(options.limit)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/teams' + qs);
  },
  managed: (q?: string) => {
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/teams/managed' + qs);
  },
  get: (id: string) => httpGet('/teams/' + encodeURIComponent(id)),
  follow: (id: string) => httpPost(`/teams/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/teams/${encodeURIComponent(id)}/follow`),
  members: (id: string) => httpGet(`/teams/${encodeURIComponent(id)}/members`),
  allMembers: (q?: string) => httpGet('/teams/members/all' + (q ? `?q=${encodeURIComponent(q)}` : '')),
  create: (data: {
    name: string;
    description?: string;
    sport?: string;
    season?: string;
    season_start?: string;
    season_end?: string;
    organization_id?: string;
    organization_name?: string;
    logo_url?: string | null;
    authorized_users?: Array<{ email?: string; user_id?: string; role?: string; assign_team?: string }>;
  }) => {
    const payload: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'logo_url') {
        if (typeof value === 'string' && value.length > 0) {
          payload.logo_url = value;
        }
        return;
      }
      payload[key] = value;
    });
    return httpPost('/teams/create', payload);
  },
  createBasic: (data: { name: string; description?: string }) => httpPost('/teams', data),
  update: (id: string, data: {
    name?: string;
    description?: string;
    sport?: string;
    season?: string;
    organization_id?: string | null;
    logo_url?: string | null;
  }) => {
    const payload: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined) return;
      if (key === 'logo_url' && value === null) {
        payload[key] = '';
      } else {
        payload[key] = value;
      }
    });
    return httpPut('/teams/' + encodeURIComponent(id), payload);
  },
  invite: (teamId: string, email: string, role?: string) => httpPost(`/teams/${encodeURIComponent(teamId)}/invite`, { email, role }),
  myInvites: () => httpGet('/teams/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/decline`, {}),
  updateMember: (
    teamId: string,
    userId: string,
    data: { role?: string; custom_position?: string | null }
  ) => httpPatch(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, data),
  removeMember: (teamId: string, userId: string, reason?: string) =>
    httpDelete(`/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, reason ? { reason } : undefined),
  delete: (id: string) => httpDelete('/teams/' + encodeURIComponent(id)),
  limits: () => httpGet('/teams/limits'),
};

export const Support = {
  contact: (data: { name: string; email: string; subject: string; message: string; from_email?: string }) => httpPost('/support/contact', data),
  feedback: (data: { user_id?: string; category: 'bug' | 'idea' | 'other'; message: string; screenshot_url?: string }) => httpPost('/support/feedback', data),
};

async function getPaymentsConfig(): Promise<{
  stripe_publishable_key: string;
  available_plans: any[];
  payments_enabled: boolean;
  stripe_configured: boolean;
  has_webhook_secret: boolean;
}> {
  try {
    return await httpGet('/payments/config');
  } catch (err: any) {
    if (err?.status === 404) {
      try {
        const health = await httpGet('/health?include=payments');
        const cfg = (health as any)?.payments_config;
        if (cfg) return cfg;
      } catch {
        // Health may not support include=payments (old server) - fall through to throw original
      }
    }
    throw err;
  }
}

export const Payments = {
  configStatus: getPaymentsConfig,
  getConfig: getPaymentsConfig,
};

export const Subscriptions = {
  createCheckout: (plan: string, teamCount?: number) => httpPost('/payments/checkout', { plan, team_count: teamCount }),
  finalizeSession: (sessionId: string) => httpPost('/payments/finalize-session', { session_id: sessionId }),
  cancel: () => httpPost('/payments/subscription/cancel', {}),
  updateQuantity: (teamCount: number) => httpPost('/payments/update-subscription-quantity', { team_count: teamCount }),
  getSummary: () => httpGet('/payments/subscription/summary'),
};


export const TeamMemberships = {
  create: (data: { team_id: string; user_id: string; role?: string }) => httpPost('/team-memberships', data),
  update: (membershipId: string, data: { role?: string; custom_position?: string }) => httpPatch(`/team-memberships/${encodeURIComponent(membershipId)}`, data),
  delete: (membershipId: string) => httpDelete(`/team-memberships/${encodeURIComponent(membershipId)}`),
};

export const TeamInvites = {
  create: (data: { team_id: string; email: string; role?: string }) => httpPost('/team-invites', data),
};

export const Notification = {
  listPage: async (cursor?: string | null, limit: number = 20, unreadOnly: boolean = false) => {
    try {
      const params: string[] = [];
      params.push('limit=' + encodeURIComponent(String(limit)));
      if (cursor) params.push('cursor=' + encodeURIComponent(cursor));
      if (unreadOnly) params.push('unread=1');
      const qs = params.length ? '?' + params.join('&') : '';
      // Use shorter timeout for notification polling (10 seconds)
      const timeout = limit === 1 && unreadOnly ? 10000 : 30000;
      // Polling endpoint: do not retry aggressively.
      return await httpGet('/notifications' + qs, {}, timeout, 0);
    } catch (error: any) {
      // If unauthorized (not logged in), return empty page
      if (error?.message?.includes('Unauthorized') || error?.status === 401) {
        if (__DEV__) console.log('[Notification.listPage] Not authenticated, returning empty results');
        return { items: [], cursor: null, nextCursor: null };
      }
      // If timeout or network error, return empty page for polling requests
      if (limit === 1 && unreadOnly && (error?.message?.includes('timeout') || error?.message?.includes('Aborted'))) {
        if (__DEV__) console.warn('[Notification.listPage] Poll timeout, returning empty results');
        return { items: [], cursor: null, nextCursor: null };
      }
      throw error;
    }
  },
  markRead: (id: string) => httpPost(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllRead: () => httpPost('/notifications/mark-read-all', {}),
};

export const CollaborativePost = {} as any;
export const EventPost = {} as any;
export const FreelancerBooking = {} as any;
export const UserInteraction = {} as any;
export const SponsorshipBid = {} as any;
export const EventSponsorship = {} as any;
export const SchoolPage = {} as any;
export const Advertisement = {
  reservedDates: (from?: string, to?: string) => {
    const q: string[] = [];
    if (from) q.push('from=' + encodeURIComponent(from));
    if (to) q.push('to=' + encodeURIComponent(to));
    return httpGet('/ads/reservations' + (q.length ? '?' + q.join('&') : ''));
  },
  reservationsForAd: (ad_id: string) => httpGet('/ads/reservations?ad_id=' + encodeURIComponent(ad_id)),
  reserve: (ad_id: string, dates: string[]) => httpPost('/ads/reservations', { ad_id, dates }),
  create: (data: any) => httpPost('/ads', data),
  listMine: () => httpGet('/ads?mine=1'),
  listAll: () => httpGet('/ads?all=1'),
  get: (id: string) => httpGet('/ads/' + encodeURIComponent(id)),
  update: (id: string, data: any) => httpPut('/ads/' + encodeURIComponent(id), data),
  delete: (id: string) => httpDelete('/ads/' + encodeURIComponent(id)),
  forFeed: (dateISO?: string, zip?: string, limit: number = 1) => {
    const q: string[] = [];
    if (dateISO) q.push('date=' + encodeURIComponent(dateISO));
    if (zip) q.push('zip=' + encodeURIComponent(zip));
    if (limit) q.push('limit=' + String(limit));
    return httpGet('/ads/for-feed' + (q.length ? '?' + q.join('&') : ''));
  },
};

export const Search = {
  unified: (q: string, limit: number = 10) => {
    const params = new URLSearchParams();
    params.set('q', q);
    if (limit) params.set('limit', String(limit));
    return httpGet('/search?' + params.toString());
  },
};

export const Highlights = {
  fetch: (params: { country?: string; lat?: number; lng?: number; limit?: number } = {}) => {
    const q: string[] = [];
    q.push('v2=1');
    if (params.country) q.push('country=' + encodeURIComponent(params.country));
    if (typeof params.lat === 'number') q.push('lat=' + encodeURIComponent(String(params.lat)));
    if (typeof params.lng === 'number') q.push('lng=' + encodeURIComponent(String(params.lng)));
    if (params.limit) q.push('limit=' + encodeURIComponent(String(params.limit)));
    return httpGet('/highlights' + (q.length ? '?' + q.join('&') : ''));
  },
};
