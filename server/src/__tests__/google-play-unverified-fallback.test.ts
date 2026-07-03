/**
 * Security audit 2026-06 #4 (P2): GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK must be a
 * hard no-op in production. No env-posture script can inspect Railway's live env
 * vars from a local release gate, so this unit test IS the release-verification
 * assertion — it is wired into `test:payments:confidence`, which runs as part of
 * `npm run verify:p0:foundation`.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resolveGooglePlayUnverifiedFallback } from '../lib/googlePlayVerificationPolicy.js';

describe('resolveGooglePlayUnverifiedFallback', () => {
  let warn: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    warn.mockClear();
  });

  afterEach(() => {
    warn.mockRestore();
  });

  describe('production', () => {
    it('ignores the flag when set to 1 and warns', () => {
      const result = resolveGooglePlayUnverifiedFallback({
        NODE_ENV: 'production',
        GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK: '1',
      });

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        '[payments] GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK ignored in production'
      );
    });

    it('ignores the flag regardless of value (e.g. "true") and warns', () => {
      const result = resolveGooglePlayUnverifiedFallback({
        NODE_ENV: 'production',
        GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK: 'true',
      });

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        '[payments] GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK ignored in production'
      );
    });

    it('stays false without warning when the flag is unset', () => {
      const result = resolveGooglePlayUnverifiedFallback({ NODE_ENV: 'production' });

      expect(result).toBe(false);
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('non-production (behavior unchanged)', () => {
    it('enables the fallback when set to exactly "1" in development', () => {
      expect(
        resolveGooglePlayUnverifiedFallback({
          NODE_ENV: 'development',
          GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK: '1',
        })
      ).toBe(true);
    });

    it('does not enable the fallback for non-"1" values in development', () => {
      expect(
        resolveGooglePlayUnverifiedFallback({
          NODE_ENV: 'development',
          GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK: 'true',
        })
      ).toBe(false);
    });

    it('stays false when unset in development', () => {
      expect(resolveGooglePlayUnverifiedFallback({ NODE_ENV: 'development' })).toBe(false);
    });

    it('never warns outside production', () => {
      resolveGooglePlayUnverifiedFallback({
        NODE_ENV: 'development',
        GOOGLE_PLAY_ALLOW_UNVERIFIED_FALLBACK: '1',
      });

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
