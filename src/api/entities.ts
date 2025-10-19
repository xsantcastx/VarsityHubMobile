// Local REST client wrappers. Swaps out Base44 for a self-hosted API.
import auth from './auth';
import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from './http';

export const User = {
  me: () => auth.me(),
  register: (email: string, password: string, display_name?: string) => auth.register(email, password, display_name),
  loginViaEmailPassword: (email: string, password: string) => auth.login(email, password),
  loginViaGoogle: (idToken: string) => auth.loginWithGoogle(idToken),
  logout: () => auth.logout(),
  updateMe: (data: any) => httpPut('/auth/me', data),
  patchMe: (data: any) => httpPatch('/me', data),
  updatePreferences: (patch: any) => httpPatch('/me/preferences', patch),
  completeOnboarding: (data: any) => httpPost('/me/complete-onboarding', data),
  requestVerification: () => auth.requestEmailVerification(),
  verifyEmail: (code: string) => auth.verifyEmail(code),
  usernameAvailable: (username: string) => httpGet('/users/username-available?username=' + encodeURIComponent(username)),
  lookupByEmail: (email: string) => httpGet('/users/lookup?email=' + encodeURIComponent(email)),
  listAll: (q?: string, limit: number = 100, banned?: boolean) => {
    const qq: string[] = [];
    if (q) qq.push('q=' + encodeURIComponent(q));
    if (banned) qq.push('banned=1');
    qq.push('limit=' + String(limit));
    return httpGet('/users' + (qq.length ? '?' + qq.join('&') : ''));
  },
  ban: (id: string) => httpPost('/users/' + encodeURIComponent(id) + '/ban', {}),
  unban: (id: string) => httpPost('/users/' + encodeURIComponent(id) + '/unban', {}),
  getFull: (id: string) => httpGet('/users/' + encodeURIComponent(id) + '/full'),
  followers: (id: string, cursor?: string) => httpGet(`/users/${encodeURIComponent(id)}/followers` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')),
  following: (id: string, cursor?: string) => httpGet(`/users/${encodeURIComponent(id)}/following` + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : '')),
  follow: (id: string) => httpPost(`/users/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/users/${encodeURIComponent(id)}/follow`),
  postsForProfile: (id: string, opts: { cursor?: string | null; limit?: number; sort?: 'newest' | 'most_upvoted' | 'most_commented' } = {}) => {
    const q: string[] = [];
    if (typeof opts.limit === 'number') q.push('limit=' + String(opts.limit));
    if (opts.cursor) q.push('cursor=' + encodeURIComponent(opts.cursor));
    if (opts.sort) q.push('sort=' + encodeURIComponent(opts.sort));
    const qs = q.length ? '?' + q.join('&') : '';
    return httpGet(`/users/${encodeURIComponent(id)}/posts` + qs);
  },
  interactionsForProfile: (id: string, opts: { type?: 'all' | 'like' | 'comment' | 'repost' | 'save'; cursor?: string | null; limit?: number; sort?: 'newest' | 'most_upvoted' | 'most_commented' } = {}) => {
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
  getPublic: (id: string) => httpGet('/users/' + encodeURIComponent(id)),
  // Search users for mentions
  searchForMentions: (query: string, limit: number = 10) => httpGet('/users/search/mentions?q=' + encodeURIComponent(query) + '&limit=' + String(limit)),
};

export const Game = {
  list: (sort?: string) => httpGet('/games' + (sort ? `?sort=${encodeURIComponent(sort)}` : '')),
  get: (id: string) => httpGet('/games/' + encodeURIComponent(id)),
  summary: (id: string) => httpGet('/games/' + encodeURIComponent(id) + '/summary'),
  create: (data: any) => httpPost('/games', data),
  delete: (id: string) => httpDelete('/games/' + encodeURIComponent(id)),
  posts: (id: string, options: { limit?: number; cursor?: string } = {}) => {
    const q: string[] = [];
    if (typeof options.limit === 'number') q.push('limit=' + encodeURIComponent(String(options.limit)));
    if (options.cursor) q.push('cursor=' + encodeURIComponent(options.cursor));
    const qs = q.length ? '?' + q.join('&') : '';
    return httpGet(`/games/${encodeURIComponent(id)}/posts` + qs);
  },
  media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`),
  deleteMedia: (gameId: string, mediaId: string) => httpDelete(`/games/${encodeURIComponent(gameId)}/media/${encodeURIComponent(mediaId)}`),
  votesSummary: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/votes/summary`),
  castVote: (id: string, team: 'A' | 'B') => httpPost(`/games/${encodeURIComponent(id)}/votes`, { team }),
  clearVote: (id: string) => httpDelete(`/games/${encodeURIComponent(id)}/votes`),
  update: (id: string, data: any) => httpPut('/games/' + encodeURIComponent(id), data),
  stories: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/stories`),
  addStory: (id: string, data: { media_url: string; caption?: string }) => httpPost(`/games/${encodeURIComponent(id)}/stories`, data),
};


const normalizePostItems = (input: any) => {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.items)) return input.items;
  return [] as any[];
};

const normalizePostPage = (input: any) => {
  if (!input) return { items: [] as any[], nextCursor: null };
  if (Array.isArray(input)) return { items: input, nextCursor: null };
  return {
    items: Array.isArray(input.items) ? input.items : [],
    nextCursor: typeof input.nextCursor === 'string' ? input.nextCursor : null,
  };
};



export const Post = {
  list: async (sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
    return normalizePostItems(res);
  },
  create: (data: any) => httpPost('/posts', data),
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
  filterPage: async (where: { game_id?: string; type?: string; user_id?: string } = {}, cursor?: string | null, limit: number = 20, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
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
    const res = await httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
    return normalizePostPage(res);
  },
  // Additional helpers used in UI
  trendingPage: async (cursor?: string | null, limit: number = 20) => {
    const q: string[] = [];
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    if (limit) q.push('limit=' + String(limit));
    const res = await httpGet('/posts/trending' + (q.length ? '?' + q.join('&') : ''));
    // normalize to page shape
    return normalizePostPage(res);
  },
  createCollage: (data: any) => httpPost('/posts/collage', data),
  get: (id: string) => httpGet('/posts/' + encodeURIComponent(id)),
  comments: (id: string) => httpGet(`/posts/${encodeURIComponent(id)}/comments`),
  addComment: (id: string, content: string) => httpPost(`/posts/${encodeURIComponent(id)}/comments`, { content }),
  deleteComment: (postId: string, commentId: string) => httpDelete(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`),
  updateComment: (postId: string, commentId: string, content: string) => httpPatch(`/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { content }),
  delete: (id: string) => httpDelete('/posts/' + encodeURIComponent(id)),
  update: (id: string, data: { content?: string; title?: string }) => httpPatch('/posts/' + encodeURIComponent(id), data),
  toggleUpvote: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/upvote`, {}),
  toggleBookmark: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/bookmark`, {}),
};

export const Event = {
  filter: (where: any = {}, sort?: string) => {
    const q: string[] = [];
    if (where.status) q.push('status=' + encodeURIComponent(where.status));
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    return httpGet('/events' + (q.length ? '?' + q.join('&') : ''));
  },
  get: (id: string) => httpGet('/events/' + encodeURIComponent(id)),
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
  send: (data: { content: string; conversation_id?: string; recipient_email?: string }) => httpPost('/messages', data),
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
  get: (id: string) => httpGet('/organizations/' + encodeURIComponent(id)),
  members: (id: string) => httpGet(`/organizations/${encodeURIComponent(id)}/members`),
  createOrganization: (data: { name: string; description?: string; sport?: string; season_start?: string; season_end?: string }) => httpPost('/organizations', data),
  createWithTeams: (data: any) => httpPost('/organizations/create', data),
  invite: (organizationId: string, email: string, role?: string) => httpPost(`/organizations/${encodeURIComponent(organizationId)}/invite`, { email, role }),
  myInvites: () => httpGet('/organizations/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/organizations/invites/${encodeURIComponent(inviteId)}/decline`, {}),
};

