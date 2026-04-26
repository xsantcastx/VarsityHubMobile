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
const signIn = read('app/sign-in.tsx');
const signUp = read('app/sign-up.tsx');

describe('account boundary invariants', () => {
  describe('AuthProvider session replacement', () => {
    it('checkAuth exposes a replaceSession option for fresh sign-ins', () => {
      expect(authProvider).toMatch(/replaceSession\?:\s*boolean/);
    });

    it('replaceSession clears old local auth state before refreshing /me', () => {
      const block = authProvider.match(/const checkAuth = useCallback\([\s\S]{0,5000}/)?.[0] || '';
      expect(block).toMatch(/if\s*\(options\?\.replaceSession\)\s*\{[\s\S]{0,400}clearLocalAuthState\(\)/);
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

    it('sign-in uses replaceSession when completing a new login', () => {
      expect(signIn).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
    });

    it('sign-up uses replaceSession when completing OAuth account creation', () => {
      expect(signUp).toMatch(/checkAuth\(\{\s*replaceSession:\s*true\s*\}\)/);
    });

    it('sign-in blocks Google OAuth when a user session already exists', () => {
      expect(signIn).toMatch(/handleGoogleLogin[\s\S]{0,200}if\s*\(user\?\.id\)/);
      expect(signIn).toMatch(/Sign out before using a different Google account on this device\./);
    });

    it('sign-up blocks Google OAuth when a user session already exists', () => {
      expect(signUp).toMatch(/handleGoogleSignUp[\s\S]{0,200}if\s*\(user\?\.id\)/);
      expect(signUp).toMatch(/Sign out before using a different Google account on this device\./);
    });

    it('sign-in does not route off a stale catch(() => user) fallback', () => {
      expect(signIn).not.toMatch(/User\.me\(\{\s*force:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*user\)/);
    });

    it('sign-up does not route off a stale catch(() => user) fallback', () => {
      expect(signUp).not.toMatch(/User\.me\(\{\s*force:\s*true\s*\}\)\.catch\(\(\)\s*=>\s*user\)/);
    });
  });
});
