import express, { Router } from 'express';
import escapeHtml from 'escape-html';
import { z } from 'zod';
import { sendAdTakenDownPendingReviewEmail } from '../lib/email.js';
import { sendPushNotification } from '../lib/notifications.js';
import { logAdminActivity } from '../lib/adminActivityLogger.js';
import { prisma } from '../lib/prisma.js';
import {
  consumeReviewToken,
  getReviewTokenReplayState,
  verifyReviewToken,
} from '../lib/reviewTokens.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';
import { adModerationLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin, isEmailAdmin } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const adminReportsRouter = Router();
registerIdValidation(adminReportsRouter);

// SECURITY BACKSTOP (2026-07-12): mirror of the adminRouter backstop. Every route
// here must clear `requireAdmin` before its handler runs, so a future route that
// forgets its per-route guard fails closed. The dual-mode review routes
// (`/:id/(resolve|dismiss)`) authenticate by a signed single-use email-review token
// OR a verified admin session inside `handleEmailReportReview`, so they are
// allowlisted. Anchored to the `/(resolve|dismiss)` suffix; per-route `requireAdmin`
// guards are kept as belt-and-suspenders.
const REPORTS_BACKSTOP_ALLOWLIST: RegExp[] = [/\/[^/]+\/(resolve|dismiss)$/];
adminReportsRouter.use((req, res, next) => {
    if (REPORTS_BACKSTOP_ALLOWLIST.some((re) => re.test(req.path))) return next();
    return (requireAdmin as any)(req, res, next);
});

const FINAL_REPORT_STATUSES = ['resolved', 'dismissed'] as const;

// Helper to get admin email
async function getAdminEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email || 'unknown';
}

function parseReportTarget(subject: string): {
  target_type: string | null;
  target_id: string | null;
} {
  const match = String(subject || '').match(/\[([a-z_]+):([^\]]+)\]/i);
  return {
    target_type: match?.[1] || null,
    target_id: match?.[2] || null,
  };
}

function getReportPreview(message: string): string {
  try {
    const parsed = JSON.parse(message || '{}');
    if (parsed?.details) return String(parsed.details);
    if (parsed?.reason) return String(parsed.reason).replace(/_/g, ' ');
  } catch {
    // Fall back to the raw message when the report body is not JSON.
  }
  return String(message || '').trim();
}

function renderReportReviewPage(
  action: 'resolve' | 'dismiss',
  report: {
    id: string;
    reporter_name: string;
    reporter_email: string;
    subject: string;
    message: string;
  },
  token: string
) {
  const title = action === 'resolve' ? 'Resolve Abuse Report' : 'Dismiss Abuse Report';
  const button = action === 'resolve' ? 'Resolve Report' : 'Dismiss Report';
  const color = action === 'resolve' ? '#16A34A' : '#DC2626';
  const preview = escapeHtml(getReportPreview(report.message) || 'No additional details provided.');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:40px auto;padding:20px;background:#F9FAFB;color:#111827;">
<div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:24px;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
<h2 style="margin:0 0 12px;color:#1B3A6B;">${title}</h2>
<p style="color:#374151;line-height:1.5;margin:0 0 16px;">Report <strong>${escapeHtml(report.id)}</strong> from <strong>${escapeHtml(report.reporter_name || 'Unknown')}</strong> (${escapeHtml(report.reporter_email || 'unknown@email.com')})</p>
<p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(report.subject || 'Untitled')}</p>
<p style="margin:0 0 16px;color:#4B5563;line-height:1.5;">${preview.replace(/\n/g, '<br>')}</p>
<form method="POST" action="?token=${encodeURIComponent(token)}">
<button type="submit" style="background:${color};color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:16px;cursor:pointer;font-weight:600;">${button}</button>
</form>
</div>
</body></html>`;
}

function renderReportResultPage(title: string, message: string, success: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:60px auto;padding:20px;text-align:center;">
<h2 style="color:${success ? '#16A34A' : '#DC2626'};">${escapeHtml(title)}</h2>
<p style="color:#374151;line-height:1.5;">${escapeHtml(message)}</p>
</body></html>`;
}

