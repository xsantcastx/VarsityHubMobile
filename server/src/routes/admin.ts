import express from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { checkReportSpike, getUserModerationHistory, issueWarning, suspendUser } from '../lib/moderation.js';
import { sendPushNotification } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import { approveCoach, rejectCoach } from '../lib/approvalService.js';
import { logAdminActivityFromReq } from '../lib/adminActivityLogger.js';
import { getFounderMetricsReport } from '../lib/founderMetrics.js';
import {
  getAllTransactions,
  getTransactionBySession,
  getTransactionSummary
} from '../lib/transactionLogger.js';
import { wipeCloudinary, wipeDatabase } from '../lib/wipeProduction.js';
import { updateUserAndInvalidate } from '../lib/userCache.js';
import { requireAdmin as requireAdminMiddleware } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { registerIdValidation } from '../middleware/validateParams.js';
import { adminLimiter } from '../middleware/rateLimiters.js';
import { captureException } from '../lib/sentry.js';

const adminRouter = express.Router();
registerIdValidation(adminRouter);
adminRouter.use(adminLimiter);

/**
 * POST /admin/wipe-database
 * One-time production wipe. Only available when WIPE_TOKEN is set in env.
 * Call with header: X-Wipe-Token: <WIPE_TOKEN>. Remove WIPE_TOKEN after use.
 */
const WIPE_TOKEN = process.env.WIPE_TOKEN;
if (WIPE_TOKEN) {
  adminRouter.post('/wipe-database', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req, res) => {
    // Double gate: requires both admin auth AND correct wipe token
    const token = req.headers['x-wipe-token'];
    if (token !== WIPE_TOKEN) {
      return res.status(401).json({ error: 'Invalid or missing X-Wipe-Token' });
    }
    try {
      const dbResult = await wipeDatabase(prisma);
      const cloudResult = await wipeCloudinary();
      return res.json({
        ok: true,
        message: 'Production wipe complete. Remove WIPE_TOKEN from Railway after this.',
        database: dbResult.deleted,
        cloudinaryDeleted: cloudResult.deleted,
      });
    } catch (err) {
      console.error('[admin] wipe-database error:', err);
      return res.status(500).json({ error: 'Wipe failed' });
    }
  }));
}

/**
 * GET /admin/dashboard
 * Get platform statistics for admin dashboard
 */
