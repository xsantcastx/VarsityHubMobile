/**
 * Regression tests for signed media access (lib/mediaAccess).
 *
 * Both cases below were found in the 2026-07-23 security pass and are
 * exploit-first: each fails against the pre-fix implementation.
 */
import { describe, expect, it } from '@jest/globals';

import { isSignableMediaPath, signMediaPath, verifyMediaSignature } from '../lib/mediaAccess.js';

describe('verifyMediaSignature', () => {
  const PATH = '/uploads/photo.jpg';

  it('accepts a freshly signed path', () => {
    const signed = signMediaPath(PATH);
    expect(verifyMediaSignature(signed.path, signed.token, signed.exp)).toBe(true);
  });

  it('rejects a tampered path', () => {
    const signed = signMediaPath(PATH);
    expect(verifyMediaSignature('/uploads/other.jpg', signed.token, signed.exp)).toBe(false);
  });

  it('rejects an expired signature', () => {
    const signed = signMediaPath(PATH, -10);
    expect(verifyMediaSignature(signed.path, signed.token, signed.exp)).toBe(false);
  });

  it('rejects a wrong-length token without throwing', () => {
    const signed = signMediaPath(PATH);
    expect(verifyMediaSignature(signed.path, 'deadbeef', signed.exp)).toBe(false);
  });

  /**
   * REGRESSION: the old guard compared JS string length (characters) while
   * crypto.timingSafeEqual compares byte length. A 64-CHARACTER token
   * containing one multi-byte character is 65 BYTES, so it slipped past the
   * guard and made timingSafeEqual throw a RangeError. That surfaced as an
   * unauthenticated 500 + a Sentry `unknown_error` on the public /uploads
   * media route — free error-log spam and Sentry quota burn for any scanner.
   */
  it('rejects a multi-byte token of equal character length without throwing', () => {
    const signed = signMediaPath(PATH);
    const multiByteToken = 'a'.repeat(63) + 'é'; // 64 chars, 65 bytes

    expect(multiByteToken.length).toBe(64);
    expect(Buffer.byteLength(multiByteToken)).toBe(65);

    expect(() => verifyMediaSignature(signed.path, multiByteToken, signed.exp)).not.toThrow();
    expect(verifyMediaSignature(signed.path, multiByteToken, signed.exp)).toBe(false);
  });

  it('rejects non-hex tokens of the correct length without throwing', () => {
    const signed = signMediaPath(PATH);
    expect(() => verifyMediaSignature(signed.path, 'z'.repeat(64), signed.exp)).not.toThrow();
    expect(verifyMediaSignature(signed.path, 'z'.repeat(64), signed.exp)).toBe(false);
  });
});

describe('isSignableMediaPath', () => {
  it('accepts ordinary upload paths', () => {
    expect(isSignableMediaPath('/uploads/photo.jpg')).toBe(true);
    expect(isSignableMediaPath('/uploads/avatars/user_123.png')).toBe(true);
    expect(isSignableMediaPath('/uploads/a-b_c.1.mp4')).toBe(true);
  });

  it('requires the /uploads/ prefix', () => {
    expect(isSignableMediaPath('/etc/passwd')).toBe(false);
    expect(isSignableMediaPath('/uploadsx/photo.jpg')).toBe(false);
    expect(isSignableMediaPath('uploads/photo.jpg')).toBe(false);
    expect(isSignableMediaPath('')).toBe(false);
  });

  it('rejects plain traversal', () => {
    expect(isSignableMediaPath('/uploads/../secrets')).toBe(false);
    expect(isSignableMediaPath('/uploads/a/../../b')).toBe(false);
  });

  /**
   * REGRESSION: the old check was a denylist (`rawPath.includes('..')`).
   * Percent-encoded traversal carries no literal '..' so it passed the check
   * and got a valid HMAC minted for it. express.static blocked the actual read,
   * so this was never a file-disclosure bug — but signing attacker-shaped paths
   * is the wrong default. The allowlist below cannot express traversal at all.
   */
  it('rejects percent-encoded and double-encoded traversal', () => {
    expect(isSignableMediaPath('/uploads/%2e%2e/secrets')).toBe(false);
    expect(isSignableMediaPath('/uploads/%252e%252e/secrets')).toBe(false);
    expect(isSignableMediaPath('/uploads/%2f%2e%2e')).toBe(false);
  });

  it('rejects backslashes, null bytes, newlines and control characters', () => {
    expect(isSignableMediaPath('/uploads/..\\..\\secrets')).toBe(false);
    expect(isSignableMediaPath('/uploads/a\0b')).toBe(false);
    expect(isSignableMediaPath('/uploads/a\nb')).toBe(false);
  });

  it('rejects query/fragment smuggling into the signed value', () => {
    expect(isSignableMediaPath('/uploads/a.jpg?x=1')).toBe(false);
    expect(isSignableMediaPath('/uploads/a.jpg#frag')).toBe(false);
  });

  it('rejects absolute URLs and protocol-relative paths', () => {
    expect(isSignableMediaPath('//evil.com/uploads/x.jpg')).toBe(false);
    expect(isSignableMediaPath('/uploads/https://evil.com')).toBe(false);
  });

  it('bounds path length', () => {
    expect(isSignableMediaPath('/uploads/' + 'a'.repeat(4096))).toBe(false);
  });
});