async function isReplayTokenAlreadyUsed(
  token: string,
  payload: { jti?: string; exp?: number; iat?: number }
) {
  const replayState = await getReviewTokenReplayState(token, payload);
  return replayState === 'already_used';
}

async function handleEmailReportReview(
  req: AuthedRequest,
  res: express.Response,
  action: 'resolve' | 'dismiss'
) {
  const { id } = req.params;
  const token = typeof req.query?.token === 'string' ? req.query.token : undefined;
  const payload = token ? verifyReviewToken<{ reportId: string; action: string }>(token) : null;
  const expectedAction = action === 'dismiss' ? 'dismiss_abuse_report' : 'resolve_abuse_report';
  const tokenValid = !!(
    token &&
    payload &&
    payload.reportId === id &&
    payload.action === expectedAction
  );

  // Two callers: (1) email-link clicks render HTML; (2) admin dashboard sends JSON.
  // Allow signed-in admins through without a token; keep email-link semantics otherwise.
  let signedInAdmin = false;
  if (!tokenValid && !token && req.user) {
    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true, email_verified: true },
    });
    signedInAdmin = !!(me?.email_verified && isEmailAdmin(me.email));
  }

  if (!tokenValid && !signedInAdmin) {
    if (token) {
      return res
        .status(401)
        .send(
          renderReportResultPage(
            'Invalid Link',
            `This ${action} link is invalid or has expired.`,
            false
          )
        );
    }
    return res.status(401).json({ error: 'Admin login required.' });
  }

  const report = await prisma.abuseReport.findUnique({
    where: { id },
    select: {
      id: true,
      reporter_name: true,
      reporter_email: true,
      subject: true,
      message: true,
      status: true,
    },
  });
  if (!report) {
    if (signedInAdmin) return res.status(404).json({ error: 'Abuse report not found' });
    return res
      .status(404)
      .send(renderReportResultPage('Not Found', 'Abuse report not found.', false));
  }

  if (req.method === 'POST' && tokenValid && (await isReplayTokenAlreadyUsed(token!, payload!))) {
    return res
      .status(409)
      .send(
        renderReportResultPage(
          'Link Already Used',
          `This ${action} link was already used. Open the latest email if you need a fresh review link.`,
          false
        )
      );
  }

  const nextStatus = action === 'dismiss' ? 'dismissed' : 'resolved';
  if (report.status === nextStatus) {
    if (signedInAdmin) {
      return res.json({
        ok: true,
        already_final: true,
        message: `Report ${report.id} already ${nextStatus}.`,
      });
    }
    return res.send(
      renderReportResultPage(
        action === 'dismiss' ? 'Already Dismissed' : 'Already Resolved',
        `Report ${report.id} was already ${nextStatus}.`,
        true
      )
    );
  }
  if (report.status === 'resolved' || report.status === 'dismissed') {
    if (signedInAdmin) {
      return res.status(409).json({
        error: `Report already ${report.status}`,
        current_status: report.status,
      });
    }
    return res
      .status(409)
      .send(
        renderReportResultPage(
          'Already Reviewed',
          `This report was already ${report.status}.`,
          false
        )
      );
  }

  if (req.method === 'GET') {
    if (!tokenValid) return res.status(405).json({ error: 'Method not allowed' });
    return res.send(renderReportReviewPage(action, report, token!));
  }

  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  const reviewerUserId = req.user?.id ?? 'email-token';
  let reviewerEmail = 'email-token';
  if (req.user?.id) {
    const reviewer = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    reviewerEmail = reviewer?.email || reviewerEmail;
  }

  const transition = await prisma.abuseReport.updateMany({
    where: { id, status: { notIn: [...FINAL_REPORT_STATUSES] } },
    data: {
      status: nextStatus,
      resolution_note: note || null,
      reviewed_by: reviewerUserId,
      reviewed_at: new Date(),
    },
  });
  if (transition.count === 0) {
    const latest = await prisma.abuseReport.findUnique({
      where: { id },
      select: { status: true },
    });
    const currentStatus = latest?.status || 'reviewed';
    if (signedInAdmin) {
      return res.status(409).json({
        error: `Report already ${currentStatus}`,
        current_status: currentStatus,
      });
    }
    return res
      .status(409)
      .send(
        renderReportResultPage(
          'Already Reviewed',
          `This report was already ${currentStatus}.`,
          false
        )
      );
  }

  if (tokenValid) {
    const consumeResult = await consumeReviewToken(token!, payload!);
    if (consumeResult !== 'consumed') {
      console.warn('[adminReports] review token could not be marked consumed after success:', {
        report_id: id,
        action,
        consumeResult,
      });
    }
  }

  await logAdminActivity(
    reviewerUserId,
    reviewerEmail,
    action === 'dismiss' ? 'DISMISS_ABUSE_REPORT' : 'RESOLVE_ABUSE_REPORT',
    'abuse_report',
    id,
    `${action === 'dismiss' ? 'Dismissed' : 'Resolved'} abuse report: ${report.subject}${note ? ` — ${note}` : ''}`,
    {
      via: signedInAdmin ? 'admin_dashboard' : 'email_token',
      status: nextStatus,
      resolution_note: note || null,
    }
  );

  if (signedInAdmin) {
    return res.json({
      ok: true,
      message: `Report ${report.id} ${action === 'dismiss' ? 'dismissed' : 'resolved'}`,
    });
  }
  return res.send(
    renderReportResultPage(
      action === 'dismiss' ? 'Report Dismissed' : 'Report Resolved',
      `Report ${report.id} has been ${action === 'dismiss' ? 'dismissed' : 'resolved'}.`,
      true
    )
  );
}