adminRouter.get('/dashboard', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalTeams,
      totalAds,
      pendingAds,
      totalPosts,
      totalMessages,
      recentActivity,
      pendingLeagues,
      eventsWithoutCoordinates,
      pendingCoaches
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Verified users (email verified)
      prisma.user.count({ where: { email_verified: true } }),

      // Banned users
      prisma.user.count({ where: { banned: true } }),

      // Total teams
      prisma.team.count(),

      // Total ads
      prisma.ad.count(),

      // Pending ads (status = pending)
      prisma.ad.count({ where: { status: 'pending' } }),

      // Total posts
      prisma.post.count({ where: { deleted_at: null } }),

      // Total messages
      prisma.message.count(),

      // Recent activity (last 5 admin actions)
      prisma.adminActivityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5,
        select: { id: true, admin_email: true, action: true, target_type: true, description: true, timestamp: true },
      }).catch((err) => { console.error('[admin] Failed to fetch recent activity:', err); return [] as Array<{ id: string; admin_email: string; action: string; target_type: string; description: string; timestamp: Date }>; }),

      // Pending leagues (not yet approved by admin)
      prisma.organization.findMany({
        where: { admin_approved: false, status: { not: 'rejected' } },
        orderBy: { created_at: 'desc' },
        take: 200,
        select: {
          id: true,
          name: true,
          sport: true,
          description: true,
          created_at: true,
          logo_url: true,
          supporting_document_url: true,
          leagueOwner: { select: { id: true, display_name: true, email: true } },
          _count: { select: { teams: true, memberships: true } },
        },
      }).catch((err) => { console.error('[admin] Failed to fetch pending leagues:', err); return []; }),

      // Events/games with a location string but no lat/lng coordinates
      prisma.game.count({
        where: {
          location: { not: null },
          latitude: null,
          longitude: null,
        },
      }).catch((err) => { console.error('[admin] Failed to count events without coords:', err); return 0; }),

      // Pending coaches (users with approval_status = 'PENDING' and coach preferences)
      prisma.user.findMany({
        where: {
          approval_status: 'PENDING',
          OR: [
            { role: 'coach' as any },
            { preferences: { path: ['role'], equals: 'coach' } },
          ],
        },
        orderBy: { created_at: 'desc' },
        take: 200,
        select: {
          id: true,
          display_name: true,
          email: true,
          username: true,
          avatar_url: true,
          created_at: true,
          preferences: true,
          coachApplications: {
            where: { status: { in: ['submitted', 'approved', 'rejected'] } },
            orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
            take: 1,
            select: {
              id: true,
              status: true,
              organization_name: true,
              org_type: true,
              location: true,
              zip_code: true,
              place_id: true,
              supporting_document_url: true,
              background_url: true,
              payload: true,
              submitted_at: true,
              reviewed_at: true,
              reviewed_by: true,
              review_note: true,
              created_at: true,
              updated_at: true,
            },
          },
        },
      }).catch((err) => { console.error('[admin] Failed to fetch pending coaches:', err); return []; })
    ]);

    const normalizedPendingCoaches = (pendingCoaches || []).map((coach: any) => ({
      ...coach,
      coach_application: Array.isArray(coach.coachApplications) ? coach.coachApplications[0] || null : null,
      coachApplications: undefined,
    }));

    return res.json({
      ok: true,
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalTeams,
      totalAds,
      pendingAds,
      pendingLeagues: pendingLeagues || [],
      pendingCoaches: normalizedPendingCoaches,
      totalPosts,
      totalMessages,
      recentActivity: recentActivity || [],
      eventsWithoutCoordinates: eventsWithoutCoordinates || 0
    });
  } catch (error) {
    console.error('[admin] Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
}));

/**
 * POST /admin/coaches/:id/approve
 * Approve a pending coach application
 */
adminRouter.post('/coaches/:id/approve', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const result = await approveCoach(id, req.user?.id || 'unknown', prisma, { note });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });

    // Log admin action via centralized logger (AUTH-3 — auto-resolves admin email)
    const user = result.user!;
    await logAdminActivityFromReq(req, 'APPROVE_COACH', 'user', id,
      `Approved coach: ${user.display_name || user.username || user.email}${note ? ` — ${note}` : ''}`);

    return res.json({ ok: true, message: `Coach ${user.display_name || user.username} approved` });
  } catch (error) {
    console.error('[admin] Error approving coach:', error);
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'admin_approve_coach_failed',
      coachId: req.params.id,
      adminId: req.user?.id || null,
    });
    return res.status(500).json({ error: 'Failed to approve coach' });
  }
}));

/**
 * POST /admin/coaches/:id/reject
 * Reject a pending coach application
 */
adminRouter.post('/coaches/:id/reject', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const result = await rejectCoach(id, req.user?.id || 'unknown', prisma, { reason: note });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });

    // Log admin action via centralized logger (AUTH-3 — auto-resolves admin email)
    const user = result.user!;
    await logAdminActivityFromReq(req, 'REJECT_COACH', 'user', id,
      `Rejected coach: ${user.display_name || user.username || user.email}${note ? ` — ${note}` : ''}`);

    return res.json({ ok: true, message: `Coach ${user.display_name || user.username} rejected` });
  } catch (error) {
    console.error('[admin] Error rejecting coach:', error);
    captureException(error instanceof Error ? error : new Error(String(error)), {
      context: 'admin_reject_coach_failed',
      coachId: req.params.id,
      adminId: req.user?.id || null,
    });
    return res.status(500).json({ error: 'Failed to reject coach' });
  }
}));