export const Team = {
  list: (q?: string, mine?: boolean) => {
    if (mine) {
      // Use dedicated managed teams endpoint
      const params: string[] = [];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      const qs = params.length ? '?' + params.join('&') : '';
      return httpGet('/teams/managed' + qs);
    }
    
    const params: string[] = [];
    if (q) params.push(`q=${encodeURIComponent(q)}`);
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
  delete: (id: string) => httpDelete('/teams/' + encodeURIComponent(id)),
};

export const Support = {
  contact: (data: { name: string; email: string; subject: string; message: string }) => httpPost('/support/contact', data),
  feedback: (data: { user_id?: string; category: 'bug' | 'idea' | 'other'; message: string; screenshot_url?: string }) => httpPost('/support/feedback', data),
};

export const Subscriptions = {
  createCheckout: (plan: string) => httpPost('/payments/checkout', { plan }),
  finalizeSession: (sessionId: string) => httpPost('/payments/finalize-session', { session_id: sessionId }),
  cancel: () => httpPost('/payments/subscription/cancel', {}),
};


export const TeamMemberships = {
  create: (data: { team_id: string; user_id: string; role?: string }) => httpPost('/team-memberships', data),
};

export const TeamInvites = {
  create: (data: { team_id: string; email: string; role?: string }) => httpPost('/team-invites', data),
};

export const Notification = {
  listPage: (cursor?: string | null, limit: number = 20, unreadOnly: boolean = false) => {
    const params: string[] = [];
    params.push('limit=' + encodeURIComponent(String(limit)));
    if (cursor) params.push('cursor=' + encodeURIComponent(cursor));
    if (unreadOnly) params.push('unread=1');
    const qs = params.length ? '?' + params.join('&') : '';
    return httpGet('/notifications' + qs);
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
