export function shouldShowEventOnMap(
  dateValue: string | null | undefined,
  now = new Date()
): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed >= now;
}