/**
 * PATCH /admin/users/:id/parental-consent
 * Admin override for parental consent state. Lets support correct mistakes —
 * e.g., a parent accidentally clicked Deny, or a legitimate minor's guardian
 * never received the email and support wants to approve manually. The change
 * is recorded in the admin activity log and (on approve) unbans the user.
 */
const consentOverrideSchema = z.object({
  status: z.enum(['approved', 'denied', 'pending']),
  reason: z.string().max(500).optional(),
});
adminRouter.patch(
  '/users/:id/parental-consent',
  requireVerified as any,
  requireAdminMiddleware as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = String(req.params.id);
    const parsed = consentOverrideSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    }
    const { status, reason } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, display_name: true, parental_consent_status: true } as any,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const fromState = (user as any).parental_consent_status as
      | 'not_required' | 'pending' | 'approved' | 'denied';

    const now = new Date();
    const updateData: Record<string, unknown> = {
      parental_consent_status: status,
      parental_consent_at: status === 'pending' ? null : now,
      // Any override invalidates outstanding email links.
      parental_consent_token_hash: null,
    };
    if (status === 'approved') {
      // Unban the user if they were denied and are now approved.
      updateData.banned = false;
      updateData.ban_reason = null;
    } else if (status === 'denied') {
      updateData.banned = true;
      updateData.ban_reason = reason?.trim() || 'Parental consent denied by admin';
    }

    // Atomically: update user + write COPPA-grade audit row. The dedicated
    // ParentalConsentAudit table is append-only and survives any purge of the
    // generic admin activity log, satisfying COPPA recordkeeping requirements.
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: updateData as any }),
      (prisma as any).parentalConsentAudit.create({
        data: {
          user_id: userId,
          actor_admin_id: req.user!.id,
          from_state: fromState,
          to_state: status,
          reason: reason?.trim() || `Admin override: ${fromState} → ${status}`,
        },
      }),
    ]);

    await logAdminActivityFromReq(
      req,
      'OVERRIDE_PARENTAL_CONSENT',
      'user',
      userId,
      `Set parental_consent_status=${status}${reason ? ` — ${reason}` : ''}`
    );

    return res.json({ ok: true, status, from_state: fromState });
  })
);

/**
 * GET /admin/metrics
 * Founder metrics (new users, reports, messages) over a time range
 */
adminRouter.get('/metrics', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const daysParam = Number.parseInt(String(req.query.days || '7'), 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 30) : 7;
    const report = await getFounderMetricsReport(days);
    return res.json({ ok: true, report });
  } catch (error) {
    console.error('[admin] Error fetching metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
}));

/**
 * GET /admin/activity-log
 * Get admin activity audit trail
 * Query params:
 * - type: filter by target_type (e.g., 'user', 'team', 'ad', 'post')
 * - q: search query for action, description, or admin_email
 * - page: page number (default 1)
 * - limit: items per page (default 50, max 100)
 */
adminRouter.get('/activity-log', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { type, q, page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(String(page), 10);
    const limitNum = Math.max(1, Math.min(parseInt(String(limit), 10), 100)); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    // Filter by type
    if (type && type !== 'all') {
      where.target_type = String(type);
    }
    
    // Search query
    if (q && typeof q === 'string' && q.trim()) {
      where.OR = [
        { action: { contains: String(q), mode: 'insensitive' } },
        { description: { contains: String(q), mode: 'insensitive' } },
        { admin_email: { contains: String(q), mode: 'insensitive' } }
      ];
    }

    // Check if AdminActivityLog table exists, if not return empty results
    try {
      const [activities, total] = await Promise.all([
        prisma.adminActivityLog.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            admin_id: true,
            admin_email: true,
            action: true,
            target_type: true,
            target_id: true,
            description: true,
            metadata: true,
            timestamp: true
          }
        }),
        prisma.adminActivityLog.count({ where })
      ]);

      return res.json({
        ok: true,
        activities,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      });
    } catch (error) {
      // Table doesn't exist yet, return empty results
      return res.json({
        ok: true,
        activities: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0
        }
      });
    }
  } catch (error) {
    console.error('[admin] Error fetching activity log:', error);
    return res.status(500).json({ error: 'Failed to fetch activity log' });
  }
}));

