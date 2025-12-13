import { Router } from 'express';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

export const adminReportsRouter = Router();
const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
const SUSPENSION_DAYS = 60;

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
  const appealUrl = `${APP_BASE_URL}/support/appeals/${report.id}`;
  try {
    await emailQueue.add(
      'reports.resolved',
      {
        to: email,
        user_name: report.reporter?.display_name || 'VarsityHub member',
        report_type: report.subject || 'report',
        resolution_status: status,
        resolution_reason: resolutionNote || 'Our Trust & Safety team reviewed your report.',
        appeal_url: appealUrl,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  } catch (error) {
    console.error('[adminReports] Failed to enqueue report resolution email:', error);
  }
}

async function applySanctions(report: any, status: string): Promise<void> {
  const reportedId = report.reported_user_id;
  if (!reportedId) return;

  if (status === 'resolved') {
    const user = await prisma.user.findUnique({
      where: { id: reportedId },
      select: { offense_count: true, permanent_ban: true },
    });
    if (!user) return;

    const nextOffense = (user.offense_count || 0) + 1;
    const data: any = { offense_count: nextOffense };

    if (user.permanent_ban) {
      data.permanent_ban = true;
    } else if (nextOffense >= 2) {
      data.permanent_ban = true;
      data.suspension_until = null;
      data.suspension_reason = 'Permanent ban after multiple confirmed abuse reports';
    } else {
      const until = new Date(Date.now() + SUSPENSION_DAYS * 24 * 60 * 60 * 1000);
      data.suspension_until = until;
      data.suspension_reason = '60-day suspension after confirmed abuse report';
    }

    await prisma.user.update({ where: { id: reportedId }, data });
  } else if (status === 'dismissed') {
    await prisma.user
      .update({
        where: { id: reportedId },
        data: {
          suspension_until: null,
          suspension_reason: null,
        },
      })
      .catch(() => {});
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
  const { status, resolution_note } = req.body || {};
  
  if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const report = await prisma.abuseReport.update({
    where: { id },
    data: {
      status,
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
    `Changed report status to ${status}`,
    { status, resolution_note, reporter: report.reporter.email }
  );
  await queueReportResolutionEmail(report, status, resolution_note);
  await applySanctions(report, status);
  return res.json({ report });
});

// POST /admin/reports/bulk-update - Bulk update multiple reports
adminReportsRouter.post('/bulk-update', requireAdmin as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { report_ids, status, resolution_note } = req.body || {};
  
  if (!Array.isArray(report_ids) || report_ids.length === 0) {
    return res.status(400).json({ error: 'Invalid report_ids array' });
  }
  
  if (!status || !['pending', 'reviewed', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  let reportsForNotification: Array<any> = [];
  if (['resolved', 'dismissed'].includes(status)) {
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
      status,
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
    `Updated ${result.count} reports to status: ${status}`,
    { report_ids, status, count: result.count }
  );
  await Promise.all(
    reportsForNotification.map(async (report) => {
      await queueReportResolutionEmail(report, status, resolution_note);
      await applySanctions(report, status);
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
