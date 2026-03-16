import { httpDelete, httpGet, httpPost, httpPostWithOptions, httpPut } from './http';

export const Report = {
  create: (data: { target_type: string; target_id: string; reason: string; details?: string }) => httpPost('/reports', data),
};

export const Support = {
  contact: (data: { name: string; email: string; subject: string; message: string; from_email?: string }) => httpPost('/support/contact', data),
  feedback: (data: { user_id?: string; category: 'bug' | 'idea' | 'other'; message: string; screenshot_url?: string }) => httpPost('/support/feedback', data),
};

export const Advertisement = {
  reservedDates: (from?: string, to?: string) => {
    const q: string[] = [];
    if (from) q.push('from=' + encodeURIComponent(from));
    if (to) q.push('to=' + encodeURIComponent(to));
    return httpGet('/ads/reservations' + (q.length ? '?' + q.join('&') : ''));
  },
  reservationsForAd: (ad_id: string) => httpGet('/ads/reservations?ad_id=' + encodeURIComponent(ad_id)),
  reserve: (ad_id: string, dates: string[]) => httpPost('/ads/reservations', { ad_id, dates }),
  create: (data: any) => httpPostWithOptions('/ads', data, 15000, 0),
  listMine: () => httpGet('/ads?mine=1'),
  listAll: () => httpGet('/ads?all=1'),
  get: (id: string) => httpGet('/ads/' + encodeURIComponent(id)),
  update: (id: string, data: any) => httpPut('/ads/' + encodeURIComponent(id), data),
  submitForApproval: (id: string, dates: string[]) => httpPost('/ads/' + encodeURIComponent(id) + '/submit-for-approval', { dates }),
  review: (id: string, action: 'approve' | 'reject', note?: string) => httpPost('/ads/' + encodeURIComponent(id) + '/review', { action, ...(note ? { note } : {}) }),
  delete: (id: string) => httpDelete('/ads/' + encodeURIComponent(id)),
  forFeed: (dateISO?: string, zip?: string, limit: number = 1, lat?: number, lng?: number) => {
    const q: string[] = [];
    if (dateISO) q.push('date=' + encodeURIComponent(dateISO));
    if (zip) q.push('zip=' + encodeURIComponent(zip));
    if (limit) q.push('limit=' + String(limit));
    if (lat != null && lng != null) {
      q.push('lat=' + String(lat));
      q.push('lng=' + String(lng));
    }
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
