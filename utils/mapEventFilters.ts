import { DISCOVERY_UPCOMING_DAYS } from '@/shared/runtime/discoveryPolicy.js';
export function shouldShowEventOnMap(
  dateValue: string | null | undefined,
  now = new Date(),
  maxFutureDays = DISCOVERY_UPCOMING_DAYS
): boolean {
  if (!dateValue) return true;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return true;
  const latestAllowed = new Date(now.getTime() + maxFutureDays * 24 * 60 * 60 * 1000);
  return parsed >= now && parsed <= latestAllowed;
}
