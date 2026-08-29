/**
 * Moderation Service
 *
 * Handles the strike/warning system, auto-escalation from reports,
 * temporary suspensions, and admin spike notifications.
 */

import { prisma } from './prisma.js';
import { logAdminActivity } from './adminActivityLogger.js';
import { getBlockedUserIds } from './privacyUtils.js';
import { updateUserAndInvalidate } from './userCache.js';

// Escalation thresholds — env-overridable for tuning at scale without redeploy.
// v1.0.2 pass 9: previously hardcoded constants; now pulled from env with the same defaults.
const intEnv = (key: string, defaultValue: number): number => {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
};
const SPIKE_THRESHOLD = intEnv('MOD_SPIKE_THRESHOLD', 10); // pending reports → spike alert

/**
 * Distinct valid reporters a single piece of content needs before it earns its
 * author one strike (owner rule, 2026-07-16).
 *
 * Why 3: reports are de-duped at the DB level to one per (reporter, target),
 * and self-reports plus reports across a block relationship are discarded — so
 * 3 means three unrelated accounts independently flagged the same content.
 * That is cheap enough to act inside a single event's lifetime (the fest use
 * case) while making a solo griefer mathematically unable to strike anyone:
 * one attacker contributes at most 1 of the 3 required.
 */
const POST_STRIKE_REPORT_THRESHOLD = intEnv('MOD_POST_STRIKE_REPORT_THRESHOLD', 3);

// Report statuses that count toward a strike. `dismissed` is excluded — an
// admin dismissing a report must be able to defuse the ladder.
const ACTIVE_REPORT_STATUSES = ['pending', 'reviewed', 'resolved'] as const;

// Cap on reporters examined per content item. Well above the threshold; exists
// only to honor the repo's "every findMany has a take" rule.
const REPORTER_SCAN_LIMIT = 500;

export type LadderAction = 'warning' | 'suspension_7d' | 'suspension_45d' | 'ban';

/**
 * The owner's ladder: "3 strikes and ur out — first warning → then 7 day
 * suspension → then 45 day suspension → then deleted account."
 *
 * Rung N is applied on the user's Nth ladder strike. Past rung 4 the user is
 * already permanently banned, so there is nothing further to apply.
 *
 * "Deleted account" (rung 4) is a PERMANENT BAN THAT RETAINS THE DATA — the
 * user is locked out and their content is hidden, but every row is kept and an
 * admin can reverse it. It is deliberately NOT a purge; that matches the
 * deferred permanent-deletion decision.
 */
export const STRIKE_LADDER: readonly {
  step: number;
  action: LadderAction;
  severity: 'warning' | 'strike' | 'final_warning';
  suspensionDays: number | null;
}[] = [
  { step: 1, action: 'warning', severity: 'warning', suspensionDays: null },
  { step: 2, action: 'suspension_7d', severity: 'strike', suspensionDays: 7 },
  { step: 3, action: 'suspension_45d', severity: 'strike', suspensionDays: 45 },
  { step: 4, action: 'ban', severity: 'final_warning', suspensionDays: null },
];

const SYSTEM_ACTOR_ID = 'system';
const SYSTEM_ACTOR_EMAIL = 'system@varsityhub';

/**
 * Issue a warning to a user
 */
export async function issueWarning(params: {
  userId: string;
  reason: string;
  severity?: 'warning' | 'strike' | 'final_warning';
  issuedBy?: string;
  reportId?: string;
  /** Ladder provenance — set only by the automatic ladder, never by admin paths. */
  sourceType?: string;
  sourceId?: string;
}): Promise<{ id: string; totalWarnings: number; totalStrikes: number }> {
  const { userId, reason, severity = 'warning', issuedBy, reportId, sourceType, sourceId } = params;

  const warning = await prisma.userWarning.create({
    data: {
      user_id: userId,
      issued_by: issuedBy || null,
      reason,
      severity,
      report_id: reportId || null,
      source_type: sourceType || null,
      source_id: sourceId || null,
    },
  });

  // Count active warnings and strikes
  const counts = await getWarningCounts(userId);

  // Log admin activity if issued by admin
  if (issuedBy) {
    const admin = await prisma.user.findUnique({
      where: { id: issuedBy },
      select: { email: true },
    });
    await logAdminActivity(
      issuedBy,
      admin?.email || 'system',
      `Issue ${severity}`,
      'user',
      userId,
      `Issued ${severity} to user: ${reason}`,
      { warning_id: warning.id, report_id: reportId }
    );
  }

  return { id: warning.id, ...counts };
}

