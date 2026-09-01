/**
 * Parental consent helper tests.
 *
 * Pure-function tests (no DB) live in the top-level describe so they run in
 * any environment. DB-backed flow tests go under `describeDb` so they can be
 * skipped in CI or when no local Postgres is wired.
 */

import { describe, expect, it } from '@jest/globals';
import { describeDb } from './helpers/dbTestSuite.js';

describe('parentalConsent helpers (pure)', () => {
  it('generates a 64-char hex token and a distinct 64-char hex hash', async () => {
    const { generateConsentToken } = await import('../lib/parentalConsent.js');
    const { raw, hash } = generateConsentToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(raw);
  });

  it('hashConsentToken is deterministic', async () => {
    const { hashConsentToken } = await import('../lib/parentalConsent.js');
    const a = hashConsentToken('some-token-value');
    const b = hashConsentToken('some-token-value');
    expect(a).toBe(b);
  });

  it('hashConsentToken is sensitive to input differences', async () => {
    const { hashConsentToken } = await import('../lib/parentalConsent.js');
    const a = hashConsentToken('token-a');
    const b = hashConsentToken('token-b');
    expect(a).not.toBe(b);
  });

  it('each generated token is unique', async () => {
    const { generateConsentToken } = await import('../lib/parentalConsent.js');
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { raw } = generateConsentToken();
      expect(seen.has(raw)).toBe(false);
      seen.add(raw);
    }
  });

  it('exposes a 14-day expiry window', async () => {
    const { PARENTAL_CONSENT_EXPIRY_MS } = await import('../lib/parentalConsent.js');
    expect(PARENTAL_CONSENT_EXPIRY_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });
});
