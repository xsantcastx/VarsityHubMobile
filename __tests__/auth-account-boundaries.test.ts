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
const authApi = read('api/auth.ts');
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
      expect(authProvider).toMatch(/const\s*\[\s*hasSession,\s*setHasSession\s*\]\s*=\s*useState\(false\)/);
    });

    it('replaceSession clears old local auth state before refreshing /me', () => {
      const block = authProvider.match(/const checkAuth = useCallback\([\s\S]{0,5000}/)?.[0] || '';
      expect(block).toMatch(/if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,400}clearLocalAuthState\(\)/);
      expect(block).toMatch(/setHasSession\(true\)/);
      expect(block).toMatch(/User\.me\(\{\s*force:\s*options\?\.replaceSession\s*===\s*true\s*\}\)/);
    });

    it('replaceSession does not preserve a stale user on refresh failure', () => {
      const block = authProvider.match(/const checkAuth = useCallback\([\s\S]*?catch\s*\(err:\s*any\)\s*\{[\s\S]{0,1200}/)?.[0] || '';
      expect(block).toMatch(/if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,200}clearLocalAuthState\(\)/);
      expect(block).toMatch(/if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,300}throw err/);
    });

    it('account replacement clears user-scoped storage when the user id changes', () => {
      expect(authProvider).toMatch(/previousUserId/);
      expect(authProvider).toMatch(/previousUserId\s*!==\s*me\.id/);
      expect(authProvider).toMatch(/await clearUserScopedStorage\(\)/);
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
      expect(signIn).toMatch(/checkAuth\(\{\s*email,\s*pendingVerification:\s*true\s*\}\)/);
    });

    it('server auth responses keep platform admin in is_admin instead of rewriting role to admin', () => {
      expect(serverAuthRoutes).toMatch(/user:\s*\{\s*\.\.\.sanitized,\s*is_admin:\s*isLoginAdmin\s*\}/);
      expect(serverAuthRoutes).toMatch(/is_admin:\s*isOAuthAdmin/);
      expect(serverAuthRoutes).toMatch(/is_admin:\s*isAppleOAuthAdmin/);
      expect(serverAuthRoutes).not.toMatch(/\.\.\.\(isLoginAdmin \? \{ role: 'admin' } : \{\}\)/);
      expect(serverAuthRoutes).not.toMatch(/\.\.\.\(isOAuthAdmin \? \{ role: 'admin' } : \{\}\)/);
      expect(serverAuthRoutes).not.toMatch(/\.\.\.\(isAppleOAuthAdmin \? \{ role: 'admin' } : \{\}\)/);
    });

    it('AuthProvider derives dashboard admin from is_admin, not the role=admin string', () => {
      expect(authProvider).toMatch(/normalizedRole === 'super_admin' \|\| user\?\.is_admin === true/);
      expect(authProvider).not.toMatch(/normalizedRole === 'admin'/);
    });

    it('sign-in uses replaceSession when completing a new login', () => {
      expect(signIn).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
    });

    it('sign-up uses replaceSession when completing OAuth account creation', () => {
      expect(signUp).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
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

    it('sign-up preserves host-specific transport errors from api/http', () => {
      expect(signUp).toMatch(/e\?\.isNetworkError === true \|\| errMsg\.startsWith\('Cannot connect to server'\)/);
    });

    it('sign-up retries registration on the current transport-error contract', () => {
      expect(signUp).toMatch(/const isRetryableError =[\s\S]{0,300}e\?\.isNetworkError === true/);
      expect(signUp).toMatch(/const isRetryableError =[\s\S]{0,300}errMsg\.startsWith\('Cannot connect to server'\)/);
    });

    it('settings and safety helpers do not treat role=admin as equivalent to email-admin', () => {
      expect(settingsScreen).not.toMatch(/me\?\.role === 'admin'/);
      expect(dmRestrictions).toMatch(/user\?\.is_admin === true \|\| user\?\.role === 'super_admin'/);
      expect(dmRestrictions).not.toMatch(/user\?\.role === 'admin'/);
    });

    it('apple auth preserves or reconstructs host-specific transport errors', () => {
      expect(appleAuth).toMatch(/err\?\.isNetworkError === true \|\| message\.startsWith\('Cannot connect to server'\)/);
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
      expect(verificationGate).toMatch(/if \(loading \|\| resendInFlightRef\.current \|\| resendCooldown > 0\) return;/);
      expect(verificationGate).toMatch(/verifyInFlightRef/);
      expect(verificationGate).toMatch(/if \(loading \|\| verifyInFlightRef\.current \|\| code\.trim\(\)\.length !== 6\) return;/);
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
      expect(manageSubscriptionScreen).toMatch(/\{\s*text:\s*'Verify now', onPress: \(\) => void router\.push\('\/verify'\)\s*\}/);
      expect(manageSubscriptionScreen).not.toMatch(/User\.requestVerification\(\)/);
    });

    it('server profile mutation routes require verified accounts before changing canonical user state', () => {
      expect(serverAuthRoutes).toMatch(/authRouter\.put\(\s*'\/me',\s*requireAuth as any,\s*requireVerified as any,/);
      expect(serverAuthRoutes).toMatch(/authRouter\.patch\(\s*'\/me',\s*requireAuth as any,\s*requireVerified as any,/);
      expect(serverAuthRoutes).toMatch(
        /authRouter\.patch\(\s*'\/me\/preferences',\s*requireAuth as any,\s*requireVerified as any,/
      );
    });
  });
});
