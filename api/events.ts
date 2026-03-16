import { httpGet, httpPatch, httpPost } from './http';

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
