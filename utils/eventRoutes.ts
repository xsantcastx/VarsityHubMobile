import type { Href } from 'expo-router';

export const EVENT_DETAIL_PATHNAME = '/event-detail' as const;

function normalizeEventId(eventId: string | number): string {
  return String(eventId).trim();
}

export function buildEventDetailRoute(
  eventId: string | number,
  gameId?: string | number | null
): Href {
  // Game-linked events canonically render on the rich game screen; the
  // event-detail stub only serves standalone (non-game) events.
  const normalizedGameId = gameId != null ? String(gameId).trim() : '';
  if (normalizedGameId) {
    return {
      pathname: '/game/[id]',
      params: { id: normalizedGameId },
    } as Href;
  }
  return {
    pathname: EVENT_DETAIL_PATHNAME,
    params: { id: normalizeEventId(eventId) },
  } as Href;
}

export function buildEventDetailHref(eventId: string | number): string {
  return `${EVENT_DETAIL_PATHNAME}?id=${encodeURIComponent(normalizeEventId(eventId))}`;
}
