/**
 * Account-switch / sign-in boundary invariants.
 *
 * These static source tests lock the session-isolation rules that prevent
 * one account's client state from bleeding into another account on the same
 * device during sign-in/sign-up and token replacement flows.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const authProvider = read('context/AuthProvider.tsx');
const authApi = read('apiclient/auth.ts');
const httpApi = read('apiclient/http.ts');
const serverAuthRoutes = read('server/src/routes/auth.ts');
const signIn = read('app/sign-in.tsx');
const signUp = read('app/sign-up.tsx');
const appleAuth = read('hooks/useAppleAuth.ts');
const verifyScreen = read('app/verify.tsx');
const verifyIdentityScreen = read('app/verify-identity.tsx');
const verificationGate = read('hooks/useVerificationGate.ts');
const forgotPasswordScreen = read('app/forgot-password.tsx');
const resetPasswordScreen = read('app/reset-password.tsx');
const legacyResetScreen = read('app/reset.tsx');
const legacyVerifyScreen = read('app/(tabs)/verify-email.tsx');
const manageSubscriptionScreen = read('app/settings/manage-subscription.tsx');
const dmRestrictions = read('utils/dmRestrictions.ts');
const settingsScreen = read('app/settings/index.tsx');

describe('account boundary invariants', () => {
  describe('AuthProvider session replacement', () => {
    it('checkAuth exposes a replaceSession option for fresh sign-ins', () => {
      expect(authProvider).toMatch(/replaceSession\?:\s*boolean/);
    });

    it('auth context exposes hasSession for persisted-token boundary checks', () => {
      expect(authProvider).toMatch(/hasSession:\s*boolean/);
      expect(authProvider).toMatch(
        /const\s*\[\s*hasSession,\s*setHasSession\s*\]\s*=\s*useState\(false\)/
      );
    });

    it('replaceSession clears old local auth state before refreshing /me', () => {
      const block = authProvider.match(/const checkAuth = useCallback\([\s\S]{0,5000}/)?.[0] || '';
      expect(block).toMatch(
        /if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,400}clearLocalAuthState\(\)/
      );
      expect(block).toMatch(/setHasSession\(true\)/);
      expect(block).toMatch(
        /const shouldForceRefresh =[\s\S]{0,200}options\?\.forceRefresh === true \|\| options\?\.replaceSession === true/
      );
      expect(block).toMatch(/User\.me\(shouldForceRefresh \? \{ force: true \} : undefined\)/);
    });

    it('replaceSession does not preserve a stale user on refresh failure', () => {
      const block =
        authProvider.match(
          /const checkAuth = useCallback\([\s\S]*?catch\s*\(err:\s*any\)\s*\{[\s\S]{0,1200}/
        )?.[0] || '';
      expect(block).toMatch(
        /if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,200}clearLocalAuthState\(\)/
      );
      expect(block).toMatch(/if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,300}throw err/);
    });

    it('account replacement clears user-scoped storage when the user id changes', () => {
      expect(authProvider).toMatch(/previousUserId/);
      expect(authProvider).toMatch(/previousUserId\s*!==\s*me\.id/);
      expect(authProvider).toMatch(/await clearUserScopedStorage\(\)/);
    });

    it('fresh-install cleanup returns a status object so bootstrap can fail closed', () => {
      expect(authApi).toMatch(/export type FreshInstallCleanupResult/);
      expect(authApi).toMatch(/return \{ freshInstall: true, ok: false, error \}/);
      expect(authApi).toMatch(/Fresh install token cleanup failed; forcing signed-out bootstrap/);
    });

    it('AuthProvider skips persisted-session bootstrap when fresh-install cleanup fails', () => {
      expect(authProvider).toMatch(/freshInstallCleanup\?\.ok === false/);
      expect(authProvider).toMatch(/fresh_install_token_cleanup_failed/);
      expect(authProvider).toMatch(/skipping persisted-session bootstrap/);
    });

    it('bootstrap does not abort active auth-establishing requests when no token is present yet', () => {
      expect(authProvider).toMatch(
        /clearLocalAuthState = useCallback\(\(options\?: \{ abortInflight\?: boolean \}\)/
      );
      expect(authProvider).toMatch(
        /if \(options\?\.abortInflight !== false\) \{\s*abortAllInflight\('sign_out_or_session_expiry'\);/
      );
      expect(authProvider).toMatch(
        /if \(!token\) \{[\s\S]{0,400}clearLocalAuthState\(\{\s*abortInflight:\s*false\s*\}\)/
      );
    });
  });

  describe('Sign-in and sign-up routing', () => {
    it('auth token parsing preserves needs_verification from /auth/login', () => {
      expect(authApi).toMatch(/needs_verification\?:\s*boolean/);
      expect(authApi).toMatch(/typeof response\.needs_verification === 'boolean'/);
      expect(authApi).toMatch(/parsed\.needs_verification = response\.needs_verification/);
    });

    it('sign-in branches on needs_verification before normal post-login routing', () => {
      expect(signIn).toMatch(/if\s*\(res\?\.needs_verification\)/);
      expect(signIn).toMatch(
        /checkAuth\(\{\s*email:\s*sanitizedEmail,\s*pendingVerification:\s*true\s*\}\)/
      );
    });

    it('server auth responses keep platform admin in is_admin instead of rewriting role to admin', () => {
      expect(serverAuthRoutes).toMatch(
        /user:\s*\{\s*\.\.\.sanitized,\s*is_admin:\s*isLoginAdmin\s*\}/
      );
      expect(serverAuthRoutes).toMatch(/is_admin:\s*isOAuthAdmin/);
      expect(serverAuthRoutes).toMatch(/is_admin:\s*isAppleOAuthAdmin/);
      expect(serverAuthRoutes).not.toMatch(/\.\.\.\(isLoginAdmin \? \{ role: 'admin' } : \{\}\)/);
      expect(serverAuthRoutes).not.toMatch(/\.\.\.\(isOAuthAdmin \? \{ role: 'admin' } : \{\}\)/);
      expect(serverAuthRoutes).not.toMatch(
        /\.\.\.\(isAppleOAuthAdmin \? \{ role: 'admin' } : \{\}\)/
      );
    });

    it('AuthProvider derives dashboard admin from is_admin, not the role=admin string', () => {
      expect(authProvider).toMatch(
        /normalizedRole === 'super_admin' \|\| user\?\.is_admin === true/
      );
      expect(authProvider).not.toMatch(/normalizedRole === 'admin'/);
    });

    it('sign-in uses replaceSession when completing a new login', () => {
      expect(signIn).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
    });

    it('sign-in synchronously guards duplicate auth submissions and sanitizes email before login', () => {
      expect(signIn).toMatch(/submitInFlightRef/);
      expect(signIn).toMatch(/if \(submitInFlightRef\.current\) return;/);
      expect(signIn).toMatch(/const sanitizedEmail = sanitizeEmail\(email\)/);
      expect(signIn).toMatch(/loginViaEmailPassword\(sanitizedEmail,\s*password\)/);
      expect(signIn).toMatch(
        /checkAuth\(\{\s*email:\s*sanitizedEmail,\s*pendingVerification:\s*true\s*\}\)/
      );
    });

    it('auth-establishing endpoints explicitly omit stale Authorization headers', () => {
      expect(authApi).toMatch(
        /httpPostLongTimeout\(\s*'\/auth\/register',[\s\S]{0,120}omitAuthToken:\s*true[\s\S]{0,120}skipAuthRetry:\s*true/
      );
      expect(authApi).toMatch(
        /httpPost\(\s*'\/auth\/login',[\s\S]{0,120}omitAuthToken:\s*true[\s\S]{0,120}skipAuthRetry:\s*true/
      );
      expect(authApi).toMatch(
        /httpPostLongTimeout\(\s*'\/auth\/google',[\s\S]{0,120}omitAuthToken:\s*true[\s\S]{0,120}skipAuthRetry:\s*true/
      );
      expect(authApi).toMatch(
        /httpPostLongTimeout\(\s*'\/auth\/apple',[\s\S]{0,120}omitAuthToken:\s*true[\s\S]{0,120}skipAuthRetry:\s*true/
      );
      // /auth/refresh goes through httpPostWithOptions (not httpPost) so it can
      // carry its own longer timeout — the rotation-grace fix. That inserts the
      // timeout and retry args between the path and the options object, so this
      // pattern allows a wider gap than its siblings above. The two flags being
      // pinned are unchanged: a refresh must never send a stale Authorization
      // header, and must never trigger the auth-retry loop it is itself serving.
      expect(authApi).toMatch(
        /httpPostWithOptions\(\s*'\/auth\/refresh',[\s\S]{0,200}omitAuthToken:\s*true[\s\S]{0,120}skipAuthRetry:\s*true/
      );
    });

    it('sign-up uses replaceSession when completing OAuth account creation', () => {
      expect(signUp).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
    });

    it('sign-up seeds pending verification state through AuthProvider before routing to verify', () => {
      expect(signUp).toMatch(
        /await checkAuth\(\{\s*email:\s*sanitizedEmail,\s*pendingVerification:\s*true\s*\}\)/
      );
      expect(signUp).toMatch(/pathname:\s*'\/verify'/);
    });

    it('sign-in blocks Google OAuth when a user session already exists', () => {
      expect(signIn).toMatch(/const\s+sessionGuardActive\s*=\s*hasSession/);
      expect(signIn).toMatch(/handleGoogleLogin[\s\S]{0,200}if\s*\(sessionGuardActive\)/);
      expect(signIn).toMatch(/Sign out before using a different Google account on this device\./);
    });

    it('sign-up blocks Google OAuth when a user session already exists', () => {
      expect(signUp).toMatch(/const\s+sessionGuardActive\s*=\s*hasSession/);
      expect(signUp).toMatch(/handleGoogleSignUp[\s\S]{0,200}if\s*\(sessionGuardActive\)/);
      expect(signUp).toMatch(/Sign out before using a different Google account on this device\./);
    });

    it('auth entry screens hide login controls when any persisted session exists', () => {
      expect(signIn).toMatch(/\{sessionGuardActive \? \(/);
      expect(signIn).toMatch(/\{!sessionGuardActive && Platform\.OS === 'ios' \? \(/);
      expect(signUp).toMatch(/\{sessionGuardActive \? \(/);
      expect(signUp).toMatch(/\{!sessionGuardActive && !showEmailForm \? \(/);
    });

    it('sign-in does not route off a stale catch(() => user) fallback', () => {
      expect(signIn).not.toMatch(/User\.me\(\{\s*force:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*user\)/);
    });

    it('sign-up does not route off a stale catch(() => user) fallback', () => {
      expect(signUp).not.toMatch(/User\.me\(\{\s*force:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*user\)/);
    });

    it('existing-session continue forces a fresh auth snapshot before routing', () => {
      expect(signIn).toMatch(/handleContinueExistingSession/);
      expect(signUp).toMatch(/handleContinueExistingSession/);
      expect(read('hooks/useExistingSessionActions.ts')).toMatch(
        /checkAuth\(\{\s*skipSubscriptionRefresh:\s*true,\s*forceRefresh:\s*true,\s*\}\)/
      );
      expect(read('hooks/useExistingSessionActions.ts')).not.toMatch(
        /const authUser = user \|\| \(await checkAuth\(\)\)/
      );
    });

    it('sign-up preserves host-specific transport errors from api/http', () => {
      expect(signUp).toMatch(
        /e\?\.isNetworkError === true \|\| errMsg\.startsWith\('Cannot connect to server'\)/
      );
    });

    it('sign-up retries registration on the current transport-error contract', () => {
      expect(signUp).toMatch(/const isRetryableError =[\s\S]{0,300}e\?\.isNetworkError === true/);
      expect(signUp).toMatch(
        /const isRetryableError =[\s\S]{0,300}errMsg\.startsWith\('Cannot connect to server'\)/
      );
    });

    it('settings and safety helpers do not treat role=admin as equivalent to email-admin', () => {
      expect(settingsScreen).not.toMatch(/me\?\.role === 'admin'/);
      expect(dmRestrictions).toMatch(
        /user\?\.is_admin === true \|\| user\?\.role === 'super_admin'/
      );
      expect(dmRestrictions).not.toMatch(/user\?\.role === 'admin'/);
    });

    it('apple auth preserves or reconstructs host-specific transport errors', () => {
      expect(appleAuth).toMatch(
        /err\?\.isNetworkError === true \|\| message\.startsWith\('Cannot connect to server'\)/
      );
      expect(appleAuth).toMatch(/Cannot connect to server at \$\{getApiBaseUrl\(\)\}\./);
    });

    it('verification screens delegate resend and confirm flow to useVerificationGate', () => {
      expect(verifyScreen).toMatch(/useVerificationGate\(/);
      expect(verifyIdentityScreen).toMatch(/useVerificationGate\(/);
    });

    it('legacy /verify-email is only a compatibility handoff to the canonical /verify screen', () => {
      expect(legacyVerifyScreen).toMatch(/<Redirect href="\/verify" \/>/);
      expect(legacyVerifyScreen).not.toMatch(/useVerificationGate\(/);
    });

    it('verification hook retains the synchronous resend\/confirm guards', () => {
      expect(verificationGate).toMatch(/resendInFlightRef/);
      expect(verificationGate).toMatch(
        /if \(loading \|\| resendInFlightRef\.current \|\| resendCooldown > 0\) return;/
      );
      expect(verificationGate).toMatch(/verifyInFlightRef/);
      expect(verificationGate).toMatch(
        /if \(loading \|\| verifyInFlightRef\.current \|\| code\.trim\(\)\.length !== 6\) return;/
      );
    });

    it('forgot-password synchronously guards duplicate send/reset submissions', () => {
      expect(forgotPasswordScreen).toMatch(/sendInFlightRef/);
      expect(forgotPasswordScreen).toMatch(/resetInFlightRef/);
      expect(forgotPasswordScreen).toMatch(/if \(sendInFlightRef\.current\) return;/);
      expect(forgotPasswordScreen).toMatch(/if \(resetInFlightRef\.current\) return;/);
    });

    it('reset-password synchronously guards duplicate reset submissions', () => {
      expect(resetPasswordScreen).toMatch(/submitInFlightRef/);
      expect(resetPasswordScreen).toMatch(/if \(submitInFlightRef\.current\) return;/);
    });

    it('legacy /reset route hands off to /reset-password instead of maintaining a second reset UI', () => {
      expect(legacyResetScreen).toMatch(/pathname:\s*'\/reset-password'/);
      expect(legacyResetScreen).not.toMatch(/User\.resetPassword/);
    });

    it('manage subscription routes unverified users into the guarded verify flow', () => {
      expect(manageSubscriptionScreen).toMatch(
        /\{\s*text:\s*'Verify now', onPress: \(\) => void router\.push\('\/verify'\)\s*\}/
      );
      expect(manageSubscriptionScreen).not.toMatch(/User\.requestVerification\(\)/);
    });

    it('server profile mutation routes require verified accounts before changing canonical user state', () => {
      expect(serverAuthRoutes).toMatch(
        /authRouter\.put\(\s*'\/me',\s*profileUpdateLimiter,\s*requireAuth as any,\s*requireVerified as any,/
      );
      expect(serverAuthRoutes).toMatch(
        /authRouter\.patch\(\s*'\/me',\s*profileUpdateLimiter,\s*requireAuth as any,\s*requireVerified as any,/
      );
      expect(serverAuthRoutes).toMatch(
        /authRouter\.patch\(\s*'\/me\/preferences',\s*requireAuth as any,\s*requireVerified as any,/
      );
    });

    it('refresh uses the dedicated refresh-token limiter and logout verifies the full refresh token before cleanup', () => {
      expect(serverAuthRoutes).toMatch(/authRouter\.post\(\s*'\/refresh',\s*refreshTokenLimiter,/);
      expect(serverAuthRoutes).toMatch(/verifyRefreshTokenHash\(\s*refresh_token,/);
      expect(serverAuthRoutes).not.toMatch(
        /logout's purpose is delete \+ push-token cleanup, so a key-id-only match is sufficient/
      );
    });

    it('client sends a stable device id header and refresh enforces it for bound sessions', () => {
      expect(httpApi).toMatch(/headers\['X-VarsityHub-Device-Id'\]\s*=\s*deviceId/);
      expect(serverAuthRoutes).toMatch(
        /verifyStoredSessionFingerprint\(stored\.device_info,\s*req\)/
      );
      expect(serverAuthRoutes).toMatch(/auth\.refresh\.delete-device-mismatch-token/);
    });
  });
});
