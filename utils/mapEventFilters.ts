/**
 * Days ahead the live map shows. Mirrors the server-side games `map_view`
 * window (server/src/routes/games.ts — `twoWeeksFromNow`) so the map, the
 * events overlaid on it, and the feed all cover the same rolling 2 weeks.
 * Games are already bounded server-side; this is the client-side guarantee
 * that events (fetched from a general-purpose endpoint) can never outrun it.
 */
export const MAP_WINDOW_DAYS = 14;

export function shouldShowEventOnMap(
  dateValue: string | null | undefined,
  now = new Date()
): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  // Past drops off the live map immediately (by design — the map is upcoming
  // only). The upper bound keeps the map in sync with the games window so
  // events months out (e.g. bulk-imported pro fixtures) never surface here.
  if (parsed < now) return false;
  const windowEnd = new Date(now.getTime() + MAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return parsed <= windowEnd;
}
