/**
 * Detects when a unified-search query is a calendar date — "July 14 2026",
 * "7/14/26", "2026-07-14", "july 14th" — and returns the UTC window games on
 * that date fall into. Non-date queries return null and flow through the
 * normal text search.
 *
 * Number-only queries without separators ("10001", "2026") never parse as
 * dates, so zip-code and plain-number searches keep their text semantics.
 */

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export interface DateQueryWindow {
  start: Date;
  end: Date;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export function parseDateQuery(raw: string, now: Date = new Date()): DateQueryWindow | null {
  const q = raw.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!q || q.length > 40) return null;

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  // ISO: 2026-07-14
  let m = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  }

  // Numeric US: 7/14, 7/14/26, 7-14-2026, 7.14.2026
  if (!m) {
    m = q.match(/^(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?$/);
    if (m) {
      month = Number(m[1]);
      day = Number(m[2]);
      year = m[3] ? normalizeYear(Number(m[3])) : null;
    }
  }

  // Month-name first: "july 14 2026", "jul 14th", "july 14"
  if (!m) {
    m = q.match(/^([a-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?(?: (\d{2,4}))?$/);
    if (m) {
      if (!MONTHS[m[1]]) return null;
      month = MONTHS[m[1]];
      day = Number(m[2]);
      year = m[3] ? normalizeYear(Number(m[3])) : null;
    }
  }

  // Day first: "14 july 2026", "14th july"
  if (!m) {
    m = q.match(/^(\d{1,2})(?:st|nd|rd|th)? ([a-z]+)\.?(?: (\d{2,4}))?$/);
    if (m) {
      if (!MONTHS[m[2]]) return null;
      month = MONTHS[m[2]];
      day = Number(m[1]);
      year = m[3] ? normalizeYear(Number(m[3])) : null;
    }
  }

  if (month == null || day == null) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year == null) year = now.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;

  const start = new Date(Date.UTC(year, month - 1, day));
  // Reject impossible dates (Feb 30 rolls over in Date.UTC).
  if (start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;

  // Games are stored as UTC timestamps; a US-evening game lands on the next
  // UTC day (7/14 11pm PT = 7/15 06:00Z). Extend the window to +30h so a
  // date query matches every game played "that night" in US timezones —
  // over-matching the small hours of the next UTC day beats "No results
  // found" for a game the searcher just watched.
  const end = new Date(start.getTime() + 30 * 3600 * 1000);
  return { start, end };
}
