const DAY_MS = 24 * 60 * 60 * 1000;

function utcMidnightMsForDate(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function utcMidnightMsForIsoDate(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00.000Z`).getTime();
}

export function getMaxBookableDateIso(now: Date, maxBookingHorizonDays: number): string {
  const cutoffMs = utcMidnightMsForDate(now) + maxBookingHorizonDays * DAY_MS;
  return new Date(cutoffMs).toISOString().slice(0, 10);
}

export function getDatesPastBookingHorizon(
  isoDates: string[],
  now: Date,
  maxBookingHorizonDays: number
): string[] {
  const cutoffMs = utcMidnightMsForDate(now) + maxBookingHorizonDays * DAY_MS;
  return isoDates.filter(dateIso => utcMidnightMsForIsoDate(dateIso) > cutoffMs);
}
