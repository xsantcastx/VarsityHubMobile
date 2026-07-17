import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import { autoEscalate, STRIKE_LADDER } from '../lib/moderation.js';
import { prisma } from '../lib/prisma.js';

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkipDbTests ? describe.skip : describe;

/**
 * Regression suite for the owner's 3-strike ladder (2026-07-16):
 *   strike 1 → warning, 2 → 7d, 3 → 45d, 4 → permanent ban (data retained).
 *
 * Exercises lib/moderation.ts autoEscalate against a real Postgres, because the
 * two properties that matter most — the (reporter, target) de-dupe and the
 * one-strike-per-content idempotency gate — are DB unique indexes. A mocked
 * Prisma would assert nothing about either.
 */

const TAG = `ladder_${Date.now()}`;
const createdUserIds: string[] = [];

async function makeUser(label: string): Promise<string> {
  const user = await prisma.user.create({
    data: {
      email: `${TAG}_${label}_${Math.random().toString(36).slice(2, 8)}@varsityhub.test`,
      display_name: `Ladder ${label}`,
      email_verified: true,
    },
    select: { id: true },
  });
  createdUserIds.push(user.id);
  return user.id;
}

/** File one report against a piece of content, mirroring what POST /reports writes. */
async function report(reporterId: string, targetId: string, targetUserId: string) {
  return prisma.abuseReport.create({
    data: {
      reporter_id: reporterId,
      reporter_name: 'Reporter',
      reporter_email: `${reporterId}@varsityhub.test`,
      subject: `[post:${targetId}] spam`,
      message: '{}',
      status: 'pending',
      target_type: 'post',
      target_id: targetId,
      target_user_id: targetUserId,
    },
  });
}

/** Drive one full content item from clean to struck: 3 distinct reporters. */
async function strikeOnce(authorId: string, contentId: string, reporters: string[]) {
  for (const reporterId of reporters) {
    await report(reporterId, contentId, authorId);
  }
  return autoEscalate({ targetType: 'post', targetId: contentId, targetUserId: authorId });
}

