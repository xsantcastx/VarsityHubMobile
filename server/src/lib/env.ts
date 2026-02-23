/**
 * Centralized environment helpers.
 * Use these instead of inline process.env reads for consistency.
 */

/**
 * Returns the app base URL (e.g. https://varsityhub.app) with trailing slash removed.
 * Defaults to https://varsityhub.app when APP_BASE_URL is not set.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL || 'https://varsityhub.app';
  return raw.replace(/\/$/, '');
}