// Type for authenticated request
type AuthedRequest = express.Request & { user?: { id: string } };

/**
 * GET /admin/transactions
 * Get all transactions with optional filters
 * Query params:
 * - type: filter by transaction type (e.g., 'AD_PURCHASE', 'SUBSCRIPTION_PURCHASE')
 * - status: filter by status (e.g., 'COMPLETED', 'PENDING', 'FAILED')
 * - userId: filter by user ID
 * - startDate: filter transactions after this date (ISO string)
 * - endDate: filter transactions before this date (ISO string)
 * - limit: number of results (default 50)
 * - offset: pagination offset (default 0)
 */
adminRouter.get('/transactions', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const {
      type,
      status,
      userId,
      startDate,
      endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    const dateParsed = z.object({
      startDate: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
      endDate: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
    }).safeParse({ startDate, endDate });
    if (!dateParsed.success) {
      return res.status(400).json({ error: 'Invalid date format. Use ISO date strings for startDate and endDate.' });
    }

    const filters: any = {};
    if (type) filters.transactionType = String(type);
    if (status) filters.status = String(status);
    if (userId) filters.userId = String(userId);
    if (dateParsed.data.startDate) filters.startDate = dateParsed.data.startDate;
    if (dateParsed.data.endDate) filters.endDate = dateParsed.data.endDate;

    const transactions = await getAllTransactions(
      filters,
      parseInt(String(limit)),
      parseInt(String(offset))
    );

    return res.json({
      ok: true,
      transactions,
      filters,
      limit: parseInt(String(limit)),
      offset: parseInt(String(offset))
    });
  } catch (error) {
    console.error('[admin] Error fetching transactions:', error);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
}));

/**
 * GET /admin/transactions/summary
 * Get transaction summary/analytics
 * Query params:
 * - startDate: start of date range (ISO string, optional)
 * - endDate: end of date range (ISO string, optional)
 */
adminRouter.get('/transactions/summary', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(String(startDate)) : undefined;
    const end = endDate ? new Date(String(endDate)) : undefined;

    const summary = await getTransactionSummary(start, end);

    return res.json({
      ok: true,
      summary,
      dateRange: {
        start: start?.toISOString(),
        end: end?.toISOString()
      }
    });
  } catch (error) {
    console.error('[admin] Error fetching transaction summary:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction summary' });
  }
}));

/**
 * GET /admin/transactions/:sessionId
 * Get a specific transaction by Stripe session ID
 */
adminRouter.get('/transactions/:sessionId', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const transaction = await getTransactionBySession(sessionId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({
      ok: true,
      transaction
    });
  } catch (error) {
    console.error('[admin] Error fetching transaction:', error);
    return res.status(500).json({ error: 'Failed to fetch transaction' });
  }
}));

// ============================================
// Moderation Endpoints
// ============================================

/**
 * GET /admin/report-spike
 * Check if there's a report volume spike
 */
adminRouter.get('/report-spike', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (_req: AuthedRequest, res) => {
  try {
    const spike = await checkReportSpike();
    return res.json(spike);
  } catch (error) {
    console.error('[admin] Error checking report spike:', error);
    return res.status(500).json({ error: 'Failed to check report spike' });
  }
}));

/**
 * GET /admin/users/:id/moderation
 * Get moderation history for a user
 */