describeDb('moderation 3-strike ladder', () => {
  let authorId: string;
  let reporters: string[];

  beforeAll(async () => {
    reporters = [await makeUser('r1'), await makeUser('r2'), await makeUser('r3')];
  });

  afterEach(async () => {
    // Reset the author between cases so each test owns its own ladder.
    if (authorId) {
      await prisma.userWarning.deleteMany({ where: { user_id: authorId } });
      await prisma.abuseReport.deleteMany({ where: { target_user_id: authorId } });
    }
  });

  afterAll(async () => {
    await prisma.userWarning.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.abuseReport.deleteMany({ where: { reporter_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('walks the full ladder: warning → 7d → 45d → permanent ban', async () => {
    authorId = await makeUser('author_full');

    // ── Strike 1 → warning. Notice only; access is untouched.
    const s1 = await strikeOnce(authorId, `${TAG}_c1`, reporters);
    expect(s1).toMatchObject({ action: 'warning', step: 1 });
    let user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(false);
    expect(user.banned_until).toBeNull();

    // ── Strike 2 → 7-day suspension.
    const s2 = await strikeOnce(authorId, `${TAG}_c2`, reporters);
    expect(s2).toMatchObject({ action: 'suspension_7d', step: 2 });
    user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(false);
    const days7 = (user.banned_until!.getTime() - Date.now()) / 86_400_000;
    expect(days7).toBeGreaterThan(6.9);
    expect(days7).toBeLessThan(7.1);

    // ── Strike 3 → 45-day suspension.
    const s3 = await strikeOnce(authorId, `${TAG}_c3`, reporters);
    expect(s3).toMatchObject({ action: 'suspension_45d', step: 3 });
    user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(false);
    const days45 = (user.banned_until!.getTime() - Date.now()) / 86_400_000;
    expect(days45).toBeGreaterThan(44.9);
    expect(days45).toBeLessThan(45.1);

    // ── Strike 4 → permanent ban that RETAINS the data.
    const s4 = await strikeOnce(authorId, `${TAG}_c4`, reporters);
    expect(s4).toMatchObject({ action: 'ban', step: 4 });
    user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(true);

    // The whole point of "ban, not purge": the row and its history survive.
    expect(user.deleted_at).toBeNull();
    expect(user.email).toContain('@varsityhub.test');
    expect(await prisma.userWarning.count({ where: { user_id: authorId } })).toBe(4);
  });

  it('does NOT advance the ladder on a duplicate report from the same reporter', async () => {
    authorId = await makeUser('author_dupe');
    const [solo] = reporters;

    // The DB refuses the second report outright — this is the de-dupe guard that
    // stops one account from walking a victim up all four rungs alone.
    await report(solo, `${TAG}_dupe`, authorId);
    await expect(report(solo, `${TAG}_dupe`, authorId)).rejects.toMatchObject({ code: 'P2002' });

    // Even reporting many DIFFERENT posts, one reporter is one vote per post and
    // never reaches the 3-reporter threshold on any of them.
    for (const contentId of [`${TAG}_d1`, `${TAG}_d2`, `${TAG}_d3`, `${TAG}_d4`]) {
      await report(solo, contentId, authorId);
      const res = await autoEscalate({
        targetType: 'post',
        targetId: contentId,
        targetUserId: authorId,
      });
      expect(res.action).toBe('none');
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(false);
    expect(user.banned_until).toBeNull();
    expect(await prisma.userWarning.count({ where: { user_id: authorId } })).toBe(0);
  });

  it('is idempotent: re-processing the same report never double-strikes', async () => {
    authorId = await makeUser('author_idem');

    const first = await strikeOnce(authorId, `${TAG}_idem`, reporters);
    expect(first).toMatchObject({ action: 'warning', step: 1 });

    // Replay the same escalation repeatedly, and pile on more reports for the
    // same content. One piece of content mints exactly one strike, forever.
    for (let i = 0; i < 3; i++) {
      const replay = await autoEscalate({
        targetType: 'post',
        targetId: `${TAG}_idem`,
        targetUserId: authorId,
      });
      expect(replay.action).toBe('none');
    }
    const extra = await makeUser('r_extra');
    await report(extra, `${TAG}_idem`, authorId);
    expect(
      (await autoEscalate({ targetType: 'post', targetId: `${TAG}_idem`, targetUserId: authorId }))
        .action
    ).toBe('none');

    expect(await prisma.userWarning.count({ where: { user_id: authorId } })).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned_until).toBeNull();
  });

  it('ignores self-reports and reports across a block relationship', async () => {
    authorId = await makeUser('author_filtered');
    const blocked = await makeUser('blocked_reporter');
    const clean = await makeUser('clean_reporter');

    await prisma.blockedUser.create({
      data: { blocker_id: authorId, blocked_id: blocked },
    });

    // 3 reports, but only 1 counts: the author's own, the blocked user's, and
    // one legitimate report. Threshold is 3 valid → nothing should happen.
    await report(authorId, `${TAG}_filt`, authorId);
    await report(blocked, `${TAG}_filt`, authorId);
    await report(clean, `${TAG}_filt`, authorId);

    const res = await autoEscalate({
      targetType: 'post',
      targetId: `${TAG}_filt`,
      targetUserId: authorId,
    });
    expect(res.action).toBe('none');
    expect(await prisma.userWarning.count({ where: { user_id: authorId } })).toBe(0);

    await prisma.blockedUser.deleteMany({ where: { blocker_id: authorId } });
  });

  it('does not count dismissed reports, so an admin can defuse the ladder', async () => {
    authorId = await makeUser('author_dismissed');

    for (const reporterId of reporters) {
      await report(reporterId, `${TAG}_dis`, authorId);
    }
    await prisma.abuseReport.updateMany({
      where: { target_id: `${TAG}_dis` },
      data: { status: 'dismissed' },
    });

    const res = await autoEscalate({
      targetType: 'post',
      targetId: `${TAG}_dis`,
      targetUserId: authorId,
    });
    expect(res.action).toBe('none');
    expect(await prisma.userWarning.count({ where: { user_id: authorId } })).toBe(0);
  });

  it('writes an AdminActivityLog row for every strike (audit invariant)', async () => {
    authorId = await makeUser('author_audit');
    await prisma.adminActivityLog.deleteMany({ where: { target_id: authorId } });

    await strikeOnce(authorId, `${TAG}_a1`, reporters);
    await strikeOnce(authorId, `${TAG}_a2`, reporters);

    const logs = await prisma.adminActivityLog.findMany({
      where: { target_id: authorId, action: 'AUTO_STRIKE' },
      orderBy: { timestamp: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[0].metadata).toMatchObject({ step: 1, ladder_action: 'warning' });
    expect(logs[1].metadata).toMatchObject({ step: 2, ladder_action: 'suspension_7d' });

    await prisma.adminActivityLog.deleteMany({ where: { target_id: authorId } });
  });

  it('excludes admin-issued warnings from the ladder position', async () => {
    authorId = await makeUser('author_adminwarn');

    // An admin warning leaves source_type NULL. It must not push the user a rung
    // closer to an automatic ban.
    await prisma.userWarning.create({
      data: { user_id: authorId, reason: 'Admin warning', severity: 'warning' },
    });
    await prisma.userWarning.create({
      data: { user_id: authorId, reason: 'Admin strike', severity: 'strike' },
    });

    const res = await strikeOnce(authorId, `${TAG}_aw`, reporters);
    expect(res).toMatchObject({ action: 'warning', step: 1 });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: authorId } });
    expect(user.banned).toBe(false);
    expect(user.banned_until).toBeNull();
  });

  it('encodes exactly the owner-specified ladder', () => {
    expect(STRIKE_LADDER.map(r => [r.action, r.suspensionDays])).toEqual([
      ['warning', null],
      ['suspension_7d', 7],
      ['suspension_45d', 45],
      ['ban', null],
    ]);
  });
});
