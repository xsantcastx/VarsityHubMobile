/**
 * Render a game/event date+time for SERVER-side output (emails) in the event's
 * captured IANA timezone rather than the server's zone (UTC on Railway). Falls
 * back to zone-less formatting when no timezone was captured (older rows) — so
 * behavior is unchanged for legacy data, never worse. Audit 2026-07-14.
 */
export function formatEventTime(
  date: Date | string | null | undefined,
  timezone?: string | null
): { dateStr: string; timeStr: string; combined: string } {
  const d = date ? new Date(date) : null;
  if (!d || isNaN(d.getTime())) {
    return { dateStr: 'TBD', timeStr: '', combined: 'TBD' };
  }
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const tz = timezone || undefined;
  try {
    const dateStr = d.toLocaleDateString('en-US', tz ? { ...dateOpts, timeZone: tz } : dateOpts);
    const timeStr = d.toLocaleTimeString('en-US', tz ? { ...timeOpts, timeZone: tz } : timeOpts);
    const tzAbbr = tz
      ? new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
          .formatToParts(d)
          .find(p => p.type === 'timeZoneName')?.value
      : undefined;
    return { dateStr, timeStr, combined: `${dateStr} at ${timeStr}${tzAbbr ? ` ${tzAbbr}` : ''}` };
  } catch {
    const dateStr = d.toLocaleDateString('en-US', dateOpts);
    const timeStr = d.toLocaleTimeString('en-US', timeOpts);
    return { dateStr, timeStr, combined: `${dateStr} at ${timeStr}` };
  }
}
