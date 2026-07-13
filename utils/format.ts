/**
 * Formatting Utilities
 *
 * Common formatting functions used across the app:
 * - timeAgo: Format timestamps as "X ago" strings
 * - formatCount: Format large numbers (1K, 1M, etc.)
 * - getCountryFlag: Get emoji flag for country code
 * - formatShortDate / formatLongDate / formatTime / formatDateTime:
 *   Canonical date display. Use these instead of raw
 *   `.toLocaleDateString()` / `.toLocaleTimeString()` so the app has
 *   one consistent locale and format.
 *
 * Background: the codebase had 50+ raw toLocaleDateString sites and
 * 15+ raw toLocaleTimeString sites with inconsistent options objects.
 * Cross-feature-inconsistencies audit HIGH-severity finding. Standardizing
 * via these helpers prevents locale drift and makes future timezone work
 * (UTC vs local) a single-file change instead of a repo-wide sweep.
 */

export type DateInput = string | number | Date | null | undefined;

/**
 * Coerce an input to a valid Date or null. Never throws. Used internally
 * by every formatter so callers don't each need to guard against NaN /
 * null / undefined separately.
 */
function coerceDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date/timestamp as "X ago" string
 * @param value - Date string, Date object, or null
 * @returns Formatted string like "2h ago", "3d ago", "1 month ago"
 */
export function timeAgo(value?: string | Date | null): string {
  if (!value) return '';
  const ts = typeof value === 'string' ? new Date(value).getTime() : new Date(value).getTime();
  const diff = Math.max(0, Date.now() - ts) / 1000;
  const days = Math.floor(diff / 86400);
  if (days >= 30) return '1 month ago';
  if (days >= 7) return `${Math.floor(days / 7)}w ago`;
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600);
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes >= 1) return `${minutes}m ago`;
  return 'now';
}

/**
 * Format large numbers with K/M suffixes
 * @param value - Number to format
 * @returns Formatted string like "1.2K", "5.3M", or "123"
 */
export function formatCount(value?: number | null): string {
  if (!value) return '0';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(value);
}

/**
 * Get emoji flag for country code
 * @param countryCode - ISO country code (e.g., "US", "CA", "GB")
 * @returns Emoji flag or empty string
 */
export function getCountryFlag(countryCode?: string | null): string {
  if (!countryCode) return '';
  const flags: { [key: string]: string } = {
    US: '🇺🇸',
    CA: '🇨🇦',
    GB: '🇬🇧',
    AU: '🇦🇺',
    DE: '🇩🇪',
    FR: '🇫🇷',
    IT: '🇮🇹',
    ES: '🇪🇸',
    NL: '🇳🇱',
    BE: '🇧🇪',
    SE: '🇸🇪',
    NO: '🇳🇴',
    DK: '🇩🇰',
    FI: '🇫🇮',
    PL: '🇵🇱',
    MX: '🇲🇽',
    BR: '🇧🇷',
    AR: '🇦🇷',
    CL: '🇨🇱',
    CO: '🇨🇴',
    JP: '🇯🇵',
    CN: '🇨🇳',
    KR: '🇰🇷',
    IN: '🇮🇳',
    SG: '🇸🇬',
    NZ: '🇳🇿',
    ZA: '🇿🇦',
    IE: '🇮🇪',
    PT: '🇵🇹',
    GR: '🇬🇷',
    CH: '🇨🇭',
    AT: '🇦🇹',
    CZ: '🇨🇿',
    HU: '🇭🇺',
    RO: '🇷🇴',
  };
  return flags[countryCode.toUpperCase()] || '';
}

/**
 * "Sat, Nov 15" — short weekday + month + day. Canonical format for
 * event cards, game cards, feed items. Returns empty string on invalid
 * input so callers can `{formatShortDate(x) || 'TBD'}` without guarding.
 */
export function formatShortDate(value: DateInput): string {
  const d = coerceDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * "November 15, 2024" — full date with year. Use for detail screens and
 * anywhere the user needs to distinguish this-year vs last-year.
 */
export function formatLongDate(value: DateInput): string {
  const d = coerceDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * "3:30 PM" — 12-hour time of day, no seconds. Canonical format for
 * game times, RSVP times, event times.
 */
export function formatTime(value: DateInput): string {
  const d = coerceDate(value);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * "Sat, Nov 15 • 3:30 PM" — date + time combined with a bullet separator.
 * The most common event-display format in the app.
 */
export function formatDateTime(value: DateInput): string {
  const d = coerceDate(value);
  if (!d) return '';
  return `${formatShortDate(d)} • ${formatTime(d)}`;
}

/**
 * "TBD"-aware display for game/event dates. Mirrors the inline helper
 * previously duplicated in team-hub.tsx and elsewhere. Use at call sites
 * that previously wrote:
 *   formatEventDate(evt.date)
 * to get the same "TBD when missing, 'Sat, Nov 15 • 3:30 PM' when present"
 * behavior without each file hand-rolling it.
 */
export function formatEventDate(value: DateInput): string {
  return formatDateTime(value) || 'TBD';
}

/**
 * ISO 8601 UTC — canonical format for API request bodies. Use when you
 * need to send a date to the server. Returns null for invalid input so
 * callers can conditionally include the field without sending 'Invalid Date'.
 */
export function toIsoString(value: DateInput): string | null {
  const d = coerceDate(value);
  return d ? d.toISOString() : null;
}
