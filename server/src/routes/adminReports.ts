import { Router } from 'express';
import { z } from 'zod';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
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

// GET /admin/reports - Get all abuse reports
adminReportsRouter.get('/', requireAdmin as any, asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const status = String(req.query.status || 'all').trim();
  const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '100')), 500));
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
