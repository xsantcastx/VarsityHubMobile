import { Router } from 'express';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import {
    sendAccountPermanentBanEmail,
    sendAccountSuspensionEmail,
    sendAccountWarningEmail,
    sendContentRemovedEmail,
    sendReportResolutionEmail,
} from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminReportsRouter = Router();
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
const APPEALS_EMAIL = process.env.APPEALS_EMAIL || 'customerservice@varsityhub.app';
const SUSPENSION_DAYS = 60;
const POLICY_BAN_DAYS = 45;

// Severity enum: defines consequences for violations
type ResolutionSeverity = 'warning' | 'content_removal' | 'suspend_7_days' | 'suspend_45_days' | 'permanent_ban';

const SEVERITY_SUSPENSION_DAYS: Record<ResolutionSeverity, number | null> = {
  warning: null,
  content_removal: null,
  suspend_7_days: 7,
  suspend_45_days: 45,
  permanent_ban: null, // permanent bans use permanent_ban flag
};

function buildAppealMailto(report: any, status: string): string {
  const subject = encodeURIComponent(`Appeal for Report #${report.id}`);
  const reportType = report?.subject || 'Report';
  const resolutionStatus = String(status || '').toUpperCase();
  const reporterName = report?.reporter?.display_name || 'VarsityHub user';

  const bodyLines = [
    'Hi VarsityHub Team,',
    '',
    `I am appealing the decision for Report #${report.id}.`,
    '',
    `Report Type: ${reportType}`,
    `Resolution Status: ${resolutionStatus}`,
    '',
    'Reason for Appeal:',
    '[Please explain why you believe this decision was incorrect or provide new information]',
    '',
    'Thank you,',
    reporterName,
  ];

  const body = encodeURIComponent(bodyLines.join('\n'));
  return `mailto:${APPEALS_EMAIL}?subject=${subject}&body=${body}`;
}

// Helper to get admin email
async function getAdminEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email || 'unknown';
}

async function queueReportResolutionEmail(report: any, status: string, resolutionNote?: string): Promise<void> {
  if (!['resolved', 'dismissed'].includes(status)) return;
  const email = report.reporter?.email || report.reporter_email;
  if (!email) return;
  const appealUrl = buildAppealMailto(report, status);
  const submitDate = report.created_at ? new Date(report.created_at).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }) : 'Unknown';
  const resolutionDate = report.reviewed_at ? new Date(report.reviewed_at).toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }) : new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });
  const detailLink = `${APP_BASE_URL}/reports/${report.id}`;
  
  try {
    await sendReportResolutionEmail({
      to: email,
      userName: report.reporter?.display_name || 'VarsityHub member',
      reportId: report.id,
      reportType: report.subject || 'report',
      resolutionStatus: (status === 'resolved' || status === 'dismissed') ? status : 'resolved',
      resolutionReason: resolutionNote || 'Our Trust & Safety team reviewed your report.',
      appealUrl: `${APP_BASE_URL}/support/appeal`,
      submitDate: submitDate,
      resolutionDate: resolutionDate,
    });
  } catch (error) {
    console.error('[adminReports] Failed to send report resolution email:', error);
  }
}