adminReportsRouter.get(
  '/:id/resolve',
  authMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => handleEmailReportReview(req, res, 'resolve'))
);
adminReportsRouter.post(
  '/:id/resolve',
  authMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => handleEmailReportReview(req, res, 'resolve'))
);
adminReportsRouter.get(
  '/:id/dismiss',
  authMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => handleEmailReportReview(req, res, 'dismiss'))
);
adminReportsRouter.post(
  '/:id/dismiss',
  authMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => handleEmailReportReview(req, res, 'dismiss'))
);

// GET /admin/reports - Get all abuse reports
adminReportsRouter.get(
  '/',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
  })
);

// GET /admin/reports/stats - Get report statistics
adminReportsRouter.get(
  '/stats',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const [pending, reviewed, resolved, dismissed, total] = await Promise.all([
      prisma.abuseReport.count({ where: { status: 'pending' } }),
      prisma.abuseReport.count({ where: { status: 'reviewed' } }),
      prisma.abuseReport.count({ where: { status: 'resolved' } }),
      prisma.abuseReport.count({ where: { status: 'dismissed' } }),
      prisma.abuseReport.count(),
    ]);

    return res.json({ pending, reviewed, resolved, dismissed, total });
  })
);

// PATCH /admin/reports/:id - Update report status
adminReportsRouter.patch(
  '/:id',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const patchSchema = z.object({
      status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']),
      resolution_note: z.string().max(2000).optional(),
    });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { status, resolution_note } = parsed.data;

    const existing = await prisma.abuseReport.findUnique({
      where: { id },
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
    if (!existing) return res.status(404).json({ error: 'Abuse report not found' });
    if (existing.status === status) {
      return res.json({
        report: existing,
        already_final: FINAL_REPORT_STATUSES.includes(status as any),
      });
    }
    if (FINAL_REPORT_STATUSES.includes(existing.status as (typeof FINAL_REPORT_STATUSES)[number])) {
      return res.status(409).json({
        error: `Report already ${existing.status}`,
        current_status: existing.status,
      });
    }

    const transition = await prisma.abuseReport.updateMany({
      where: { id, status: { notIn: [...FINAL_REPORT_STATUSES] } },
      data: {
        status,
        resolution_note: resolution_note || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });
    if (transition.count === 0) {
      const latest = await prisma.abuseReport.findUnique({
        where: { id },
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
      return res.status(409).json({
        error: `Report already ${latest?.status || 'reviewed'}`,
        current_status: latest?.status || 'reviewed',
      });
    }

    const report = await prisma.abuseReport.findUnique({
      where: { id },
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
    if (!report) return res.status(404).json({ error: 'Abuse report not found' });

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

    if ((status === 'resolved' || status === 'dismissed') && report.reporter?.email) {
      const { sendReportStatusEmail } = await import('../lib/email.js');
      sendReportStatusEmail({
        to: report.reporter.email,
        reporterName: report.reporter.display_name || undefined,
        status,
        resolutionNote: resolution_note,
      }).catch(err =>
        console.warn('[adminReports] sendReportStatusEmail failed:', err?.message ?? err)
      );
    }

    return res.json({ report });
  })
);

// POST /admin/reports/bulk-update - Bulk update multiple reports
adminReportsRouter.post(
  '/bulk-update',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const bulkUpdateSchema = z.object({
      report_ids: z.array(z.string().min(1)).min(1),
      status: z.enum(['pending', 'reviewed', 'resolved', 'dismissed']),
      resolution_note: z.string().max(2000).optional(),
    });
    const parsed = bulkUpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { report_ids, status, resolution_note } = parsed.data;

    const result = await prisma.abuseReport.updateMany({
      where: {
        id: { in: report_ids },
        status: { notIn: [...FINAL_REPORT_STATUSES] },
      },
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
  })
);

// DELETE /admin/reports/:id - Delete a report
adminReportsRouter.delete(
  '/:id',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
  })
);

// POST /admin/reports/bulk-delete - Bulk delete multiple reports
adminReportsRouter.post(
  '/bulk-delete',
  requireAdmin as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const bulkDeleteSchema = z.object({
      report_ids: z.array(z.string().min(1)).min(1),
    });
    const parsed = bulkDeleteSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
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
  })
);

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
    if (!parsed.success)
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });

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
    if (FINAL_REPORT_STATUSES.includes(report.status as (typeof FINAL_REPORT_STATUSES)[number])) {
      return res.status(409).json({
        error: `Report already ${report.status}`,
        current_status: report.status,
      });
    }

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

    const transition = await prisma.abuseReport.updateMany({
      where: { id, status: { notIn: [...FINAL_REPORT_STATUSES] } },
      data: {
        status: 'resolved',
        resolution_note: reason,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
      },
    });
    if (transition.count === 0) {
      const latest = await prisma.abuseReport.findUnique({
        where: { id },
        select: { status: true },
      });
      return res.status(409).json({
        error: `Report already ${latest?.status || 'reviewed'}`,
        current_status: latest?.status || 'reviewed',
      });
    }

    const [updatedReport, updatedAd] = await prisma.$transaction([
      prisma.abuseReport.findUniqueOrThrow({ where: { id } }),
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
      }).catch(err =>
        console.warn('[adminReports] ad takedown email failed:', (err as any)?.message || err)
      );
    }

    if (ad.user_id) {
      sendPushNotification(
        ad.user_id,
        'Ad Taken Down',
        `Your ad for "${ad.business_name || 'your business'}" was taken down pending moderator review.${reason ? ` Reason: ${reason}` : ''}`,
        { type: 'ad_rejected', ad_id: ad.id, source: 'report_takedown' }
      ).catch(err =>
        console.warn('[adminReports] ad takedown push failed:', (err as any)?.message || err)
      );

      prisma.notification
        .create({
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
        })
        .catch(err =>
          console.error(
            '[adminReports] ad takedown in-app notification failed:',
            (err as any)?.message || err
          )
        );
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
  })
);
