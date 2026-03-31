/**
 * Moderation Service
 *
 * Handles the strike/warning system, auto-escalation from reports,
 * temporary suspensions, and admin spike notifications.
 */

import { prisma } from './prisma.js';
import { logAdminActivity } from './adminActivityLogger.js';
import { sendAccountSuspension7DaysEmail, sendAccountSuspension45DaysEmail } from './email.js';

// Escalation thresholds
const WARN_THRESHOLD = 3;       // 3 reports → auto-warning
const STRIKE_THRESHOLD = 5;     // 5 reports → strike
const SUSPEND_THRESHOLD = 8;    // 8 reports → 7-day suspension
const BAN_THRESHOLD = 12;       // 12 reports → permanent ban
const SPIKE_THRESHOLD = 10;     // 10+ pending reports = spike alert

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
    const admin = await prisma.user.findUnique({ where: { id: issuedBy }, select: { email: true } });
    await logAdminActivity(
      issuedBy,
      admin?.email || 'system',
      `Issue ${severity}`,
      'user',
      userId,
      `Issued ${severity} to user: ${reason}`,
      { warning_id: warning.id, report_id: reportId },
    );
  }

  return { id: warning.id, ...counts };
}

/**
 * Get warning/strike counts for a user
 */
export async function getWarningCounts(userId: string): Promise<{ totalWarnings: number; totalStrikes: number }> {
  const [totalWarnings, totalStrikes] = await Promise.all([
    prisma.userWarning.count({ where: { user_id: userId, severity: 'warning' } }),
    prisma.userWarning.count({ where: { user_id: userId, severity: { in: ['strike', 'final_warning'] } } }),
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
  // Count total reports against this user (pending + reviewed — not dismissed)
  const reportCount = await prisma.abuseReport.count({
    where: {
      message: { contains: targetUserId },
      status: { in: ['pending', 'reviewed', 'resolved'] },
    },
  });

  // Also count by parsing subject field for user reports
  const directReportCount = await prisma.abuseReport.count({
    where: {
      subject: { contains: `[user:${targetUserId}]` },
      status: { in: ['pending', 'reviewed', 'resolved'] },
    },
  });

  // Count reports where this user's content was reported
  const contentReportCount = await prisma.abuseReport.count({
    where: {
      OR: [
        { message: { contains: `"post_author_id":"${targetUserId}"` } },
        { message: { contains: `"comment_author_id":"${targetUserId}"` } },
        { message: { contains: `"sender_id":"${targetUserId}"` } },
      ],
      status: { in: ['pending', 'reviewed', 'resolved'] },
    },
  });

  const totalReports = Math.max(directReportCount, contentReportCount);

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
    return { action: 'suspension', message: `User auto-suspended for 7 days after ${totalReports} reports` };
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
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, display_name: true, username: true } }),
  ]);
  await logAdminActivity(
    adminId,
    admin?.email || 'unknown',
    'Suspend User',
    'user',
    userId,
    `Suspended user for ${days} days: ${reason}`,
    { banned_until: suspendUntil.toISOString(), days },
  );

  // Notify suspended user via email (fire-and-forget)
  if (suspendedUser?.email) {
    const userName = suspendedUser.display_name || suspendedUser.username || 'User';
    const endDate = suspendUntil.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const emailParams = { to: suspendedUser.email, userName, suspensionReason: reason, suspensionEndDate: endDate };
    if (days <= 7) {
      sendAccountSuspension7DaysEmail(emailParams).catch(e => console.error('[moderation] 7-day suspension email failed:', e));
    } else {
      sendAccountSuspension45DaysEmail(emailParams).catch(e => console.error('[moderation] suspension email failed:', e));
    }
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