async function applySanctions(report: any, status: string, severity?: ResolutionSeverity): Promise<void> {
  const reportedId = report.reported_user_id;
  const violatorEmail = report.reportedUser?.email;
  
  if (!reportedId) return;

  if (status === 'resolved' && severity) {
    const user = await prisma.user.findUnique({
      where: { id: reportedId },
      select: { offense_count: true, permanent_ban: true, email: true, display_name: true },
    });
    if (!user) return;

    const data: any = { offense_count: (user.offense_count || 0) + 1 };
    const now = new Date();
    const appealMailto = buildAppealMailto(report, 'RESOLVED');

    // Apply suspension based on severity and send corresponding email
    if (severity === 'permanent_ban') {
      data.permanent_ban = true;
      data.suspension_until = null;
      data.suspension_reason = 'Permanent ban after confirmed abuse report';
      
      if (violatorEmail) {
        await sendAccountPermanentBanEmail({
          to: violatorEmail,
          userName: user.display_name || 'VarsityHub User',
          reportId: report.id,
          violationType: report.subject || 'Policy Violation',
          banReason: 'Your account has been permanently banned for repeated violations of our Community Guidelines.',
          appealUrl: appealMailto,
          supportEmail: APPEALS_EMAIL,
        }).catch(err => console.error('[adminReports] Failed to send permanent ban email:', err));
      }
    } else if (severity === 'suspend_45_days') {
      const until = new Date(Date.now() + POLICY_BAN_DAYS * 24 * 60 * 60 * 1000);
      data.suspension_until = until;
      data.suspension_reason = '45-day suspension after confirmed abuse report';
      
      if (violatorEmail) {
        await sendAccountSuspensionEmail({
          to: violatorEmail,
          userName: user.display_name || 'VarsityHub User',
          reportId: report.id,
          violationType: report.subject || 'Policy Violation',
          suspensionDays: POLICY_BAN_DAYS,
          suspensionDate: now.toLocaleDateString(),
          reinstatementDate: until.toLocaleDateString(),
          suspensionReason: 'Your account has been suspended due to a violation of our Community Guidelines.',
          appealUrl: appealMailto,
        }).catch(err => console.error('[adminReports] Failed to send 45-day suspension email:', err));
      }
    } else if (severity === 'suspend_7_days') {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      data.suspension_until = until;
      data.suspension_reason = '7-day suspension after confirmed abuse report';
      
      if (violatorEmail) {
        await sendAccountSuspensionEmail({
          to: violatorEmail,
          userName: user.display_name || 'VarsityHub User',
          reportId: report.id,
          violationType: report.subject || 'Policy Violation',
          suspensionDays: 7,
          suspensionDate: now.toLocaleDateString(),
          reinstatementDate: until.toLocaleDateString(),
          suspensionReason: 'Your account has been suspended due to a violation of our Community Guidelines.',
          appealUrl: appealMailto,
        }).catch(err => console.error('[adminReports] Failed to send 7-day suspension email:', err));
      }
    } else if (severity === 'content_removal') {
      if (violatorEmail) {
        await sendContentRemovedEmail({
          to: violatorEmail,
          userName: user.display_name || 'VarsityHub User',
          reportId: report.id,
          contentType: report.subject || 'Content',
          removalReason: 'Your content was removed for violating our Community Guidelines.',
          reportType: report.subject || 'Policy Violation',
          removalDate: now.toLocaleDateString(),
          appealUrl: appealMailto,
        }).catch(err => console.error('[adminReports] Failed to send content removed email:', err));
      }
    } else if (severity === 'warning') {
      if (violatorEmail) {
        await sendAccountWarningEmail({
          to: violatorEmail,
          userName: user.display_name || 'VarsityHub User',
          reportId: report.id,
          violationType: report.subject || 'Policy Violation',
          warningReason: 'Your account received a warning for violating our Community Guidelines.',
          appealUrl: appealMailto,
        }).catch(err => console.error('[adminReports] Failed to send warning email:', err));
      }
    }

    await prisma.user.update({ where: { id: reportedId }, data });
  }
}

