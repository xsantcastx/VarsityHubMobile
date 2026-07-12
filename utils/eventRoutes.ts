import type { Href } from 'expo-router';

// Kept only as the legacy deep-link/notification landing (varsityhub://event/:id
// maps here); the screen itself is a pure redirector — see app/(tabs)/event-detail.tsx.
export const EVENT_DETAIL_PATHNAME = '/event-detail' as const;

// The real event experience: the guest-browseable page fans upload posts to.
export const PUBLIC_EVENT_PATHNAME = '/public-event' as const;

function normalizeEventId(eventId: string | number): string {
  return String(eventId).trim();
}

export function buildEventDetailRoute(
  eventId: string | number,
  gameId?: string | number | null
): Href {
  // Game-linked events canonically render on the rich game screen; standalone
  // events render on the public event page (posts/media). The old RSVP stub
  // screen is never a destination (product decision 2026-07-05).
  const normalizedGameId = gameId != null ? String(gameId).trim() : '';
  if (normalizedGameId) {
    return {
      pathname: '/game/[id]',
      params: { id: normalizedGameId },
    } as Href;
  }
  return {
    pathname: PUBLIC_EVENT_PATHNAME,
    params: { id: normalizeEventId(eventId) },
  } as Href;
}

export function buildEventDetailHref(eventId: string | number): string {
  return `${EVENT_DETAIL_PATHNAME}?id=${encodeURIComponent(normalizeEventId(eventId))}`;
}