/**
 * Get warning/strike counts for a user
 */
export async function getWarningCounts(
  userId: string
): Promise<{ totalWarnings: number; totalStrikes: number }> {
  const [totalWarnings, totalStrikes] = await Promise.all([
    prisma.userWarning.count({ where: { user_id: userId, severity: 'warning' } }),
    prisma.userWarning.count({
      where: { user_id: userId, severity: { in: ['strike', 'final_warning'] } },
    }),
  ]);
  return { totalWarnings, totalStrikes };
}

/**
 * Count the reporters of one piece of content that actually count toward a
 * strike. This is the abuse-resistance core of the auto-ladder.
 *
 * Three filters, all of them load-bearing:
 *  1. DISTINCT reporter — belt-and-braces on top of the DB unique index on
 *     (reporter_id, target_type, target_id). One account = one vote, forever.
 *  2. Self-reports never count. The /reports route already rejects them, but
 *     counting must not depend on a sibling path's guard holding.
 *  3. Reports across a block relationship never count. `getBlockedUserIds` is
 *     bidirectional (blocked + blocked-by), so this also drops reports from
 *     someone the author blocked *and* someone who blocked the author. That is
 *     a superset of the owner's rule, and it errs toward FEWER automatic
 *     punishments — the safe direction for an unsupervised sanction.
 *
 * Anonymous reports (reporter_id NULL) never count: they cannot be de-duped,
 * so one script could mint unlimited "distinct" reporters.
 */
async function countValidReporters(
  targetType: string,
  targetId: string,
  targetUserId: string
): Promise<number> {
  const [rows, blockedIds] = await Promise.all([
    prisma.abuseReport.findMany({
      where: {
        target_type: targetType,
        target_id: targetId,
        status: { in: [...ACTIVE_REPORT_STATUSES] },
        reporter_id: { not: null },
      },
      select: { reporter_id: true },
      take: REPORTER_SCAN_LIMIT,
    }),
    getBlockedUserIds(targetUserId),
  ]);

  const blocked = new Set(blockedIds);
  const valid = new Set<string>();
  for (const row of rows) {
    const reporterId = row.reporter_id;
    if (!reporterId) continue;
    if (reporterId === targetUserId) continue; // self-report
    if (blocked.has(reporterId)) continue; // block relationship
    valid.add(reporterId);
  }
  return valid.size;
}

/**
 * Apply one rung of the ladder to a user. Sanction writes mirror the admin
 * paths exactly — including the session_epoch bump and refresh-token purge,
 * which the old auto-escalation omitted, leaving an auto-banned user with a
 * live access token until it expired on its own.
 */
async function applyLadderRung(
  userId: string,
  rung: (typeof STRIKE_LADDER)[number],
  reason: string
): Promise<void> {
  if (rung.action === 'warning') return; // rung 1 is notice-only; no access change

  if (rung.action === 'ban') {
    // Permanent ban that RETAINS the data: locked out, content hidden, every
    // row kept, reversible by an admin. Never a purge.
    await updateUserAndInvalidate(prisma, {
      where: { id: userId },
      data: { banned: true, ban_reason: reason, session_epoch: { increment: 1 } },
    });
  } else {
    const until = new Date(Date.now() + (rung.suspensionDays ?? 0) * 24 * 60 * 60 * 1000);
    await updateUserAndInvalidate(prisma, {
      where: { id: userId },
      data: { banned_until: until, ban_reason: reason, session_epoch: { increment: 1 } },
    });
  }
  await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(err => {
    console.warn('[moderation] failed to delete refresh tokens after enforcement', {
      user_id: userId,
      reason: (err as Error)?.message || String(err),
    });
  });
}

