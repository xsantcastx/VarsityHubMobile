/**
 * Google Play purchase-verification posture.
 *
 * Security audit 2026-06 finding #4 (P2): GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK
 * let an env var downgrade Android purchase verification to trusting client
 * claims. That escape hatch is now a hard no-op in production — the flag is
 * ignored (treated as unset) regardless of its value, so no env misconfig can
 * change security posture. Non-production behavior is unchanged: setting the
 * var to '1' still enables the local/dev fallback when Play credentials are
 * not configured.
 *
 * Extracted into its own dependency-free module (same pattern as
 * appleNotificationDedup.ts) so the production no-op is unit-testable.
 */
export function resolveGooglePlayUnverifiedFallback(
  env: Record<string, string | undefined> = process.env
): boolean {
  const rawValue = (env.GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK ?? '').trim();
  if (env.NODE_ENV === 'production') {
    if (rawValue !== '') {
      console.warn('[payments] GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK ignored in production');
    }
    return false;
  }
  return rawValue === '1';
}
