import auth from './auth';
import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from './http';

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
  upgradeToCoach: (plan: 'rookie' | 'veteran' | 'legend') => httpPost('/auth/upgrade-to-coach', { plan }),
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
      if (error?.message?.includes('Admin only') || error?.status === 403) {
        if (__DEV__) console.log('[User.listAll] Admin-only endpoint, returning empty results');
        return [];
      }
      throw error;
    }
  },
  ban: (id: string, reason?: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.ban] Invalid user ID'); return httpPost('/admin/users/' + encodeURIComponent(id) + '/ban', { reason: reason || undefined }); },
  unban: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.unban] Invalid user ID'); return httpPost('/admin/users/' + encodeURIComponent(id) + '/unban', {}); },
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
  requestPasswordReset: (email: string) => auth.requestPasswordReset(email),
  resetPassword: (email: string, code: string, password: string) => auth.resetPassword(email, code, password),
  getPublic: (id: string) => { if (!id || id === 'undefined' || id === 'null') throw new Error('[User.getPublic] Invalid user ID'); return httpGet('/users/' + encodeURIComponent(id)); },
  teams: (id: string) => httpGet('/users/' + encodeURIComponent(id) + '/teams'),
  searchForMentions: (query: string, limit: number = 10) => httpGet('/users/search/mentions?q=' + encodeURIComponent(query) + '&limit=' + String(limit)),
  lookupByUsername: (username: string) => httpGet('/users/lookup?username=' + encodeURIComponent(username)),
  block: (id: string) => httpPost('/users/' + encodeURIComponent(id) + '/block', {}),
  unblock: (id: string) => httpDelete('/users/' + encodeURIComponent(id) + '/block'),
  blockedUsers: () => httpGet('/users/blocked'),
  exportMyData: () => httpGet('/users/me/export', {}, 60000),
  acceptFollow: (id: string) => httpPost(`/users/${encodeURIComponent(id)}/accept-follow`, {}),
  rejectFollow: (id: string) => httpPost(`/users/${encodeURIComponent(id)}/reject-follow`, {}),
  getFollowRequests: () => httpGet('/users/me/follow-requests'),
  deleteAccount: (payload?: { password?: string; delete_confirmation?: string }) =>
    httpDelete('/users/me', payload || {}),
};
