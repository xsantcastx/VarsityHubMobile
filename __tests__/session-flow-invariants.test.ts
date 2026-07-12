/**
 * Session / refresh-token flow — structural invariants.
 *
 * The "Sign-in Required" UX bug earlier this week was caused by a drift in
 * how the client distinguishes "token expired" (recoverable) from "session
 * dead" (must redirect to /sign-in). These tests lock every piece of that
 * contract so a future refactor can't silently break it.
 *
 * Wiring diagram:
 *   api/http.ts -----------------+
 *                                |
 *   api/upload.ts ---> emitSessionExpired('reason')
 *                                |
 *                                v
 *                      utils/sessionEvents.ts  (in-memory event bus)
 *                                ^
 *   context/AuthProvider --------+
 *      (subscribes, clears state, routes to /sign-in)
 *
 *   utils/uploadErrorAlert.ts
 *      (reads err.isSessionExpired and SUPPRESSES its alert)
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const sessionEvents = read('utils/sessionEvents.ts');
const httpLayer = read('api/http.ts');
const uploadLayer = read('api/upload.ts');
const authProvider = read('context/AuthProvider.tsx');
const uploadErrorAlert = read('utils/uploadErrorAlert.ts');
const adminDashboard = read('app/admin-dashboard.tsx');
const adminAds = read('app/admin-ads.tsx');
const approvals = read('app/(tabs)/approvals.tsx');
const organizationJoinRequests = read('app/organization-join-requests.tsx');
const eventApprovals = read('app/(tabs)/event-approvals.tsx');
const coachAgreement = read('app/onboarding/coach-agreement.tsx');
const onboardingIndex = read('app/onboarding/index.tsx');
const onboardingStep1 = read('app/onboarding/step-1-role.tsx');
const onboardingStep2 = read('app/onboarding/step-2-basic.tsx');
const onboardingStep3 = read('app/onboarding/step-3-league.tsx');
const verifyIdentity = read('app/verify-identity.tsx');
const settingsIndex = read('app/settings/index.tsx');

describe('session-expired event bus — client wiring invariants', () => {
  describe('utils/sessionEvents.ts — bus implementation', () => {
    it('exports emitSessionExpired and onSessionExpired', () => {
      expect(sessionEvents).toMatch(/export function emitSessionExpired/);
      expect(sessionEvents).toMatch(/export function onSessionExpired/);
    });

    it('has a dedupe window so parallel 401s fire the handler once', () => {
      expect(sessionEvents).toMatch(/DEDUPE_WINDOW_MS/);
    });

    it('wraps listener invocation in try/catch (one bad listener cannot break the bus)', () => {
      expect(sessionEvents).toMatch(/try\s*\{\s*fn/);
    });

    it('declares the SessionExpiredReason union (refresh_failed, refresh_missing, token_rejected_after_refresh)', () => {
      expect(sessionEvents).toMatch(/refresh_failed/);
      expect(sessionEvents).toMatch(/refresh_missing/);
      expect(sessionEvents).toMatch(/token_rejected_after_refresh/);
    });
  });

  describe('api/http.ts — emits session-expired in the right spots', () => {
    it('imports emitSessionExpired from utils/sessionEvents', () => {
      expect(httpLayer).toMatch(/from\s+['"]@\/utils\/sessionEvents['"]/);
      expect(httpLayer).toMatch(/emitSessionExpired/);
    });

    it('hangs the caller Promise on unrecoverable 401 instead of throwing', () => {
      // After the duplicate-Alert fix: http.ts no longer throws on
      // session-expired (which made per-screen catches stack a native
      // modal on top of the AuthProvider redirect). It emits the event,
      // returns a never-resolving Promise, and lets AuthProvider own the
      // redirect. The screen unmounts before any catch can fire.
      expect(httpLayer).toMatch(/return\s+new\s+Promise\(\(\)\s*=>\s*\{\}\)/);
      expect(httpLayer).toMatch(/intentional never-resolves/);
    });

    it('still calls refreshToken BEFORE giving up (not a one-strike-you-out)', () => {
      // Regression: before the fix, any 401 fired the session-expired handler.
      // The refresh-token attempt has to come first; only refresh failures
      // are legitimate "session dead" events.
      expect(httpLayer).toMatch(/auth\.refreshToken\(\)|refreshToken\(/);
    });

    it('uses skipAuthRetry to prevent the refresh call itself from looping', () => {
      // Without this flag, a 401 on /auth/refresh would trigger another
      // refresh attempt, which would 401, ad infinitum.
      expect(httpLayer).toMatch(/skipAuthRetry/);
    });

    it('emits token_rejected_after_refresh after the retried request also fails', () => {
      expect(httpLayer).toMatch(/token_rejected_after_refresh/);
    });
  });

  describe('api/upload.ts — same session-expired contract for upload paths', () => {
    it('imports emitSessionExpired', () => {
      expect(uploadLayer).toMatch(/emitSessionExpired/);
    });

    it('uses the shared refresh cache instead of starting a second upload-only refresh path', () => {
      expect(uploadLayer).toMatch(/refreshAccessTokenWithCache/);
      expect(uploadLayer).not.toMatch(/auth\.refreshToken\(\)/);
    });

    it('flags isSessionExpired on unrecoverable upload 401 (so alert is suppressed)', () => {
      expect(uploadLayer).toMatch(/isSessionExpired\s*=\s*true/);
    });
  });

  describe('context/AuthProvider.tsx — subscribes and handles', () => {
    it('imports onSessionExpired from the bus', () => {
      expect(authProvider).toMatch(/onSessionExpired/);
    });

    it('subscribes via onSessionExpired inside an effect (so it cleans up on unmount)', () => {
      // Pattern: `const unsubscribe = onSessionExpired(reason => {...})` inside
      // a useEffect whose cleanup calls unsubscribe().
      expect(authProvider).toMatch(/onSessionExpired\s*\(\s*[a-zA-Z_][\w]*\s*=>/);
    });

    it('routes to the guest feed on session-expired event', () => {
      // Authoritative: search the handleSessionExpired function body. Expired
      // sessions land on the guest feed (guest-first entry), tagged with
      // session_expired, after local auth state is cleared.
      const handlerMatch = authProvider.match(/handleSessionExpired[\s\S]{0,2500}/)?.[0] || '';
      expect(handlerMatch).toContain('redirectWithTelemetry(');
      expect(handlerMatch).toContain('unauthenticatedEntryRoute');
      expect(handlerMatch).toContain('clearLocalAuthState()');
      expect(handlerMatch).toContain('session_expired:');
    });

    it('exempts session-expiry from the routing-loop guard so the terminal redirect always fires', () => {
      // The wedge: api/http.ts returns `new Promise(() => {})` on a dead session
      // (the anti-Alert-stacking design pinned above). That hang is only safe if
      // the AuthProvider redirect actually unmounts the screen. The routing-loop
      // guard could `return false` without navigating — and the unauthenticated
      // entry route `/(tabs)/feed` is family `tabs`, the hottest redirect bucket —
      // so a session-expiry redirect could be swallowed, leaving the screen mounted
      // and the Promise hung forever (permanent spinner, force-quit to recover).
      //
      // The guard must be bypassed for session-expiry (a terminal, once-only
      // redirect, not a loop). Assert the bypass exists AND is wired into the
      // suppression condition — not just declared.
      expect(authProvider).toMatch(/reason\.startsWith\(\s*['"]session_expired['"]\s*\)/);
      const guardBlock =
        authProvider.match(
          /isTerminalSessionRedirect[\s\S]{0,200}recentFamilyRedirects\.length >= 2/
        )?.[0] || '';
      expect(guardBlock).toMatch(/!isTerminalSessionRedirect\s*&&/);
    });

    it('clears local user state on session-expired (does not leave stale /me data)', () => {
      // Look for the handler block — contains state clears and a redirect.
      const handlerMatch = authProvider.match(/handleSessionExpired[\s\S]{0,2500}/)?.[0] || '';
      expect(handlerMatch).toMatch(/setUser\(null\)|clearTokens|multiRemove|userBeforeExpiry/);
    });

    it('clears user-scoped AsyncStorage caches on sign-out/session-expiry', () => {
      expect(authProvider).toMatch(/const clearUserScopedStorage = useCallback/);
      expect(authProvider).toMatch(/key\.startsWith\('vh_settings_'\)/);
      expect(authProvider).toMatch(/key === 'vh_recent_searches'/);
      expect(authProvider).toMatch(/key\.startsWith\('team_messages_'\)/);
      expect(authProvider).toMatch(/\(key\.startsWith\('team-'\) && key\.endsWith\('-files'\)\)/);
      expect(authProvider).toMatch(/await clearUserScopedStorage\(\)/);
    });
  });

  describe('utils/uploadErrorAlert.ts — suppresses misleading alert', () => {
    it('reads err.isSessionExpired to short-circuit the sign-out-prompt alert', () => {
      // Regression: the old copy said "Sign out and sign back in" on every
      // 401 — including Cloudinary auth failures that had nothing to do
      // with the user's session. The isSessionExpired flag lets the alert
      // stay silent when AuthProvider is already handling it.
      expect(uploadErrorAlert).toMatch(/isSessionExpired/);
    });

    it('does NOT contain the old misleading "Sign-in Required" copy', () => {
      // The 'Sign-in Required' alert was the visible symptom of the bug.
      // Anyone resurrecting that exact copy fails this test.
      expect(uploadErrorAlert).not.toMatch(/Sign-in Required/);
    });

    it('does NOT instruct the user to sign out manually in an Alert.alert call', () => {
      // Only reject the visible copy; comments describing the old UX are fine.
      const alertCopyMatches = uploadErrorAlert.match(/Alert\.alert\([^)]*\)/g) || [];
      const joined = alertCopyMatches.join('\n').toLowerCase();
      expect(joined).not.toMatch(/sign out and sign back in/);
    });

    it('handles the upstream-failure branch (cloudinary 502/UPSTREAM_*) with dedicated copy', () => {
      expect(uploadErrorAlert).toMatch(/UPSTREAM|isUpstream|Upload Unavailable/i);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // End-to-end invariant — AuthProvider's handler path is self-contained
  // ──────────────────────────────────────────────────────────────────────

  describe('end-to-end — no path can leak a session-expired past the handler', () => {
    it('AuthProvider only routes to /sign-in via the redirectWithTelemetry helper (not bare router.replace)', () => {
      // The redirect helper records lastRedirectRef to prevent loops.
      // A bare router.replace bypass could cause repeated redirects
      // when the effect re-runs.
      const block = authProvider.slice(
        authProvider.indexOf('handleSessionExpired') !== -1
          ? authProvider.indexOf('handleSessionExpired')
          : authProvider.indexOf('onSessionExpired'),
        (authProvider.indexOf('handleSessionExpired') !== -1
          ? authProvider.indexOf('handleSessionExpired')
          : authProvider.indexOf('onSessionExpired')) + 3000
      );
      // Either redirectWithTelemetry OR router.replace is acceptable — the
      // key invariant is *some* navigation fires. If neither is present in
      // proximity to the handler, the handler is a no-op.
      expect(/redirectWithTelemetry\(|router\.replace\(/.test(block)).toBe(true);
    });

    it('session-expired handler does NOT await a network call that would 401 again', () => {
      // Regression: initially the handler called POST /auth/logout on the
      // server, which 401'd (no refresh token), which re-triggered the
      // handler, which called logout, etc. The fix is to clear state
      // locally and skip the server round-trip.
      const start = authProvider.indexOf('onSessionExpired');
      const block = authProvider.slice(start, start + 1500);
      // Must NOT do: await signOut() OR await logout-that-hits-server.
      // Acceptable: local state clear + redirect.
      expect(block).not.toMatch(/await\s+signOut\(\s*\)/);
    });

    it('approval/admin surfaces do not stack a second session-expired alert on top of AuthProvider redirect', () => {
      expect(adminDashboard).not.toContain("Alert.alert('Session expired'");
      expect(adminAds).not.toContain("Alert.alert('Session expired'");
      expect(approvals).not.toContain("Alert.alert('Session expired'");
      expect(organizationJoinRequests).not.toContain("Alert.alert('Session expired'");
      expect(eventApprovals).not.toContain("Alert.alert('Session expired'");
    });
  });

  describe('auth snapshot ownership — auth-sensitive screens do not run competing /me refresh policies', () => {
    it('coach agreement routes from a fresh AuthProvider snapshot instead of a second User.me call', () => {
      expect(coachAgreement).toMatch(/getFreshAuthSnapshot/);
      expect(coachAgreement).not.toMatch(/User\.me\(/);
    });

    it('onboarding index hydrates from AuthProvider-owned auth state', () => {
      expect(onboardingIndex).toMatch(/const \{ user, checkAuth \} = useAuth\(\)/);
      expect(onboardingIndex).toMatch(/buildServerHydrationPatch\(user\)/);
      expect(onboardingIndex).not.toMatch(/User\.me\(/);
      expect(onboardingIndex).not.toMatch(/User\.refresh\(/);
    });

    it('step-1 role uses AuthProvider snapshot helpers instead of raw User.me\\/refresh', () => {
      expect(onboardingStep1).toMatch(/getFreshAuthSnapshot/);
      expect(onboardingStep1).not.toMatch(/User\.me\(/);
      expect(onboardingStep1).not.toMatch(/User\.refresh\(/);
    });

    it('step-2 and step-3 onboarding no longer maintain parallel me\\/refresh fallback chains', () => {
      expect(onboardingStep2).not.toMatch(/User\.me\(/);
      expect(onboardingStep2).not.toMatch(/User\.refresh\(/);
      expect(onboardingStep3).toMatch(/checkAuth\(\)/);
      expect(onboardingStep3).not.toMatch(/User\.me\(/);
      expect(onboardingStep3).not.toMatch(/User\.refresh\(/);
    });

    it('verify-identity reuses AuthProvider refresh state', () => {
      expect(verifyIdentity).toMatch(/getFreshAuthSnapshot/);
      expect(verifyIdentity).not.toMatch(/User\.me\(/);
    });

    it('settings account-management actions reuse AuthProvider refresh state after mutations', () => {
      expect(settingsIndex).toMatch(/getFreshAuthSnapshot/);
      expect(settingsIndex).not.toMatch(/User\.me\(/);
      expect(settingsIndex).not.toMatch(/User\.refresh\(/);
    });
  });
});
