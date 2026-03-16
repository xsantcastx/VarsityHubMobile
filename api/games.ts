import { httpDelete, httpGet, httpPatch, httpPost, httpPostWithOptions, httpPut } from './http';

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
  get: (id: string) => httpGet('/games/' + encodeURIComponent(id), {}, 15000, 1),
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
  media: (id: string, opts?: { include_expired?: boolean }) => {
    const q = opts?.include_expired ? '?include_expired=1' : '';
    return httpGet(`/games/${encodeURIComponent(id)}/media` + q, {}, 15000, 1);
  },
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
  setResult: (id: string, data: { home_score?: number; away_score?: number; winner?: 'home' | 'away' | 'tie' | null }) =>
    httpPatch(`/games/${encodeURIComponent(id)}/result`, data),
  setApprovalStatus: (id: string, approval: 'approved' | 'rejected') =>
    httpPut(`/games/${encodeURIComponent(id)}/approve`, { approval_status: approval }),
  stories: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/stories`, {}, 15000, 1),
  addStory: (id: string, data: { media_url: string; caption?: string; location?: { lat: number; lng: number; source?: 'device' | 'places' | 'zip' | 'derived' } }) =>
    httpPostWithOptions(`/games/${encodeURIComponent(id)}/stories`, data, 45000, 0),
};
