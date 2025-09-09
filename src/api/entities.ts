// Local REST client wrappers. Swaps out Base44 for a self-hosted API.
import { httpGet, httpPost, httpPut } from './http';
import auth from './auth';

export const User = {
  me: () => auth.me(),
  loginViaEmailPassword: (email: string, password: string) => auth.login(email, password),
  logout: () => auth.logout(),
  updateMe: (data: any) => httpPut('/auth/me', data),
};

export const Game = {
  list: (sort?: string) => httpGet('/games' + (sort ? `?sort=${encodeURIComponent(sort)}` : '')),
};

export const Post = {
  list: (sort?: string, limit: number = 20) => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    return httpGet('/posts' + (q.length ? '?' + q.join('&') : ''));
  },
  create: (data: any) => httpPost('/posts', data),
  listPage: (cursor?: string | null, limit: number = 10, sort: string = '-created_date') => {
    const q: string[] = [];
    if (sort) q.push('sort=' + encodeURIComponent(sort));
    if (limit) q.push('limit=' + String(limit));
    if (cursor) q.push('cursor=' + encodeURIComponent(cursor));
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
};

export const Message = {
  list: (sort: string = '-created_date', limit: number = 50) => {
    const q = [`sort=${encodeURIComponent(sort)}`, `limit=${limit}`];
    return httpGet('/messages?' + q.join('&'));
  },
  filter: (_where: any = {}, sort: string = '-created_date') => {
    return httpGet('/messages?sort=' + encodeURIComponent(sort));
  },
};

// Stubs for future entities
export const Team = {} as any;
export const CollaborativePost = {} as any;
export const EventPost = {} as any;
export const FreelancerBooking = {} as any;
export const UserInteraction = {} as any;
export const SponsorshipBid = {} as any;
export const EventSponsorship = {} as any;
export const SchoolPage = {} as any;
export const Advertisement = {} as any;

