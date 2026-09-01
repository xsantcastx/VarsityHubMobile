/**
 * Feed-map data model.
 *
 * The feed map (`app/game-map.tsx`) shows ALL public VarsityHub event pages
 * nationwide — not a location-scoped or pro-only slice. It reads from the
 * single `/event-discovery?surface=map` endpoint, which already returns every
 * approved, non-private game AND standalone event page in the server's map
 * window (privacy-filtered, no `lat`/`lng` gate). These helpers own the query
 * shape and the discovery-item → map-marker mapping so the "no data gates"
 * contract is pinned in one place and can't drift back into the screen.
 *
 * NOTE: this is deliberately distinct from the Discover calendar, which is a
 * separate followed/managed system. Do not fetch followed-only data here.
 */
import type { EventMapData } from '@/components/EventMap.types';
import type { EventCard } from '@/api/schemas/eventCard';
import { normalizeSportSlug } from '@/constants/sports';
import { shouldShowEventOnMap } from '@/utils/mapEventFilters';

const DEFAULT_MAP_LIMIT = 200;

/** The upcoming-days strip shown by the feed-map calendar button. */
export interface UpcomingDateButton {
  dateString: string;
  day: string;
  label: string;
  count: number;
}

/**
 * Build the feed-map discovery request path. Intentionally carries NO location
 * (`lat`/`lng`/`radius`), pro-only, or following gate — the feed map is every
 * public event page nationwide.
 */
export function buildMapDiscoveryPath(limit: number = DEFAULT_MAP_LIMIT): string {
  const query = new URLSearchParams();
  query.set('surface', 'map');
  query.set('limit', String(limit));
  return '/event-discovery?' + query.toString();
}

function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Map discovery items to the map-marker shape. `source_type` becomes the marker
 * `type` (so routing via the screen's `handleEventPress` stays correct: 'event'
 * → event detail, 'game' → game detail), and `id` is the routing id the server
 * already resolved (game id for games, event id for standalone events). Items
 * without coordinates or that are no longer upcoming are dropped, matching the
 * existing map rule that past pins must fall off immediately.
 */
export function toMapEvents(
  items: EventCard[] | null | undefined,
  now: Date = new Date(),
  { requireCoords = true }: { requireCoords?: boolean } = {}
): EventMapData[] {
  if (!Array.isArray(items)) return [];
  const out: EventMapData[] = [];
  for (const item of items) {
    const lat = item.latitude;
    const lng = item.longitude;
    const hasCoords = lat != null && lng != null;
    // Map pins need coordinates; the calendar dataset (requireCoords: false)
    // keeps every upcoming event page even without a location.
    if (requireCoords && !hasCoords) continue;
    if (!shouldShowEventOnMap(item.date ?? undefined, now)) continue;
    out.push({
      id: String(item.id),
      title: item.title || (item.source_type === 'game' ? 'Game' : 'Event'),
      date: item.date || now.toISOString(),
      location: item.location ?? undefined,
      latitude: hasCoords ? lat : undefined,
      longitude: hasCoords ? lng : undefined,
      type: item.source_type === 'game' ? 'game' : 'event',
      sport: normalizeSportSlug(item.sport),
    });
  }
  return out;
}

/**
 * Build the feed-map calendar strip as UPCOMING days (today going forward) —
 * the map shows what's still to come, so its date picker must look forward, not
 * back. Each button carries the count of provided events falling on that day.
 */
export function buildUpcomingDateButtons(
  events: Array<{ date?: string | null }>,
  now: Date = new Date(),
  days: number = 7
): UpcomingDateButton[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateString = toDateKey(date);
    const count = events.filter(event => {
      if (!event.date) return false;
      const d = new Date(event.date);
      return !isNaN(d.getTime()) && toDateKey(d) === dateString;
    }).length;
    return {
      dateString,
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      label: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      count,
    };
  });
}