// GET /admin/reports - Get all abuse reports
adminReportsRouter.get('/', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const status = String(req.query.status || 'all').trim();
  const limit = Math.min(parseInt(String(req.query.limit || '100')), 500);
  const offset = parseInt(String(req.query.offset || '0'));
  
  const where = status !== 'all' ? { status } : {};
  
  const [reports, total] = await Promise.all([
    prisma.abuseReport.findMany({
      where,
      include: {
        reporter: {
          select: {
            id: true,
            display_name: true,
            email: true,
            avatar_url: true,
            banned: true,
          },
        },
        reportedUser: {
          select: {
            id: true,
            display_name: true,
            email: true,
            offense_count: true,
            suspension_until: true,
            permanent_ban: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.abuseReport.count({ where }),
  ]);
  
  return res.json({ reports, total });
});

// GET /admin/reports/stats - Get report statistics
adminReportsRouter.get('/stats', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const [pending, reviewed, resolved, dismissed, total] = await Promise.all([
    prisma.abuseReport.count({ where: { status: 'pending' } }),
    prisma.abuseReport.count({ where: { status: 'reviewed' } }),
    prisma.abuseReport.count({ where: { status: 'resolved' } }),
    prisma.abuseReport.count({ where: { status: 'dismissed' } }),
    prisma.abuseReport.count(),
  ]);
  
  return res.json({ pending, reviewed, resolved, dismissed, total });
});

// PATCH /admin/reports/:id - Update report status
adminReportsRouter.patch('/:id', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { id } = req.params;
  let { status, resolution_note, severity } = req.body || {};
  
  if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Validate severity if provided
  const validSeverities: ResolutionSeverity[] = ['warning', 'content_removal', 'suspend_7_days', 'suspend_45_days', 'permanent_ban'];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }
  
  // Auto-upgrade to resolved if severity implies action
  let finalStatus = status;
  let finalSeverity = severity as ResolutionSeverity | undefined;
  if (status === 'dismissed' && finalSeverity) {
    // If admin provides a severity for a dismissed report, upgrade to resolved
    finalStatus = 'resolved';
  } else if (status !== 'resolved') {
    finalSeverity = undefined; // Only resolved reports have severity-driven sanctions
  }
  
  const report = await prisma.abuseReport.update({
    where: { id },
    data: {
      status: finalStatus,
      resolution_note: resolution_note || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    },
    include: {
      reporter: {
        select: {
          id: true,
          display_name: true,
          email: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          display_name: true,
          email: true,
          offense_count: true,
          suspension_until: true,
          permanent_ban: true,
        },
      },
    },
  });
  
  // Log admin activity
  const adminEmail = await getAdminEmail(req.user.id);
  await logAdminActivity(
    req.user.id,
    adminEmail,
    'Update Abuse Report',
    'abuse_report',
    id,
    `Changed report status to ${finalStatus}${finalSeverity ? ` with severity: ${finalSeverity}` : ''}`,
    { status: finalStatus, severity: finalSeverity, resolution_note, reporter: report.reporter.email }
  );
  await queueReportResolutionEmail(report, finalStatus, resolution_note);
  await applySanctions(report, finalStatus, finalSeverity);
  return res.json({ report });
});

// POST /admin/reports/bulk-update - Bulk update multiple reports
adminReportsRouter.post('/bulk-update', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  let { report_ids, status, resolution_note, severity } = req.body || {};
  
  if (!Array.isArray(report_ids) || report_ids.length === 0) {
    return res.status(400).json({ error: 'Invalid report_ids array' });
  }
  
  if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  // Validate severity if provided
  const validSeverities: ResolutionSeverity[] = ['warning', 'content_removal', 'suspend_7_days', 'suspend_45_days', 'permanent_ban'];
  if (severity && !validSeverities.includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }
  
  // Auto-upgrade to resolved if severity implies action
  let finalStatus = status;
  let finalSeverity = severity as ResolutionSeverity | undefined;
  if (status === 'dismissed' && finalSeverity) {
    finalStatus = 'resolved';
  } else if (status !== 'resolved') {
    finalSeverity = undefined;
  }
  
  let reportsForNotification: Array<any> = [];
  if (['resolved', 'dismissed'].includes(finalStatus)) {
    reportsForNotification = await prisma.abuseReport.findMany({
      where: { id: { in: report_ids } },
      include: {
        reporter: { select: { email: true, display_name: true } },
        reportedUser: {
          select: {
            id: true,
            display_name: true,
            email: true,
            offense_count: true,
            suspension_until: true,
            permanent_ban: true,
          },
        },
      },
    });
  }

  const result = await prisma.abuseReport.updateMany({
    where: { id: { in: report_ids } },
    data: {
      status: finalStatus,
      resolution_note: resolution_note || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date(),
    },
  });
  
  // Log bulk admin activity
  const adminEmail = await getAdminEmail(req.user.id);
  await logAdminActivity(
    req.user.id,
    adminEmail,
    'Bulk Update Abuse Reports',
    'abuse_report',
    'bulk',
    `Updated ${result.count} reports to status: ${finalStatus}${finalSeverity ? ` with severity: ${finalSeverity}` : ''}`,
    { report_ids, status: finalStatus, severity: finalSeverity, count: result.count }
  );
  await Promise.all(
    reportsForNotification.map(async (report) => {
      await queueReportResolutionEmail(report, finalStatus, resolution_note);
      await applySanctions(report, finalStatus, finalSeverity);
    })
  );
  
  return res.json({ updated: result.count });
});

// DELETE /admin/reports/:id - Delete a report
adminReportsRouter.delete('/:id', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { id } = req.params;
  
  const report = await prisma.abuseReport.findUnique({
    where: { id },
    select: { reporter_email: true, subject: true },
  });
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  await prisma.abuseReport.delete({ where: { id } });
  
  // Log admin activity
  const adminEmail = await getAdminEmail(req.user.id);
  await logAdminActivity(
    req.user.id,
    adminEmail,
    'Delete Abuse Report',
    'abuse_report',
    id,
    `Deleted report: "${report.subject}"`,
    { reporter: report.reporter_email, subject: report.subject }
  );
  
  return res.json({ ok: true });
});

// POST /admin/reports/bulk-delete - Bulk delete multiple reports
adminReportsRouter.post('/bulk-delete', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { report_ids } = req.body || {};
  
  if (!Array.isArray(report_ids) || report_ids.length === 0) {
    return res.status(400).json({ error: 'Invalid report_ids array' });
  }
  
  const result = await prisma.abuseReport.deleteMany({
    where: { id: { in: report_ids } },
  });
  
  // Log bulk admin activity
  const adminEmail = await getAdminEmail(req.user.id);
  await logAdminActivity(
    req.user.id,
    adminEmail,
    'Bulk Delete Abuse Reports',
    'abuse_report',
    'bulk',
    `Deleted ${result.count} abuse reports`,
    { report_ids, count: result.count }
  );
  
  return res.json({ deleted: result.count });
});