adminRouter.get('/users/:id/moderation', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const history = await getUserModerationHistory(req.params.id);
    return res.json(history);
  } catch (error) {
    console.error('[admin] Error fetching moderation history:', error);
    return res.status(500).json({ error: 'Failed to fetch moderation history' });
  }
}));

/**
 * POST /admin/users/:id/warn
 * Issue a warning to a user
 */
const warnSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  severity: z.enum(['warning', 'strike', 'final_warning']).optional().default('warning'),
});

adminRouter.post('/users/:id/warn', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = warnSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { reason, severity } = parsed.data;

    const result = await issueWarning({
      userId: req.params.id,
      reason,
      severity,
      issuedBy: req.user.id,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error('[admin] Error issuing warning:', error);
    return res.status(500).json({ error: 'Failed to issue warning' });
  }
}));

/**
 * POST /admin/users/:id/suspend
 * Temporarily suspend a user
 */
const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  days: z.number().int().min(1).max(365).optional().default(7),
});

adminRouter.post('/users/:id/suspend', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = suspendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { days: suspendDays, reason } = parsed.data;

    await suspendUser({
      userId: req.params.id,
      days: suspendDays,
      reason,
      adminId: req.user.id,
    });
    return res.json({ ok: true, suspended_days: suspendDays });
  } catch (error) {
    console.error('[admin] Error suspending user:', error);
    return res.status(500).json({ error: 'Failed to suspend user' });
  }
}));

/**
 * POST /admin/users/:id/ban
 * Ban a user with reason
 */
const banSchema = z.object({
  reason: z.string().max(500).optional(),
});

adminRouter.post('/users/:id/ban', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = banSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { reason } = parsed.data;
    const bannedUserId = req.params.id;

    await updateUserAndInvalidate(prisma, {
      where: { id: bannedUserId },
      data: {
        banned: true,
        ban_reason: reason || 'Banned by admin for violating community guidelines.',
      },
    });

    // Revoke all refresh tokens so banned user can't get new access tokens
    await prisma.refreshToken.deleteMany({ where: { user_id: bannedUserId } });

    // Audit log: who banned whom (for compliance and debugging)
    console.warn('[ADMIN_AUDIT] user_banned', {
      admin_id: req.user.id,
      banned_user_id: bannedUserId,
      reason: reason || 'Banned by admin',
      at: new Date().toISOString(),
    });

    await logAdminActivityFromReq(req, 'BAN_USER', 'user', bannedUserId,
      `Banned user ${bannedUserId}${reason ? ': ' + reason : ''}`);

    await issueWarning({
      userId: req.params.id,
      reason: reason || 'Banned by admin',
      severity: 'final_warning',
      issuedBy: req.user.id,
    });

    // Ban notification email removed — non-mandatory moderation email

    return res.json({ ok: true, banned: true });
  } catch (error) {
    console.error('[admin] Error banning user:', error);
    return res.status(500).json({ error: 'Failed to ban user' });
  }
}));

/**
 * POST /admin/users/:id/unban
 * Unban a user with audit trail
 */
adminRouter.post('/users/:id/unban', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const unbannedUserId = req.params.id;

    await updateUserAndInvalidate(prisma, {
      where: { id: unbannedUserId },
      data: {
        banned: false,
        ban_reason: null,
      },
    });

    // Audit log
    console.warn('[ADMIN_AUDIT] user_unbanned', {
      admin_id: req.user.id,
      unbanned_user_id: unbannedUserId,
      at: new Date().toISOString(),
    });

    await logAdminActivityFromReq(req, 'UNBAN_USER', 'user', unbannedUserId,
      `Unbanned user ${unbannedUserId}`);

    return res.json({ ok: true, banned: false });
  } catch (error) {
    console.error('[admin] Error unbanning user:', error);
    return res.status(500).json({ error: 'Failed to unban user' });
  }
}));

/**
 * POST /admin/wipe-production
 * Wipes all data except the demo account. Admin-only, requires confirmation header.
 */
