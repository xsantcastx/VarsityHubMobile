/**
 * The platform-admin allowlist is a hardcoded floor (56a0ad5e / #83).
 *
 * Two invariants, both load-bearing:
 *
 *  1. `ADMIN_EMAILS` (and `ADMIN_NOTIFICATION_EMAILS`) MUST NOT grant admin access.
 *     They drive notification routing only. If a future change makes them grant
 *     access, anyone who can set an env var becomes a god admin.
 *
 *  2. `TEST_PLATFORM_ADMIN_EMAILS` widens the floor ONLY under NODE_ENV==='test',
 *     and is fatal at startup in production. It exists because the floor has 3
 *     identities, jest runs maxWorkers=2, and five suites each need their own admin.
 *
 * Five suites (league-review-routes, ad-report-flow, adminReports-email-review,
 * admin-transactions, api-auth) used to mint admins via `process.env.ADMIN_EMAILS`,
 * which stopped working at #83. They 403'd on every CI run for ~2 weeks and nobody
 * noticed, because `main` has no branch protection and Server Tests was already red.
 */
import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adminEmailsSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'adminEmails.ts'), 'utf8');

const { isAdminEmail, PLATFORM_ADMIN_EMAILS } = await import('../lib/adminEmails.js');

const originalTestAdmins = process.env.TEST_PLATFORM_ADMIN_EMAILS;
const originalAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (originalTestAdmins === undefined) delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
  else process.env.TEST_PLATFORM_ADMIN_EMAILS = originalTestAdmins;
  if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = originalAdminEmails;
});

describe('platform-admin allowlist floor', () => {
  beforeEach(() => {
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
  });

  it('the floor is exactly the two real mailboxes', () => {
    expect([...PLATFORM_ADMIN_EMAILS].sort()).toEqual([
      'customerservice@varsityhub.app',
      'emancero@varsityhub.app',
    ]);
  });

  it('floor mailboxes and the app-review demo account are admins', () => {
    expect(isAdminEmail('emancero@varsityhub.app')).toBe(true);
    expect(isAdminEmail('customerservice@varsityhub.app')).toBe(true);
    expect(isAdminEmail('demo@varsityhub.app')).toBe(true);
  });

  it('ADMIN_EMAILS can NEVER grant admin access', () => {
    process.env.ADMIN_EMAILS = 'attacker@example.com,admin@example.com';
    expect(isAdminEmail('attacker@example.com')).toBe(false);
    expect(isAdminEmail('admin@example.com')).toBe(false);
  });

  it('is case- and whitespace-insensitive, and rejects empty input', () => {
    expect(isAdminEmail('  EmAnCeRo@VarsityHub.App ')).toBe(true);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });
});

describe('TEST_PLATFORM_ADMIN_EMAILS seam', () => {
  afterEach(() => {
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
  });

  it('widens the floor under NODE_ENV=test', () => {
    expect(isAdminEmail('suite-admin@example.com')).toBe(false);
    process.env.TEST_PLATFORM_ADMIN_EMAILS = 'suite-admin@example.com';
    expect(isAdminEmail('suite-admin@example.com')).toBe(true);
  });

  it('is read at call time, so suites can set it inside beforeAll', () => {
    process.env.TEST_PLATFORM_ADMIN_EMAILS = 'late@example.com';
    expect(isAdminEmail('late@example.com')).toBe(true);
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
    expect(isAdminEmail('late@example.com')).toBe(false);
  });

  it('never widens the floor outside NODE_ENV=test', () => {
    process.env.TEST_PLATFORM_ADMIN_EMAILS = 'suite-admin@example.com';
    const original = process.env.NODE_ENV;
    try {
      for (const env of ['production', 'staging', 'development', undefined]) {
        if (env === undefined) delete (process.env as any).NODE_ENV;
        else (process.env as any).NODE_ENV = env;
        expect(isAdminEmail('suite-admin@example.com')).toBe(false);
        // the real floor is never affected
        expect(isAdminEmail('emancero@varsityhub.app')).toBe(true);
      }
    } finally {
      (process.env as any).NODE_ENV = original;
    }
  });

  it('setting it in production is FATAL at startup, not a warning', () => {
    // Source-level, because the guard runs at module load and process.exit(1)
    // cannot be exercised in-process. Mirrors the DISABLE_RATE_LIMITING invariant
    // in gateway-audit.test.ts: a soft warn is how privilege-escalation ships.
    const block = adminEmailsSrc.match(/rawTestPlatformAdmins[\s\S]{0,600}/)?.[0] || '';
    expect(block).toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
    expect(block).toMatch(/process\.exit\(1\)/);
  });

  it('the access path never reads process.env.ADMIN_EMAILS', () => {
    const fn = adminEmailsSrc.match(/function getPlatformAdminAccessEmails[\s\S]*?\n\}/)?.[0] || '';
    expect(fn).toMatch(/PLATFORM_ADMIN_EMAILS/);
    // `\b` so this doesn't accidentally match PLATFORM_ADMIN_EMAILS /
    // TEST_PLATFORM_ADMIN_EMAILS — the point is the *env var*, not the constant.
    expect(fn).not.toMatch(/process\.env\.ADMIN_EMAILS\b/);
    expect(adminEmailsSrc).toMatch(/function isAdminEmail[\s\S]*?getPlatformAdminAccessEmails\(\)/);
  });
});
