import type { Href } from 'expo-router';

export const EVENT_DETAIL_PATHNAME = '/event-detail' as const;

function normalizeEventId(eventId: string | number): string {
  return String(eventId).trim();
}

export function buildEventDetailRoute(eventId: string | number): Href {
  return {
    pathname: EVENT_DETAIL_PATHNAME,
    params: { id: normalizeEventId(eventId) },
  } as Href;
}

export function buildEventDetailHref(eventId: string | number): string {
  return `${EVENT_DETAIL_PATHNAME}?id=${encodeURIComponent(normalizeEventId(eventId))}`;
}
