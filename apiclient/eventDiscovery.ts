import { httpGet } from './http';
import { eventCardSchema, type EventCard } from './schemas/eventCard';
import { captureException } from '@/utils/sentry';

export type DiscoveryRequest = {
  surface: 'map' | 'feed';
  from?: string;
  to?: string;
  sport?: string | null;
  level?: string | null;
};

export function discoveryPath(request: DiscoveryRequest, cursor?: string | null): string {
  const query = new URLSearchParams({ surface: request.surface, limit: '200', paginated: 'true' });
  for (const [key, value] of Object.entries(request)) if (value) query.set(key, value);
  if (cursor) query.set('cursor', cursor);
  return `/event-discovery?${query}`;
}

/** One bounded page at a time. Malformed data must not masquerade as no events. */
export async function fetchDiscoveryPage(
  request: DiscoveryRequest,
  cursor?: string | null,
  signal?: AbortSignal
) {
  const payload = await httpGet(discoveryPath(request, cursor), { signal });
  try {
    if (!payload || !Array.isArray(payload.items)) throw new Error('Missing discovery items');
    // Old servers lack this field; refusing them avoids silently calling a
    // truncated legacy response complete during a staggered rollout.
    if (payload.next_cursor !== null && typeof payload.next_cursor !== 'string')
      throw new Error('Missing discovery continuation');
    return {
      items: payload.items.map((item: unknown) => eventCardSchema.parse(item)) as EventCard[],
      nextCursor: payload.next_cursor as string | null,
    };
  } catch (error) {
    captureException(error, { tags: { context: 'discovery_schema', surface: request.surface } });
    throw error;
  }
}

/** Used inside the existing QueryClient. Never treat an empty page as the end. */
export async function fetchDiscoveryItems(
  request: DiscoveryRequest,
  signal?: AbortSignal
): Promise<EventCard[]> {
  const cards = new Map<string, EventCard>();
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    if (signal?.aborted) throw new Error('Discovery request cancelled');
    const page = await fetchDiscoveryPage(request, cursor, signal);
    for (const item of page.items) cards.set(`${item.source_type}:${item.id}`, item);
    cursor = page.nextCursor;
    if (cursor) {
      if (seen.has(cursor)) throw new Error('Discovery continuation did not advance');
      seen.add(cursor);
    }
    // Bounded work protects the device on unexpectedly large/corrupt datasets;
    // fail visibly instead of reporting an incomplete set as complete.
    if (seen.size >= 100) throw new Error('Too many events to load. Choose a date or sport.');
  } while (cursor);
  return [...cards.values()];
}
