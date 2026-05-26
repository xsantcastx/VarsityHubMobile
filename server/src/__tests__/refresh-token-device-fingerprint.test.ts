/**
 * Refresh token device fingerprint enforcement tests.
 *
 * Covers:
 * - device_id-bound tokens (vh1: prefix) are hard-rejected on mismatch
 * - user-agent-bound tokens (ua: prefix / legacy) are soft-rejected (warn, not reject)
 * - Missing stored fingerprint passes through (pre-fingerprint tokens)
 */

import { describe, expect, it } from '@jest/globals';
import type { Request } from 'express';
import {
  buildSessionFingerprint,
  verifyStoredSessionFingerprint,
} from '../lib/sessionFingerprint.js';

function mockRequest(headers: Record<string, string>): Request {
  return { headers, ip: '127.0.0.1', path: '/auth/refresh' } as unknown as Request;
}

describe('Session fingerprint — device_id path (vh1: prefix)', () => {
  const deviceId = 'vh1:abc123def456ghi7';
  const req = mockRequest({ 'x-varsityhub-device-id': 'abc123def456ghi7' });

  it('matches when device_id is identical', () => {
    const result = verifyStoredSessionFingerprint(deviceId, req);
    expect(result.matches).toBe(true);
    expect(result.enforce).toBe(true);
    expect(result.reason).toBe('device_id_match');
  });

  it('hard-rejects on device_id mismatch (enforce=true)', () => {
    const otherReq = mockRequest({ 'x-varsityhub-device-id': 'zzzzzzzzzzzzzzzz' });
    const result = verifyStoredSessionFingerprint(deviceId, otherReq);
    expect(result.matches).toBe(false);
    expect(result.enforce).toBe(true);
    expect(result.reason).toBe('device_id_mismatch');
  });

  it('hard-rejects when device_id header is absent (enforce=true)', () => {
    const noDeviceReq = mockRequest({ 'user-agent': 'SomeBrowser/1.0' });
    const result = verifyStoredSessionFingerprint(deviceId, noDeviceReq);
    expect(result.matches).toBe(false);
    expect(result.enforce).toBe(true);
    expect(result.reason).toBe('device_id_missing');
  });
});

describe('Session fingerprint — user-agent path (legacy, enforce=false)', () => {
  const ua = 'VarsityHub/1.0.3 (iOS 17.4)';
  const storedLegacy = `ua:${ua}`;
  const req = mockRequest({ 'user-agent': ua });

  it('matches when user-agent is identical', () => {
    const result = verifyStoredSessionFingerprint(storedLegacy, req);
    expect(result.matches).toBe(true);
    expect(result.enforce).toBe(false);
    expect(result.reason).toBe('legacy_match');
  });

  it('does NOT enforce on user-agent mismatch (warn only)', () => {
    const otherReq = mockRequest({ 'user-agent': 'DifferentAgent/2.0' });
    const result = verifyStoredSessionFingerprint(storedLegacy, otherReq);
    expect(result.matches).toBe(false);
    expect(result.enforce).toBe(false); // soft reject — warn in logs but don't block
    expect(result.reason).toBe('legacy_mismatch');
  });
});

describe('Session fingerprint — missing stored fingerprint', () => {
  it('passes through with enforce=false when no fingerprint was stored', () => {
    const req = mockRequest({ 'user-agent': 'SomeBrowser/1.0' });
    const result = verifyStoredSessionFingerprint(null, req);
    expect(result.matches).toBe(true);
    expect(result.enforce).toBe(false);
    expect(result.reason).toBe('missing_stored');
  });

  it('passes through for undefined stored fingerprint', () => {
    const req = mockRequest({});
    const result = verifyStoredSessionFingerprint(undefined, req);
    expect(result.matches).toBe(true);
    expect(result.enforce).toBe(false);
  });
});

describe('buildSessionFingerprint', () => {
  it('prefers device_id header over user-agent', () => {
    const req = mockRequest({
      'x-varsityhub-device-id': 'abcdef1234567890',
      'user-agent': 'SomeBrowser/1.0',
    });
    const fp = buildSessionFingerprint(req);
    expect(fp).toBe('vh1:abcdef1234567890');
  });

  it('falls back to user-agent when no device_id', () => {
    const req = mockRequest({ 'user-agent': 'SomeBrowser/1.0' });
    const fp = buildSessionFingerprint(req);
    expect(fp).toBe('ua:SomeBrowser/1.0');
  });

  it('returns null when neither header is present', () => {
    const req = mockRequest({});
    const fp = buildSessionFingerprint(req);
    expect(fp).toBeNull();
  });

  it('rejects device_id header with invalid characters', () => {
    const req = mockRequest({ 'x-varsityhub-device-id': '<script>alert(1)</script>' });
    const fp = buildSessionFingerprint(req);
    // Falls through to UA since device_id failed validation
    expect(fp).toBeNull();
  });
});
