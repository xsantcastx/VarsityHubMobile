import { Router } from 'express';
import { z } from 'zod';
import { sendAdTakenDownPendingReviewEmail } from '../lib/email.js';
import { sendPushNotification } from '../lib/notifications.js';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { adModerationLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const adminReportsRouter = Router();
registerIdValidation(adminReportsRouter);

// Helper to get admin email
async function getAdminEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email || 'unknown';
}

function parseReportTarget(subject: string): { target_type: string | null; target_id: string | null } {
  const match = String(subject || '').match(/\[([a-z_]+):([^\]]+)\]/i);
  return {
    target_type: match?.[1] || null,
    target_id: match?.[2] || null,
  };
}

// GET /admin/reports - Get all abuse reports
adminReportsRouter.get('/', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const status = String(req.query.status || 'all').trim();
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '100')), 500));
  // Cap offset so an admin passing ?offset=999999999 doesn't force Postgres to
  // skip hundreds of millions of rows. 10k matches a reasonable upper bound on
  // pagination depth (100 pages × 100/page); paginate by date filters beyond that.
  const offset = Math.max(0, Math.min(parseInt(String(req.query.offset || '0')) || 0, 10000));
  
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
      },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.abuseReport.count({ where }),
  ]);
  
  return res.json({ reports, total });
}));

// GET /admin/reports/stats - Get report statistics
adminReportsRouter.get('/stats', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const [pending, reviewed, resolved, dismissed, total] = await Promise.all([
    prisma.abuseReport.count({ where: { status: 'pending' } }),
    prisma.abuseReport.count({ where: { status: 'reviewed' } }),
    prisma.abuseReport.count({ where: { status: 'resolved' } }),
    prisma.abuseReport.count({ where: { status: 'dismissed' } }),
    prisma.abuseReport.count(),
  ]);
  
  return res.json({ pending, reviewed, resolved, dismissed, total });
}));

// PATCH /admin/reports/:id - Update report status
adminReportsRouter.patch('/:id', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { id } = req.params;
  const patchSchema = z.object({
    status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']),
    resolution_note: z.string().max(2000).optional(),
  });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { status, resolution_note } = parsed.data;
  
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
    { status, resolution_note, reporter: report.reporter?.email }
  );

  // Report resolution notification email removed — non-mandatory informational email

  return res.json({ report });
}));

// POST /admin/reports/bulk-update - Bulk update multiple reports
adminReportsRouter.post('/bulk-update', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const bulkUpdateSchema = z.object({
    report_ids: z.array(z.string().min(1)).min(1),
    status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']),
    resolution_note: z.string().max(2000).optional(),
  });
  const parsed = bulkUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { report_ids, status, resolution_note } = parsed.data;
  
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
  
  return res.json({ updated: result.count });
}));

// DELETE /admin/reports/:id - Delete a report
adminReportsRouter.delete('/:id', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
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
}));

// POST /admin/reports/bulk-delete - Bulk delete multiple reports
adminReportsRouter.post('/bulk-delete', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const bulkDeleteSchema = z.object({
    report_ids: z.array(z.string().min(1)).min(1),
  });
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { report_ids } = parsed.data;
  
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
}));

// POST /admin/reports/:id/take-down-ad - Resolve the report and pull the ad from feed pending review
adminReportsRouter.post(
  '/:id/take-down-ad',
  requireAuth as any,
  requireVerified as any,
  requireAdmin as any,
  adModerationLimiter as any,
  asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  const bodySchema = z.object({
    resolution_note: z.string().max(2000).optional(),
  });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

  const report = await prisma.abuseReport.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      subject: true,
      reporter_email: true,
      reporter_name: true,
    },
  });
  if (!report) return res.status(404).json({ error: 'Report not found' });

  const { target_type, target_id } = parseReportTarget(report.subject);
  if (target_type !== 'ad' || !target_id) {
    return res.status(400).json({ error: 'This report does not target an ad' });
  }

  const ad = await prisma.ad.findUnique({
    where: { id: target_id },
    select: {
      id: true,
      user_id: true,
      contact_email: true,
      business_name: true,
      status: true,
      payment_status: true,
      admin_note: true,
    },
  });
  if (!ad) return res.status(404).json({ error: 'Ad not found' });

  const reason =
    parsed.data.resolution_note?.trim() ||
    'Ad taken down pending moderator review after a user report.';

  const nextStatus = ad.status === 'draft' ? 'draft' : 'pending';
  const nextAdminNote = `[Report Takedown] ${reason}`;

  const [updatedReport, updatedAd] = await prisma.$transaction([
    prisma.abuseReport.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution_note: reason,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    }),
    prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: nextStatus,
        admin_note: nextAdminNote,
      },
    }),
  ]);

  if (ad.contact_email) {
    sendAdTakenDownPendingReviewEmail({
      to: ad.contact_email,
      businessName: ad.business_name || undefined,
      reason,
    }).catch((err) => console.warn('[adminReports] ad takedown email failed:', (err as any)?.message || err));
  }

  if (ad.user_id) {
    sendPushNotification(
      ad.user_id,
      'Ad Taken Down',
      `Your ad for "${ad.business_name || 'your business'}" was taken down pending moderator review.${reason ? ` Reason: ${reason}` : ''}`,
      { type: 'ad_rejected', ad_id: ad.id, source: 'report_takedown' },
    ).catch((err) => console.warn('[adminReports] ad takedown push failed:', (err as any)?.message || err));

    prisma.notification.create({
      data: {
        user_id: ad.user_id,
        type: 'AD_REJECTED' as any,
        meta: {
          ad_id: ad.id,
          business_name: ad.business_name,
          reason,
          source: 'report_takedown',
        },
      },
    }).catch((err) => console.error('[adminReports] ad takedown in-app notification failed:', (err as any)?.message || err));
  }

  const adminEmail = await getAdminEmail(req.user.id);
  await logAdminActivity(
    req.user.id,
    adminEmail,
    'Take Down Ad',
    'ad',
    ad.id,
    `Took down ad "${ad.business_name || ad.id}" from report ${report.id}`,
    {
      report_id: report.id,
      previous_status: ad.status,
      next_status: nextStatus,
      payment_status: ad.payment_status,
      resolution_note: reason,
    }
  );

  return res.json({ ok: true, report: updatedReport, ad: updatedAd });
}));