adminRouter.post('/wipe-production', requireVerified as any, requireAdminMiddleware as any, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    if (req.headers['x-confirm-wipe'] !== 'YES_WIPE_EVERYTHING') {
      return res.status(400).json({ error: 'Missing confirmation header: x-confirm-wipe: YES_WIPE_EVERYTHING' });
    }

    const demo = await prisma.user.findFirst({ where: { email: 'demo@varsityhub.app' } });
    const adminEmail = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean)[0] || '';
    const admin = adminEmail ? await prisma.user.findFirst({ where: { email: adminEmail } }) : null;
    const keepIds = [demo?.id, admin?.id].filter(Boolean) as string[];

    // Use raw SQL to bypass FK constraints
    await prisma.$executeRaw`DELETE FROM "Story"`;
    await prisma.$executeRaw`DELETE FROM "GameVote"`;
    await prisma.$executeRaw`DELETE FROM "EventRsvp"`;
    await prisma.$executeRaw`DELETE FROM "AdReservation"`;
    await prisma.$executeRaw`DELETE FROM "Ad"`;
    await prisma.$executeRaw`DELETE FROM "PollVote"`;
    await prisma.$executeRaw`DELETE FROM "PollOption"`;
    await prisma.$executeRaw`DELETE FROM "Poll"`;
    await prisma.$executeRaw`DELETE FROM "PostUpvote"`;
    await prisma.$executeRaw`DELETE FROM "PostBookmark"`;
    await prisma.$executeRaw`DELETE FROM "CategoryAssignment"`;
    await prisma.$executeRaw`DELETE FROM "Comment"`;
    await prisma.$executeRaw`DELETE FROM "Notification"`;
    await prisma.$executeRaw`DELETE FROM "Message"`;
    await prisma.$executeRaw`DELETE FROM "Follows"`;
    await prisma.$executeRaw`DELETE FROM "TeamFollow"`;
    await prisma.$executeRaw`DELETE FROM "OrganizationFollow"`;
    await prisma.$executeRaw`DELETE FROM "CategoryFollow"`;
    await prisma.$executeRaw`DELETE FROM "BlockedUser"`;
    await prisma.$executeRaw`DELETE FROM "GroupChatMessage"`;
    await prisma.$executeRaw`DELETE FROM "GroupChatMember"`;
    await prisma.$executeRaw`DELETE FROM "GroupChat"`;
    await prisma.$executeRaw`DELETE FROM "Post"`;
    await prisma.$executeRaw`DELETE FROM "Event"`;
    await prisma.$executeRaw`DELETE FROM "Game"`;
    await prisma.$executeRaw`DELETE FROM "TeamMembership"`;
    await prisma.$executeRaw`DELETE FROM "TeamInvite"`;
    await prisma.$executeRaw`DELETE FROM "Team"`;
    await prisma.$executeRaw`DELETE FROM "OrganizationMembership"`;
    await prisma.$executeRaw`DELETE FROM "OrganizationJoinRequest"`;
    await prisma.$executeRaw`DELETE FROM "Organization"`;
    await prisma.$executeRaw`DELETE FROM "UserWarning"`;
    await prisma.$executeRaw`DELETE FROM "AbuseReport"`;
    await prisma.$executeRaw`DELETE FROM "AdminActivityLog"`;
    const { Prisma } = await import('@prisma/client');
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "RefreshToken" WHERE "user_id" NOT IN (${Prisma.join(keepIds)})`);
    await prisma.$executeRaw(Prisma.sql`DELETE FROM "User" WHERE "id" NOT IN (${Prisma.join(keepIds)})`);


    const remaining = await prisma.user.count();
    return res.json({ ok: true, message: `Wiped. Users remaining: ${remaining}`, demo_kept: !!demo });
  } catch (error) {
    console.error('[admin] Wipe error:', error);
    return res.status(500).json({ error: 'Wipe failed', details: (error as any)?.message });
  }
}));

export default adminRouter;
