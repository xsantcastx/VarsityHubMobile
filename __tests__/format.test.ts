/**
 * Date-formatting helpers — contract tests.
 *
 * Pins the output shape so callers across the app can rely on a stable
 * format (same locale, same options) instead of each site passing its
 * own options object to toLocaleDateString / toLocaleTimeString.
 *
 * Pure unit test — no RN, no storage, no network. Runs fast in Jest.
 */
import { describe, expect, it } from '@jest/globals';
import {
  formatShortDate,
  formatLongDate,
  formatTime,
  formatDateTime,
  formatEventDate,
  toIsoString,
  timeAgo,
  formatCount,
} from '../utils/format';

describe('date formatters — null / invalid input', () => {
  const invalid = [null, undefined, '', 'not-a-date', Number.NaN];
  it('formatShortDate returns empty string on invalid input', () => {
    for (const v of invalid) expect(formatShortDate(v as any)).toBe('');
  });
  it('formatLongDate returns empty string on invalid input', () => {
    for (const v of invalid) expect(formatLongDate(v as any)).toBe('');
  });
  it('formatTime returns empty string on invalid input', () => {
    for (const v of invalid) expect(formatTime(v as any)).toBe('');
  });
  it('formatDateTime returns empty string on invalid input', () => {
    for (const v of invalid) expect(formatDateTime(v as any)).toBe('');
  });
  it('formatEventDate returns TBD on invalid input', () => {
    for (const v of invalid) expect(formatEventDate(v as any)).toBe('TBD');
  });
  it('toIsoString returns null on invalid input', () => {
    for (const v of invalid) expect(toIsoString(v as any)).toBeNull();
  });
});

describe('date formatters — valid input shape', () => {
  // 2024-11-15 15:30 UTC. Exact display wording depends on the runtime
  // locale/timezone — we assert structural properties (contains weekday
  // token, contains month, etc.) rather than pin the exact string.
  const iso = '2024-11-15T15:30:00.000Z';

  it('formatShortDate includes a weekday abbreviation', () => {
    const out = formatShortDate(iso);
    expect(out).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat),/);
  });

  it('formatShortDate includes a 3-letter month', () => {
    const out = formatShortDate(iso);
    expect(out).toMatch(/Nov/);
  });

  it('formatLongDate includes the full year', () => {
    const out = formatLongDate(iso);
    expect(out).toMatch(/2024/);
    expect(out).toMatch(/November/);
  });

  it('formatTime uses 12-hour AM/PM notation', () => {
    const out = formatTime(iso);
    expect(out).toMatch(/[AP]M$/);
  });

  it('formatDateTime joins date and time with a bullet', () => {
    const out = formatDateTime(iso);
    expect(out).toContain(' • ');
  });

  it('formatEventDate returns the same as formatDateTime for valid input', () => {
    expect(formatEventDate(iso)).toBe(formatDateTime(iso));
  });

  it('toIsoString round-trips ISO input', () => {
    expect(toIsoString(iso)).toBe(iso);
  });

  it('toIsoString accepts a Date object', () => {
    const d = new Date(iso);
    expect(toIsoString(d)).toBe(iso);
  });

  it('toIsoString accepts a number (epoch ms)', () => {
    const ms = new Date(iso).getTime();
    expect(toIsoString(ms)).toBe(iso);
  });
});

describe('timeAgo — sanity (pre-existing helper, not regressed)', () => {
  it('returns "now" for a fresh timestamp', () => {
    expect(timeAgo(new Date())).toBe('now');
  });
  it('returns "" for null', () => {
    expect(timeAgo(null)).toBe('');
  });
});

describe('formatCount — sanity (pre-existing helper, not regressed)', () => {
  it('formats thousands as K', () => {
    expect(formatCount(1500)).toBe('1.5K');
  });
  it('formats millions as M', () => {
    expect(formatCount(2_400_000)).toBe('2.4M');
  });
  it('returns "0" for null', () => {
    expect(formatCount(null)).toBe('0');
  });
});