/**
 * The automatic 3-strike ladder (owner rule, 2026-07-16).
 *
 * Called after a content report is created. When a single piece of content
 * reaches POST_STRIKE_REPORT_THRESHOLD distinct valid reporters, its author
 * earns exactly ONE strike, and the strike advances them one rung:
 *
 *   strike 1 → warning
 *   strike 2 → 7-day suspension
 *   strike 3 → 45-day suspension
 *   strike 4 → permanent ban (data retained)
 *
 * Idempotency: the strike row carries (source_type, source_id) under a unique
 * index, so the same content can never mint a second strike no matter how many
 * further reports arrive or how many times this runs concurrently. The loser of
 * the race exits as a no-op.
 *
 * Ladder position is derived server-side from committed rows only — there is no
 * client input and no cached counter to fall out of sync.
 */
export async function autoEscalate(params: {
  targetType: string;
  targetId: string;
  targetUserId: string;
}): Promise<{
  action: 'none' | LadderAction;
  step?: number;
  message?: string;
}> {
  const { targetType, targetId, targetUserId } = params;

  // Cheap exit: this content already struck its author. Skips the reporter scan
  // entirely for the common case of a piece of content that keeps drawing
  // reports after it has already been actioned.
  const existing = await prisma.userWarning.findUnique({
    where: { source_type_source_id: { source_type: targetType, source_id: targetId } },
    select: { id: true },
  });
  if (existing) return { action: 'none' };

  const validReporters = await countValidReporters(targetType, targetId, targetUserId);
  if (validReporters < POST_STRIKE_REPORT_THRESHOLD) return { action: 'none' };

  // Mint the strike FIRST. The unique index on (source_type, source_id) is the
  // idempotency gate — if a concurrent report already minted this content's
  // strike, we lose on P2002 and bail without touching the user.
  let warningId: string;
  try {
    const created = await prisma.userWarning.create({
      data: {
        user_id: targetUserId,
        reason: `Automatic strike: content reported by ${validReporters} members.`,
        severity: 'warning', // provisional; corrected to the rung's severity below
        source_type: targetType,
        source_id: targetId,
      },
      select: { id: true },
    });
    warningId = created.id;
  } catch (err: any) {
    if (err?.code === 'P2002') return { action: 'none' }; // already struck — no double-strike
    throw err;
  }

  // Ladder position = ladder-minted strikes only. Admin-issued warnings leave
  // source_type NULL and are excluded, so an admin warning can never silently
  // push someone a rung closer to an automatic ban.
  const step = await prisma.userWarning.count({
    where: { user_id: targetUserId, source_type: { not: null } },
  });
  const rung = STRIKE_LADDER[Math.min(step, STRIKE_LADDER.length) - 1];

  const reason =
    rung.action === 'ban'
      ? `Permanently banned after ${step} strikes for content reported by the community.`
      : rung.action === 'warning'
        ? `Warning: your content was reported by ${validReporters} members. Only post photos/videos from the game.`
        : `Suspended for ${rung.suspensionDays} days after ${step} strikes for content reported by the community.`;

  await prisma.userWarning.update({
    where: { id: warningId },
    data: { severity: rung.severity, reason },
  });

  await applyLadderRung(targetUserId, rung, reason);

  // Every strike and every ladder transition is auditable (CLAUDE.md invariant).
  await logAdminActivity(
    SYSTEM_ACTOR_ID,
    SYSTEM_ACTOR_EMAIL,
    'AUTO_STRIKE',
    'user',
    targetUserId,
    `Automatic strike ${step} (${rung.action}) — ${targetType}:${targetId} reported by ${validReporters} members`,
    {
      step,
      ladder_action: rung.action,
      suspension_days: rung.suspensionDays,
      valid_reporters: validReporters,
      threshold: POST_STRIKE_REPORT_THRESHOLD,
      source_type: targetType,
      source_id: targetId,
      warning_id: warningId,
    }
  );

  // Tell the user what happened. Fire-and-forget: a mail failure must not roll
  // back a sanction that is already committed.
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { email: true, display_name: true },
  });
  if (user?.email) {
    const { sendAccountModerationEmail } = await import('./email.js');
    sendAccountModerationEmail({
      to: user.email,
      action: rung.action === 'ban' ? 'permanent_ban' : rung.action,
      reason,
      userName: user.display_name || undefined,
      endsAt:
        rung.suspensionDays != null
          ? new Date(Date.now() + rung.suspensionDays * 24 * 60 * 60 * 1000)
          : null,
    }).catch(err =>
      console.warn('[moderation] sendAccountModerationEmail (auto-strike) failed:', err?.message)
    );
  }

  return { action: rung.action, step, message: reason };
}

