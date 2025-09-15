// Local REST client wrappers. Swaps out Base44 for a self-hosted API.
import { httpGet, httpPost, httpPut } from './http';
import auth from './auth';

export const User = {
  me: () => auth.me(),
  register: (email: string, password: string, display_name?: string) => auth.register(email, password, display_name),
  loginViaEmailPassword: (email: string, password: string) => auth.login(email, password),
  logout: () => auth.logout(),
  updateMe: (data: any) => httpPut('/auth/me', data),
  requestVerification: () => auth.requestEmailVerification(),
  verifyEmail: (code: string) => auth.verifyEmail(code),
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
  unfollow: (id: string) => httpPost(`/users/${encodeURIComponent(id)}/follow?_method=DELETE`, {}),
};

export const Game = {
  list: (sort?: string) => httpGet('/games' + (sort ? `?sort=${encodeURIComponent(sort)}` : '')),
  get: (id: string) => httpGet('/games/' + encodeURIComponent(id)),
  update: (id: string, data: any) => httpPut('/games/' + encodeURIComponent(id), data),
  stories: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/stories`),
  addStory: (id: string, data: { media_url: string; caption?: string }) => httpPost(`/games/${encodeURIComponent(id)}/stories`, data),
};

export const Post = {
  list: (sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    return httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
  },
  create: (data: any) => httpPost('/posts', data),
  filter: (where: { game_id?: string; type?: string, user_id?: string } = {}, sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
    return httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
  },
  count: (where: { game_id?: string; type?: string } = {}) => {
    const q: string[] = [];
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    return httpGet('/posts/count' + (q.length ? '?' + q.join('&') : ''));
  },
  listPage: (cursor?: string | null, limit: number = 10, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    return httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
  },
  filterPage: (where: { game_id?: string; type?: string, user_id?: string } = {}, cursor?: string | null, limit: number = 20, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
    if (where.game_id) q.push('game_id=' + encodeURIComponent(where.game_id));
    if (where.type) q.push('type=' + encodeURIComponent(where.type));
    if (where.user_id) q.push('user_id=' + encodeURIComponent(where.user_id));
    return httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
  },
  get: (id: string) => httpGet('/posts/' + encodeURIComponent(id)),
  comments: (id: string) => httpGet(`/posts/${encodeURIComponent(id)}/comments`),
  addComment: (id: string, content: string) => httpPost(`/posts/${encodeURIComponent(id)}/comments`, { content }),
  like: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/reactions/like`, {}),
  unlike: (id: string) => httpPost(`/posts/${encodeURIComponent(id)}/reactions/like?_method=DELETE`, {}),
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
  rsvp: (id: string, attending?: boolean) => httpPost(`/events/${encodeURIComponent(id)}/rsvp`, typeof attending === 'boolean' ? { attending } : {}),
  myRsvps: () => httpGet('/events/my-rsvps'),
};

export const Message = {
  list: (sort: string = '-created_date', limit: number = 50) => {
    const q = [`sort=${encodeURIComponent(sort)}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  listAll: (limit: number = 200) => httpGet('/messages?all=1&limit=' + String(limit)),
  filter: (_where: any = {}, sort: string = '-created_date') => {
    return httpGet('/messages?sort=' + encodeURIComponent(sort));
  },
  threadByConversation: (conversationId: string, limit: number = 100) => {
    const q = [`conversation_id=${encodeURIComponent(conversationId)}`, `sort=${encodeURIComponent('-created_date')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  threadWith: (email: string, limit: number = 100) => {
    const q = [`with=${encodeURIComponent(email)}`, `sort=${encodeURIComponent('-created_date')}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  send: (data: { content: string; conversation_id?: string; recipient_email?: string }) => httpPost('/messages', data),
  markReadByConversation: (conversationId: string) => httpPost('/messages/mark-read', { conversation_id: conversationId }),
  markReadWith: (email: string) => httpPost('/messages/mark-read', { with: email }),
};

// Stubs for future entities
export const Team = {
  list: (q?: string) => httpGet('/teams' + (q ? `?q=${encodeURIComponent(q)}` : '')),
  get: (id: string) => httpGet('/teams/' + encodeURIComponent(id)),
  members: (id: string) => httpGet(`/teams/${encodeURIComponent(id)}/members`),
  allMembers: (q?: string) => httpGet('/teams/members/all' + (q ? `?q=${encodeURIComponent(q)}` : '')),
  create: (data: { name: string; description?: string }) => httpPost('/teams', data),
  invite: (teamId: string, email: string, role?: string) => httpPost(`/teams/${encodeURIComponent(teamId)}/invite`, { email, role }),
  myInvites: () => httpGet('/teams/invites/me'),
  acceptInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/accept`, {}),
  declineInvite: (inviteId: string) => httpPost(`/teams/invites/${encodeURIComponent(inviteId)}/decline`, {}),
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
};
