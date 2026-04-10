/**
 * Formatting Utilities
 *
 * Common formatting functions used across the app:
 * - timeAgo: Format timestamps as "X ago" strings
 * - formatCount: Format large numbers (1K, 1M, etc.)
 * - getCountryFlag: Get emoji flag for country code
 */

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
