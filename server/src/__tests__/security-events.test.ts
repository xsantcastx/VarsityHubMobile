/**
 * Unit tests for the security event stream (lib/securityEvents).
 *
 * These pin the two properties that make the stream useful during an actual
 * attack:
 *   1. Every event is a single greppable line with a stable `[security]` prefix
 *      and a machine-parseable JSON payload (Railway log search / alerting keys
 *      on this).
 *   2. Identifiers are hashed, never raw — a leaked log bundle must not become
 *      a user/email list, and secrets must never transit the logger at all.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  SECURITY_LOG_PREFIX,
  hashIdentifier,
  logSecurityEvent,
  __resetSecurityEventSinkForTests,
  setSecurityEventSink,
} from '../lib/securityEvents.js';

describe('securityEvents', () => {
  let warnSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    __resetSecurityEventSinkForTests();
  });

  const parseLastCall = (spy: any) => {
    const line = spy.mock.calls.at(-1)?.[0] as string;
    expect(line.startsWith(SECURITY_LOG_PREFIX)).toBe(true);
    return JSON.parse(line.slice(SECURITY_LOG_PREFIX.length).trim());
  };

  describe('log shape', () => {
    it('emits a single greppable line with a parseable JSON payload', () => {
      logSecurityEvent({ type: 'auth.login_failed', severity: 'warning' });

      const line = warnSpy.mock.calls.at(-1)?.[0] as string;
      expect(typeof line).toBe('string');
      expect(line).toContain(SECURITY_LOG_PREFIX);
      expect(line.split('\n')).toHaveLength(1);
      expect(() => parseLastCall(warnSpy)).not.toThrow();
    });

    it('always includes type, severity and an ISO timestamp', () => {
      logSecurityEvent({ type: 'authz.denied', severity: 'warning' });

      const payload = parseLastCall(warnSpy);
      expect(payload.type).toBe('authz.denied');
      expect(payload.severity).toBe('warning');
      expect(new Date(payload.at).toString()).not.toBe('Invalid Date');
    });

    it('routes critical events to console.error and warnings to console.warn', () => {
      logSecurityEvent({ type: 'auth.token_reuse', severity: 'critical' });
      expect(errorSpy).toHaveBeenCalled();

      logSecurityEvent({ type: 'ratelimit.exceeded', severity: 'warning' });
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe('identifier hashing', () => {
    it('hashes user ids rather than logging them raw', () => {
      logSecurityEvent({
        type: 'authz.admin_denied',
        severity: 'warning',
        userId: 'cmrr94hqs0000abcd',
      });

      const payload = parseLastCall(warnSpy);
      expect(payload.user).toBeDefined();
      expect(payload.user).not.toContain('cmrr94hqs0000abcd');
      expect(payload.user).toMatch(/^u_[0-9a-f]{16}$/);
    });

    it('hashes emails rather than logging them raw', () => {
      logSecurityEvent({
        type: 'auth.login_failed',
        severity: 'warning',
        email: 'victim@example.com',
      });

      const payload = parseLastCall(warnSpy);
      expect(JSON.stringify(payload)).not.toContain('victim@example.com');
      expect(payload.email).toMatch(/^e_[0-9a-f]{16}$/);
    });

    it('produces stable hashes so repeated attempts correlate', () => {
      expect(hashIdentifier('u', 'same-id')).toBe(hashIdentifier('u', 'same-id'));
      expect(hashIdentifier('u', 'a')).not.toBe(hashIdentifier('u', 'b'));
    });

    it('normalizes email case before hashing so casing cannot split a hash', () => {
      expect(hashIdentifier('e', 'User@Example.com')).toBe(hashIdentifier('e', 'user@example.com'));
    });
  });

  describe('secret redaction', () => {
    it('drops secret-bearing metadata keys instead of logging them', () => {
      logSecurityEvent({
        type: 'auth.login_failed',
        severity: 'warning',
        metadata: {
          password: 'hunter2',
          refresh_token: 'rt_abc123',
          authorization: 'Bearer xyz',
          apiKey: 'sk_live_nope',
          attemptCount: 4,
        },
      });

      const serialized = JSON.stringify(parseLastCall(warnSpy));
      expect(serialized).not.toContain('hunter2');
      expect(serialized).not.toContain('rt_abc123');
      expect(serialized).not.toContain('Bearer xyz');
      expect(serialized).not.toContain('sk_live_nope');
      // Non-secret context survives — the event still has to be actionable.
      expect(parseLastCall(warnSpy).metadata.attemptCount).toBe(4);
    });
  });

  describe('resilience', () => {
    it('never throws, even when the sink itself fails', () => {
      setSecurityEventSink(() => {
        throw new Error('sentry down');
      });

      expect(() =>
        logSecurityEvent({ type: 'ratelimit.exceeded', severity: 'warning' })
      ).not.toThrow();
    });

    it('never throws on circular metadata', () => {
      const circular: any = { a: 1 };
      circular.self = circular;

      expect(() =>
        logSecurityEvent({ type: 'authz.denied', severity: 'warning', metadata: circular })
      ).not.toThrow();
    });
  });

  describe('sink routing', () => {
    it('forwards warning and critical events to the sink for alerting', () => {
      const sink = jest.fn();
      setSecurityEventSink(sink as any);

      logSecurityEvent({ type: 'auth.login_lockout', severity: 'critical' });
      expect(sink).toHaveBeenCalledTimes(1);

      logSecurityEvent({ type: 'ratelimit.exceeded', severity: 'warning' });
      expect(sink).toHaveBeenCalledTimes(2);
    });

    it('does not forward info events to the sink (avoids Sentry quota burn)', () => {
      const sink = jest.fn();
      setSecurityEventSink(sink as any);

      logSecurityEvent({ type: 'auth.login_failed', severity: 'info' });
      expect(sink).not.toHaveBeenCalled();
    });
  });
});
