/**
 * Fanatics Fest NYC 2026 — feed-pinning helpers (owner ask, 2026-07-17):
 * "For NYC users, Fanatics Fest should be pinned to their feed page — all four
 * event pages in order."
 *
 * The four day events are one-off entries created from
 * server/scripts/one-off/one-off-events.data.ts, each titled
 * "Fanatics Fest NYC 2026 — Day N: …", at the Javits Center. There is no
 * event-series or "featured"/"pinned" column on Game/Event and no region
 * concept, so this weekend's pin is done client-side off the two stable facts
 * the payload already carries: the title prefix and the viewer's location.
 *
 * Scoped deliberately to this fest weekend and easy to remove afterward — if a
 * durable pin/region feature is wanted later it should be designed on the
 * server (a real column + selection), not grown out of this file.
 */

import { distanceKm } from './liveWindow';

/**
 * Title prefix stamped on all four fest day games and events (the game inherits
 * the event title in create-one-off-events.ts). Lower-cased, trimmed compare so
 * casing/whitespace drift never silently un-pins the fest.
 */
const FEST_TITLE_PREFIX = 'fanatics fest';

export function isFanaticsFestGame(game: { title?: string | null } | null | undefined): boolean {
  const title = typeof game?.title === 'string' ? game.title.trim().toLowerCase() : '';
  return title.startsWith(FEST_TITLE_PREFIX);
}

/**
 * NYC center — the Javits Center itself (the fest venue), which sits at the
 * heart of the metro, so one constant serves as both "the fest" and "NYC".
 */
export const NYC_CENTER = { latitude: 40.75687, longitude: -74.001762 };

/**
 * Metro radius for a GPS-located viewer. 75km from midtown reaches all five
 * boroughs plus the near suburbs (Newark, Yonkers, western Long Island) — the
 * people who can actually attend or would reference the fest — without pinning
 * it for someone in another region.
 */
export const NYC_METRO_RADIUS_KM = 75;

/**
 * Zip fallback for viewers who never granted device location. Core NYC borough
 * prefixes only (Manhattan/SI/Bronx 100–104, Brooklyn 112, Queens 111/113/114/116).
 * Kept tight on purpose — the generous radius above already covers commuters
 * whose device location we can see.
 */
const NYC_ZIP_PREFIXES = new Set([
  '100', // Manhattan
  '101', // Manhattan
  '102', // Manhattan
  '103', // Staten Island
  '104', // Bronx
  '111', // Queens (Long Island City)
  '112', // Brooklyn
  '113', // Queens (Flushing)
  '114', // Queens (Jamaica)
  '116', // Queens (Far Rockaway)
]);

export function isNycZip(zip?: string | null): boolean {
  if (typeof zip !== 'string') return false;
  const trimmed = zip.trim();
  if (trimmed.length < 3) return false;
  return NYC_ZIP_PREFIXES.has(trimmed.slice(0, 3));
}

/**
 * Is this viewer a NYC-area user? True when their device location is inside the
 * metro radius OR they've saved a NYC borough zip. Unknown location + non-NYC
 * zip → false (fails closed: the fest is not pinned for people we can't place
 * in NYC — they still see the fest days in the normal upcoming/past flow).
 */
export function isNycViewer(
  viewer: { latitude?: number | null; longitude?: number | null } | null | undefined,
  zip?: string | null
): boolean {
  if (isNycZip(zip)) return true;
  if (viewer && typeof viewer.latitude === 'number' && typeof viewer.longitude === 'number') {
    return (
      distanceKm(viewer.latitude, viewer.longitude, NYC_CENTER.latitude, NYC_CENTER.longitude) <=
      NYC_METRO_RADIUS_KM
    );
  }
  return false;
}
