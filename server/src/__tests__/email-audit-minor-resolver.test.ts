/**
 * Integration test for the resolveMinorAuditMetadata helper in lib/email.ts.
 *
 * Verifies that when send-email helpers look up a recipient's age to set the
 * EMAIL_AUDIT `audit_privacy: 'minor'` flag, the lookup:
 *  - positively flags confirmed minors
 *  - does NOT flag adult recipients
 *  - does NOT flag unregistered emails (unknown-age fails OPEN for logs)
 *  - does NOT flag users with no stored DOB (legacy accounts)
 *
 * This is the production seam that decides whether a minor's address ever
 * reaches Railway stdout in EMAIL_AUDIT. A regression here would re-open the
 * COPPA logging hygiene gap even though the underlying EmailService redaction
 * mechanism stays intact.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { describeDb } from './helpers/dbTestSuite.js';
import bcrypt from 'bcrypt';

let prisma: any;
let resolveMinorAuditMetadata: (
  email: string | null | undefined
) => Promise<Record<string, string> | undefined>;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

const createdUserIds: string[] = [];

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

describeDb('resolveMinorAuditMetadata (email audit redaction resolver)', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ resolveMinorAuditMetadata } = await import('../lib/email.js'));
    const hash = await bcrypt.hash(PASSWORD, 10);

    const minor = await prisma.user.create({
      data: {
        email: `minor-redact-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Minor Fan',
        email_verified: true,
        approval_status: 'APPROVED',
        // 15 years old — squarely a minor
        date_of_birth: yearsAgo(15),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    createdUserIds.push(minor.id);

    const adult = await prisma.user.create({
      data: {
        email: `adult-redact-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Adult Coach',
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: yearsAgo(25),
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    createdUserIds.push(adult.id);

    const legacy = await prisma.user.create({
      data: {
        email: `legacy-redact-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Legacy No DOB',
        email_verified: true,
        approval_status: 'APPROVED',
        // No DOB — legacy account pre-DOB requirement.
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    createdUserIds.push(legacy.id);
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it('returns { audit_privacy: minor } for a confirmed minor recipient', async () => {
    const result = await resolveMinorAuditMetadata(`minor-redact-${ts}@example.com`);
    expect(result).toEqual({ audit_privacy: 'minor' });
  });

  it('returns undefined for an adult recipient', async () => {
    const result = await resolveMinorAuditMetadata(`adult-redact-${ts}@example.com`);
    expect(result).toBeUndefined();
  });

  it('returns undefined for a legacy user with no stored DOB (adult-assumed for logs)', async () => {
    // Rationale: fail-closed would over-redact the bulk of adult legacy
    // accounts whose DOB was never captured. resolveMinorAuditMetadata
    // deliberately departs from isMinor()'s fail-closed semantics for this
    // reason. If this test starts failing, someone flipped the default —
    // consider the ops impact before approving.
    const result = await resolveMinorAuditMetadata(`legacy-redact-${ts}@example.com`);
    expect(result).toBeUndefined();
  });

  it('returns undefined for an unregistered email (no user row)', async () => {
    const result = await resolveMinorAuditMetadata(`ghost-${ts}@nowhere.example.com`);
    expect(result).toBeUndefined();
  });

  it('is case-insensitive on the email lookup', async () => {
    const result = await resolveMinorAuditMetadata(`MINOR-REDACT-${ts}@EXAMPLE.COM`);
    expect(result).toEqual({ audit_privacy: 'minor' });
  });

  it('returns undefined for null / empty inputs', async () => {
    expect(await resolveMinorAuditMetadata(null)).toBeUndefined();
    expect(await resolveMinorAuditMetadata(undefined)).toBeUndefined();
    expect(await resolveMinorAuditMetadata('')).toBeUndefined();
  });
});
