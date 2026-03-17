import { httpGet, httpPatch, httpPost } from './http';

export type EventFilterParams = {
  status?: string;
  approval_status?: string;
  event_type?: string;
  q?: string;
  include_cancelled?: boolean;
  include_past?: boolean;
  /** Zip code for geo filtering (events within radius) */
  zip?: string;
  /** Latitude for geo filtering */
  lat?: number;
  /** Longitude for geo filtering */
  lng?: number;
  /** Radius in miles (default 30, max 500) */
  radius?: number;
  /** Show all events regardless of location */
  show_all?: boolean;
};

export const Event = {
  create: (data: any) => httpPost('/events', data),
  filter: (where: EventFilterParams = {}, sort?: string, limit?: number) => {
    const q: string[] = [];
    if (where.status) q.push('status=' + encodeURIComponent(where.status));
    if (where.approval_status) q.push('approval_status=' + encodeURIComponent(where.approval_status));
    if (where.event_type) q.push('event_type=' + encodeURIComponent(where.event_type));
    if (where.include_cancelled) q.push('include_cancelled=true');
    if (where.include_past) q.push('include_past=true');
    if (where.q) q.push('q=' + encodeURIComponent(where.q));
    if (where.zip) q.push('zip=' + encodeURIComponent(where.zip));
    if (typeof where.lat === 'number' && !isNaN(where.lat)) q.push('lat=' + encodeURIComponent(String(where.lat)));
    if (typeof where.lng === 'number' && !isNaN(where.lng)) q.push('lng=' + encodeURIComponent(String(where.lng)));
    if (typeof where.radius === 'number' && where.radius > 0) q.push('radius=' + encodeURIComponent(String(Math.min(where.radius, 500))));
    if (where.show_all) q.push('show_all=true');
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
