/**
 * Moderation Service
 *
 * Handles the strike/warning system, auto-escalation from reports,
 * temporary suspensions, and admin spike notifications.
 */

import { prisma } from './prisma.js';
import { logAdminActivity } from './adminActivityLogger.js';

// Escalation thresholds — env-overridable for tuning at scale without redeploy.
// v1.0.2 pass 9: previously hardcoded constants; now pulled from env with the same defaults.
const intEnv = (key: string, defaultValue: number): number => {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
};
const WARN_THRESHOLD = intEnv('MOD_WARN_THRESHOLD', 3); // reports → auto-warning
const STRIKE_THRESHOLD = intEnv('MOD_STRIKE_THRESHOLD', 5); // reports → strike
const SUSPEND_THRESHOLD = intEnv('MOD_SUSPEND_THRESHOLD', 8); // reports → 7-day suspension
const BAN_THRESHOLD = intEnv('MOD_BAN_THRESHOLD', 12); // reports → permanent ban
const SPIKE_THRESHOLD = intEnv('MOD_SPIKE_THRESHOLD', 10); // pending reports → spike alert

/**
 * Issue a warning to a user
 */
export async function issueWarning(params: {
  userId: string;
  reason: string;
  severity?: 'warning' | 'strike' | 'final_warning';
  issuedBy?: string;
  reportId?: string;
}): Promise<{ id: string; totalWarnings: number; totalStrikes: number }> {
  const { userId, reason, severity = 'warning', issuedBy, reportId } = params;

  const warning = await prisma.userWarning.create({
    data: {
      user_id: userId,
      issued_by: issuedBy || null,
      reason,
      severity,
      report_id: reportId || null,
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
 * Auto-escalate based on report count for a target user.
 * Called after a new report is created.
 */
export async function autoEscalate(targetUserId: string): Promise<{
  action: 'none' | 'warning' | 'strike' | 'suspension' | 'ban';
  message?: string;
}> {
  // v1.0.2 pass 9: dropped the broad `message: { contains: targetUserId }` count which was
  // dead code (Math.max ignored it) AND would over-match on any UUID substring. Use only
  // the specific structured patterns: subject "[user:ID]" or message JSON keys with the ID.
  // Schema does not yet have a target_user_id FK column — that's a separate migration.
  const ACTIVE_STATUSES = ['pending', 'reviewed', 'resolved'] as const;
  const directReportCount = await prisma.abuseReport.count({
    where: {
      subject: { contains: `[user:${targetUserId}]` },
      status: { in: [...ACTIVE_STATUSES] },
    },
  });
  const contentReportCount = await prisma.abuseReport.count({
    where: {
      OR: [
        { message: { contains: `"post_author_id":"${targetUserId}"` } },
        { message: { contains: `"comment_author_id":"${targetUserId}"` } },
        { message: { contains: `"sender_id":"${targetUserId}"` } },
        // v1.0.2 pass 9: include report-target patterns from /reports endpoint targetContext JSON
        { message: { contains: `"target_user_id":"${targetUserId}"` } },
      ],
      status: { in: [...ACTIVE_STATUSES] },
    },
  });

  // v1.0.2 pass 9: changed Math.max → SUM since direct+content reports are independent
  // signals about the same user. Previously max() would under-count when the user had
  // both direct reports AND content reports, letting them stay below thresholds longer.
  const totalReports = directReportCount + contentReportCount;

  if (totalReports >= BAN_THRESHOLD) {
    // Auto-ban
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        banned: true,
        ban_reason: `Automatically banned after ${totalReports} community reports.`,
      },
    });
    await issueWarning({
      userId: targetUserId,
      reason: `Auto-ban: ${totalReports} reports received`,
      severity: 'final_warning',
    });
    return { action: 'ban', message: `User auto-banned after ${totalReports} reports` };
  }

  if (totalReports >= SUSPEND_THRESHOLD) {
    // Auto-suspend for 7 days
    const suspendUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        banned_until: suspendUntil,
        ban_reason: `Automatically suspended for 7 days after ${totalReports} community reports.`,
      },
    });
    await issueWarning({
      userId: targetUserId,
      reason: `Auto-suspension: ${totalReports} reports received`,
      severity: 'strike',
    });
    return {
      action: 'suspension',
      message: `User auto-suspended for 7 days after ${totalReports} reports`,
    };
  }

  if (totalReports >= STRIKE_THRESHOLD) {
    // Check if already struck for this threshold
    const existingStrikes = await prisma.userWarning.count({
      where: { user_id: targetUserId, severity: 'strike' },
    });
    if (existingStrikes === 0) {
      await issueWarning({
        userId: targetUserId,
        reason: `Auto-strike: ${totalReports} reports received from community`,
        severity: 'strike',
      });
      return { action: 'strike', message: `Strike issued after ${totalReports} reports` };
    }
  }

  if (totalReports >= WARN_THRESHOLD) {
    // Check if already warned at this level
    const existingWarnings = await prisma.userWarning.count({
      where: { user_id: targetUserId, severity: 'warning' },
    });
    if (existingWarnings === 0) {
      await issueWarning({
        userId: targetUserId,
        reason: `Auto-warning: ${totalReports} reports received from community`,
        severity: 'warning',
      });
      return { action: 'warning', message: `Warning issued after ${totalReports} reports` };
    }
  }

  return { action: 'none' };
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

  await prisma.user.update({
    where: { id: userId },
    data: {
      banned_until: suspendUntil,
      ban_reason: reason,
    },
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

  // Suspension notification emails removed — non-mandatory moderation emails
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
        OR: [{ subject: { contains: `[user:${userId}]` } }, { message: { contains: userId } }],
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