/**
 * Check if there's a report spike and return alert info for admin dashboard.
 * Called periodically or on admin dashboard load.
 */
export async function checkReportSpike(): Promise<{
  isSpike: boolean;
  pendingCount: number;
  recentCount: number;
}> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [pendingCount, recentCount] = await Promise.all([
    prisma.abuseReport.count({ where: { status: 'pending' } }),
    prisma.abuseReport.count({ where: { created_at: { gte: oneHourAgo } } }),
  ]);

  return {
    isSpike: pendingCount >= SPIKE_THRESHOLD || recentCount >= SPIKE_THRESHOLD,
    pendingCount,
    recentCount,
  };
}

/**
 * Suspend a user temporarily (admin action)
 */
export async function suspendUser(params: {
  userId: string;
  days: number;
  reason: string;
  adminId: string;
}): Promise<void> {
  const { userId, days, reason, adminId } = params;
  const suspendUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await updateUserAndInvalidate(prisma, {
    where: { id: userId },
    data: {
      banned_until: suspendUntil,
      ban_reason: reason,
      // Bump session_epoch so existing access tokens fail the auth gate
      // immediately. Same reasoning as the ban endpoints — without this,
      // a suspended user keeps acting until their JWT naturally expires.
      session_epoch: { increment: 1 },
    },
  });
  // Drop refresh tokens too so they can't mint new access tokens during
  // the suspension window.
  await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(err => {
    console.warn('[moderation] failed to delete refresh tokens after suspension', {
      user_id: userId,
      reason: (err as Error)?.message || String(err),
    });
  });

  await issueWarning({
    userId,
    reason: `Suspended for ${days} days: ${reason}`,
    severity: 'strike',
    issuedBy: adminId,
  });

  const [admin, suspendedUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: adminId }, select: { email: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, display_name: true, username: true },
    }),
  ]);
  await logAdminActivity(
    adminId,
    admin?.email || 'unknown',
    'Suspend User',
    'user',
    userId,
    `Suspended user for ${days} days: ${reason}`,
    { banned_until: suspendUntil.toISOString(), days }
  );

  if (suspendedUser?.email) {
    const { sendAccountModerationEmail } = await import('./email.js');
    sendAccountModerationEmail({
      to: suspendedUser.email,
      action: days >= 30 ? 'suspension_45d' : 'suspension_7d',
      reason,
      userName: suspendedUser.display_name || undefined,
      endsAt: suspendUntil,
    }).catch(err =>
      console.warn(
        '[moderation] sendAccountModerationEmail (suspension) failed:',
        err?.message ?? err
      )
    );
  }
}

/**
 * Get a user's moderation history
 */
export async function getUserModerationHistory(userId: string) {
  const [warnings, reportCount, user] = await Promise.all([
    prisma.userWarning.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.abuseReport.count({
      where: {
        OR: [
          // Structured target (2026-07-16 onward) — indexed.
          { target_user_id: userId },
          // Legacy rows predating the structured columns; never backfilled.
          { subject: { contains: `[user:${userId}]` } },
          { message: { contains: userId } },
        ],
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { banned: true, ban_reason: true, banned_until: true },
    }),
  ]);

  return {
    warnings,
    reportCount,
    banned: user?.banned || false,
    ban_reason: user?.ban_reason || null,
    banned_until: user?.banned_until || null,
  };
}
