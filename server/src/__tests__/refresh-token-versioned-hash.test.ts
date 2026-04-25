/**
 * Refresh-token versioned hash regression suite.
 *
 * Locks in the v1 → v2 migration contract:
 *   - Newly generated tokens parse as v2 with `<keyId>.<secret>` shape.
 *   - `verifyRefreshTokenHash` accepts both v1 SHA-256 entries (legacy)
 *     and v2 bcrypt entries.
 *   - Hashes are non-deterministic for v2 (bcrypt salt) but verification
 *     still returns true.
 *   - Wrong tokens fail under both versions.
 *   - parseRefreshToken correctly distinguishes shapes.
 *
 * Pure unit tests — no DB.
 */

import { describe, it, expect } from '@jest/globals';
import {
  generateRefreshToken,
  generateRefreshTokenV2,
  hashRefreshToken,
  hashRefreshTokenSecret,
  parseRefreshToken,
  verifyRefreshTokenHash,
  REFRESH_TOKEN_HASH_VERSION_V2,
} from '../lib/jwt.js';

describe('Refresh token v1 / v2 verification', () => {
  describe('parseRefreshToken', () => {
    it('returns v2 shape for `<16-hex>.<rest>`', () => {
      const { raw, keyId, secret } = generateRefreshTokenV2();
      const parsed = parseRefreshToken(raw);
      expect(parsed.version).toBe(2);
      if (parsed.version === 2) {
        expect(parsed.keyId).toBe(keyId);
        expect(parsed.secret).toBe(secret);
      }
    });

    it('returns v1 shape for legacy 64-char hex tokens', () => {
      const legacy = generateRefreshToken();
      expect(legacy).toMatch(/^[a-f0-9]{64}$/);
      const parsed = parseRefreshToken(legacy);
      expect(parsed.version).toBe(1);
    });

    it('returns v1 for malformed prefixes', () => {
      // dot in wrong position
      expect(parseRefreshToken('short.secret').version).toBe(1);
      // dot at position 16 but non-hex prefix
      expect(parseRefreshToken('zzzzzzzzzzzzzzzz.secret').version).toBe(1);
      // no dot
      expect(parseRefreshToken('justrandomthing').version).toBe(1);
    });
  });

  describe('verifyRefreshTokenHash — v2 (bcrypt)', () => {
    it('verifies a freshly issued v2 token against its bcrypt hash', async () => {
      const { raw, secret } = generateRefreshTokenV2();
      const hash = await hashRefreshTokenSecret(secret);
      const ok = await verifyRefreshTokenHash(raw, hash, REFRESH_TOKEN_HASH_VERSION_V2);
      expect(ok).toBe(true);
    });

    it('rejects a tampered secret half', async () => {
      const { raw, secret } = generateRefreshTokenV2();
      const hash = await hashRefreshTokenSecret(secret);
      // Flip one character in the secret half
      const dotIdx = raw.indexOf('.');
      const tampered = raw.slice(0, dotIdx + 1) + 'f' + raw.slice(dotIdx + 2);
      const ok = await verifyRefreshTokenHash(tampered, hash, REFRESH_TOKEN_HASH_VERSION_V2);
      expect(ok).toBe(false);
    });

    it('rejects a v1-shaped token presented under v2', async () => {
      const legacy = generateRefreshToken();
      const hash = await hashRefreshTokenSecret('any-secret');
      const ok = await verifyRefreshTokenHash(legacy, hash, REFRESH_TOKEN_HASH_VERSION_V2);
      expect(ok).toBe(false);
    });

    it('produces non-deterministic hashes (bcrypt salt) but both verify', async () => {
      const { raw, secret } = generateRefreshTokenV2();
      const h1 = await hashRefreshTokenSecret(secret);
      const h2 = await hashRefreshTokenSecret(secret);
      expect(h1).not.toBe(h2);
      expect(await verifyRefreshTokenHash(raw, h1, REFRESH_TOKEN_HASH_VERSION_V2)).toBe(true);
      expect(await verifyRefreshTokenHash(raw, h2, REFRESH_TOKEN_HASH_VERSION_V2)).toBe(true);
    });
  });

  describe('verifyRefreshTokenHash — v1 (SHA-256, legacy)', () => {
    it('verifies a legacy token against its SHA-256 hash', async () => {
      const legacy = generateRefreshToken();
      const hash = hashRefreshToken(legacy);
      const ok = await verifyRefreshTokenHash(legacy, hash, 1);
      expect(ok).toBe(true);
    });

    it('verifies legacy tokens when version is null/undefined (defaults to 1)', async () => {
      const legacy = generateRefreshToken();
      const hash = hashRefreshToken(legacy);
      expect(await verifyRefreshTokenHash(legacy, hash, null)).toBe(true);
      expect(await verifyRefreshTokenHash(legacy, hash, undefined)).toBe(true);
    });

    it('rejects a different token under v1', async () => {
      const a = generateRefreshToken();
      const b = generateRefreshToken();
      const hashA = hashRefreshToken(a);
      const ok = await verifyRefreshTokenHash(b, hashA, 1);
      expect(ok).toBe(false);
    });

    it('rejects a v2 token presented under v1', async () => {
      const { raw } = generateRefreshTokenV2();
      const hash = hashRefreshToken('something-unrelated');
      const ok = await verifyRefreshTokenHash(raw, hash, 1);
      expect(ok).toBe(false);
    });
  });

  describe('hash format invariants', () => {
    it('keyId is exactly 16 lowercase hex chars', () => {
      const { keyId } = generateRefreshTokenV2();
      expect(keyId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('secret is exactly 64 lowercase hex chars (32 random bytes)', () => {
      const { secret } = generateRefreshTokenV2();
      expect(secret).toMatch(/^[a-f0-9]{64}$/);
    });

    it('bcrypt hash starts with $2 (any cost)', async () => {
      const hash = await hashRefreshTokenSecret('test-secret');
      expect(hash).toMatch(/^\$2[aby]?\$\d+\$/);
    });

    it('REFRESH_TOKEN_HASH_VERSION_V2 is 2', () => {
      expect(REFRESH_TOKEN_HASH_VERSION_V2).toBe(2);
    });
  });
});
