/**
 * Hard-delete cron for anonymized users — integration test.
 *
 * NOTE (owner decision 2026-07-17, "EVERYTHING IS DELETED NO 30 DAYS"):
 * self-serve deletion now hard-deletes immediately and never anonymizes, so
 * this cron no longer sits on the main deletion path. It is a BACKSTOP for two
 * residual row classes: the pre-2026-07-17 anonymized backlog, and the rare
 * admin whose hard-delete was blocked by the ConsentAuditLog.actor_admin
 * Restrict FK. Its selector semantics are unchanged and still worth pinning.
 *
 * Wiring is a separate concern and a separate test — this suite calls
 * `hardDeleteAnonymizedUsers` directly, which is exactly why nobody noticed
 * the cron was never started from app.ts. See cron-wiring.test.ts.
 *
 * Covers the four eligibility outcomes that matter for COPPA /
 * right-to-be-forgotten compliance:
 *
 *  1. Anonymized + deleted_at older than retention  → PURGED
 *  2. Anonymized + deleted_at recent                → NOT PURGED
 *  3. NOT anonymized + deleted_at old               → NOT PURGED (strict selector)
 *  4. Not touched at all                            → NOT PURGED
 *
 * The selector is fail-closed: both `deletion_anonymized = true` AND
 * `deleted_at < cutoff` must hold, or the row stays. The test asserts each
 * branch so a future refactor can't silently relax the selector.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

let prisma: any;
let hardDeleteAnonymizedUsers: (opts?: {
  retentionDays?: number;
  maxPerRun?: number;
}) => Promise<{ purged: number; skipped: number; scanned: number }>;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describeDb('Anonymized user hard-delete cron (hardDeleteAnonymizedUsers)', () => {
  let eligibleUserId: string;
  let tooRecentUserId: string;
  let notAnonymizedUserId: string;
  let aliveUserId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ hardDeleteAnonymizedUsers } = await import('../lib/accountDeletion.js'));
    const hash = await bcrypt.hash(PASSWORD, 10);

    // (1) Eligible: anonymized 40 days ago
    const eligible = await prisma.user.create({
      data: {
        email: `purge-eligible-${ts}@deleted.varsityhub.invalid`,
        password_hash: hash,
        display_name: 'Deleted User',
        email_verified: false,
        approval_status: 'REJECTED',
        preferences: { deleted: true },
        banned: true,
        ban_reason: 'Account deleted by user',
        deleted_at: daysAgo(40),
        deletion_anonymized: true,
      },
    });
    eligibleUserId = eligible.id;

    // (2) Anonymized recently — 10 days ago (inside retention window)
    const tooRecent = await prisma.user.create({
      data: {
        email: `purge-recent-${ts}@deleted.varsityhub.invalid`,
        password_hash: hash,
        display_name: 'Deleted User',
        email_verified: false,
        approval_status: 'REJECTED',
        preferences: { deleted: true },
        banned: true,
        ban_reason: 'Account deleted by user',
        deleted_at: daysAgo(10),
        deletion_anonymized: true,
      },
    });
    tooRecentUserId = tooRecent.id;

    // (3) deleted_at is 40 days old, but NOT anonymized — must never purge.
    // This is the fail-closed guard: deletion_anonymized=false means PII may
    // still be present on the row, so purging would destroy evidence
    // operators need. Real production should never have this shape, but the
    // selector has to be strict regardless.
    const notAnon = await prisma.user.create({
      data: {
        email: `purge-notanon-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Still Has PII',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan' },
        deleted_at: daysAgo(40),
        deletion_anonymized: false,
      },
    });
    notAnonymizedUserId = notAnon.id;

    // (4) Untouched live user — no delete state at all
    const alive = await prisma.user.create({
      data: {
        email: `purge-alive-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Active User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    aliveUserId = alive.id;
  });

  afterAll(async () => {
    // Clean up any fixtures still around (eligible is purged by the test;
    // others remain and need explicit cleanup).
    for (const id of [tooRecentUserId, notAnonymizedUserId, aliveUserId]) {
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  it('purges only the anonymized user older than the retention window', async () => {
    const result = await hardDeleteAnonymizedUsers({
      retentionDays: 30,
      maxPerRun: 10,
    });

    // At least the eligible fixture must have been purged; skipped must be 0
    // since no FK-restricted admin-consent-actor fixtures are in play here.
    expect(result.purged).toBeGreaterThanOrEqual(1);
    expect(result.skipped).toBe(0);

    // Eligible row is gone
    const eligibleStill = await prisma.user.findUnique({ where: { id: eligibleUserId } });
    expect(eligibleStill).toBeNull();

    // Too-recent anonymized row survives
    const tooRecentStill = await prisma.user.findUnique({ where: { id: tooRecentUserId } });
    expect(tooRecentStill).not.toBeNull();

    // NOT-anonymized row survives — even though deleted_at is old, the
    // deletion_anonymized=false fail-closed guard keeps it.
    const notAnonStill = await prisma.user.findUnique({ where: { id: notAnonymizedUserId } });
    expect(notAnonStill).not.toBeNull();

    // Living account survives unconditionally
    const aliveStill = await prisma.user.findUnique({ where: { id: aliveUserId } });
    expect(aliveStill).not.toBeNull();
  });

  it('is a no-op on subsequent runs once the backlog is cleared', async () => {
    // The eligible fixture was purged in the first test. Running again with
    // the same retention should find nothing to do (we only seeded one
    // eligible row for this test module, and the stale-fixture guard above
    // keeps recent rows out of scope).
    //
    // This is loose: we allow purged >= 0 because other test suites can
    // leave behind old deleted fixtures if their cleanup fails. What matters
    // is that none of OUR remaining fixtures (tooRecent, notAnon, alive)
    // were touched.
    await hardDeleteAnonymizedUsers({ retentionDays: 30, maxPerRun: 10 });

    expect(await prisma.user.findUnique({ where: { id: tooRecentUserId } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: notAnonymizedUserId } })).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: aliveUserId } })).not.toBeNull();
  });

  it('respects the maxPerRun batch cap', async () => {
    // Re-prepare two fresh eligible rows, then verify maxPerRun=1 only
    // purges one. The other must survive for the next run.
    const hash = await bcrypt.hash(PASSWORD, 10);
    const a = await prisma.user.create({
      data: {
        email: `purge-batch-a-${ts}@deleted.varsityhub.invalid`,
        password_hash: hash,
        display_name: 'Deleted User',
        email_verified: false,
        approval_status: 'REJECTED',
        preferences: { deleted: true },
        banned: true,
        deleted_at: daysAgo(50),
        deletion_anonymized: true,
      },
    });
    const b = await prisma.user.create({
      data: {
        email: `purge-batch-b-${ts}@deleted.varsityhub.invalid`,
        password_hash: hash,
        display_name: 'Deleted User',
        email_verified: false,
        approval_status: 'REJECTED',
        preferences: { deleted: true },
        banned: true,
        deleted_at: daysAgo(50),
        deletion_anonymized: true,
      },
    });

    const result = await hardDeleteAnonymizedUsers({
      retentionDays: 30,
      maxPerRun: 1,
    });

    expect(result.purged).toBe(1);
    expect(result.scanned).toBe(1);

    // One of a/b survives; the other was purged. Clean up whichever is left.
    const aStill = await prisma.user.findUnique({ where: { id: a.id } });
    const bStill = await prisma.user.findUnique({ where: { id: b.id } });
    const survivors = [aStill, bStill].filter(Boolean);
    expect(survivors.length).toBe(1);
    for (const s of survivors) {
      await prisma.user.delete({ where: { id: s!.id } }).catch(() => {});
    }
  });
});
