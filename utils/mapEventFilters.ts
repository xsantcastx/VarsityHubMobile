const DEFAULT_MAP_GRACE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowEventOnMap(
  dateValue: string | null | undefined,
  now = new Date(),
  graceWindowMs = DEFAULT_MAP_GRACE_WINDOW_MS
): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= now.getTime() - graceWindowMs;
}
