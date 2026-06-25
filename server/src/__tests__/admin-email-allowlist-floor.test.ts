import { describe, expect, it } from '@jest/globals';
import { isAdminEmail, PLATFORM_ADMIN_EMAILS } from '../lib/adminEmails.js';

/**
 * Rule (2026-06-25): platform/god admin access is restricted to a hardcoded
 * floor — only emancero@ and customerservice@varsityhub.app (plus the App Store
 * review demo account). The ADMIN_EMAILS env var must NOT be able to widen this
 * set, so a misconfigured env can never grant admin to a regular user.
 */
describe('admin email allowlist floor', () => {
  it('the floor is exactly the two approved mailboxes', () => {
    expect([...PLATFORM_ADMIN_EMAILS].sort()).toEqual(
      ['customerservice@varsityhub.app', 'emancero@varsityhub.app'].sort()
    );
  });

  it('admits the two approved mailboxes (case-insensitive)', () => {
    expect(isAdminEmail('emancero@varsityhub.app')).toBe(true);
    expect(isAdminEmail('customerservice@varsityhub.app')).toBe(true);
    expect(isAdminEmail('EMANCERO@VarsityHub.app')).toBe(true);
    expect(isAdminEmail('  customerservice@varsityhub.app  ')).toBe(true);
  });

  it('admits the App Store review demo account', () => {
    expect(isAdminEmail('demo@varsityhub.app')).toBe(true);
  });

  it('denies every other email, including null/empty', () => {
    expect(isAdminEmail('coach@varsityhub.app')).toBe(false);
    expect(isAdminEmail('admin@varsityhub.app')).toBe(false);
    expect(isAdminEmail('regular.user@gmail.com')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail('')).toBe(false);
  });

  it('the ADMIN_EMAILS env var cannot widen admin access', () => {
    const prev = process.env.ADMIN_EMAILS;
    try {
      process.env.ADMIN_EMAILS = 'attacker@evil.com,someoneelse@varsityhub.app';
      // isAdminEmail reads the hardcoded floor, not the env — these stay denied.
      expect(isAdminEmail('attacker@evil.com')).toBe(false);
      expect(isAdminEmail('someoneelse@varsityhub.app')).toBe(false);
      // ...and the floor still works regardless of env.
      expect(isAdminEmail('emancero@varsityhub.app')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = prev;
    }
  });
});
