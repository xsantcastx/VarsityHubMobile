import express from 'express';
import { z } from 'zod';
import { checkReportSpike, getUserModerationHistory, issueWarning, suspendUser } from '../lib/moderation.js';
import { sendAccountPermanentBanEmail, sendCoachApprovedEmail, sendCoachRejectedEmail } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';
import { getFounderMetricsReport } from '../lib/founderMetrics.js';
import {
  getAllTransactions,
  getTransactionBySession,
  getTransactionSummary
} from '../lib/transactionLogger.js';
import { wipeCloudinary, wipeDatabase } from '../lib/wipeProduction.js';
import { requireAdmin as requireAdminMiddleware } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { registerIdValidation } from '../middleware/validateParams.js';
import { adminLimiter } from '../middleware/rateLimiters.js';

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
  adminRouter.post('/wipe-database', requireVerified as any, requireAdminMiddleware as any, async (req, res) => {
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
  });
}

/**
 * GET /admin/dashboard
 * Get platform statistics for admin dashboard
 */
adminRouter.get('/dashboard', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
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
      }).catch(() => [] as Array<{ id: string; admin_email: string; action: string; target_type: string; description: string; timestamp: Date }>),

      // Pending leagues (not yet approved by admin)
      prisma.organization.findMany({
        where: { admin_approved: false, status: { not: 'rejected' } },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          sport: true,
          description: true,
          created_at: true,
          logo_url: true,
          leagueOwner: { select: { id: true, display_name: true, email: true } },
          _count: { select: { teams: true, memberships: true } },
        },
      }).catch(() => []),

      // Events/games with a location string but no lat/lng coordinates
      prisma.game.count({
        where: {
          location: { not: null },
          latitude: null,
          longitude: null,
        },
      }).catch(() => 0),

      // Pending coaches (users with approval_status = 'PENDING' and coach preferences)
      prisma.user.findMany({
        where: {
          approval_status: 'PENDING',
          preferences: { path: ['role'], equals: 'coach' },
        },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          display_name: true,
          email: true,
          username: true,
          avatar_url: true,
          created_at: true,
          preferences: true,
        },
      }).catch(() => [])
    ]);

    return res.json({
      ok: true,
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalTeams,
      totalAds,
      pendingAds,
      pendingLeagues: pendingLeagues || [],
      pendingCoaches: pendingCoaches || [],
      totalPosts,
      totalMessages,
      recentActivity: recentActivity || [],
      eventsWithoutCoordinates: eventsWithoutCoordinates || 0
    });
  } catch (error) {
    console.error('[admin] Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * POST /admin/coaches/:id/approve
 * Approve a pending coach application
 */
adminRouter.post('/coaches/:id/approve', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true, username: true, approval_status: true, preferences: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.approval_status !== 'PENDING') return res.status(400).json({ error: 'User is not pending approval' });

    await prisma.user.update({
      where: { id },
      data: { approval_status: 'APPROVED' },
    });

    // Log admin action
    await prisma.adminActivityLog.create({
      data: {
        admin_id: req.user?.id || 'unknown',
        admin_email: req.user?.id || 'unknown',
        action: 'APPROVE_COACH',
        target_type: 'user',
        target_id: id,
        description: `Approved coach: ${user.display_name || user.username || user.email}${note ? ` — ${note}` : ''}`,
      },
    }).catch(() => {});

    // Send approval email
    if (user.email) {
      sendCoachApprovedEmail({
        to: user.email,
        coachName: user.display_name || user.username || 'Coach',
        leagueName: 'VarsityHub',
      }).catch((err) => console.error('[admin] Failed to send coach approved email:', err));
    }

    // Create in-app notification
    await prisma.notification.create({
      data: {
        user_id: id,
        type: 'JOIN_REQUEST_APPROVED',
        meta: { approved_by: 'admin', note: note || undefined },
      },
    }).catch(() => {});

    return res.json({ ok: true, message: `Coach ${user.display_name || user.username} approved` });
  } catch (error) {
    console.error('[admin] Error approving coach:', error);
    return res.status(500).json({ error: 'Failed to approve coach' });
  }
});

/**
 * POST /admin/coaches/:id/reject
 * Reject a pending coach application
 */
adminRouter.post('/coaches/:id/reject', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body || {};

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, display_name: true, username: true, approval_status: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.approval_status !== 'PENDING') return res.status(400).json({ error: 'User is not pending approval' });

    await prisma.user.update({
      where: { id },
      data: { approval_status: 'REJECTED' },
    });

    // Log admin action
    await prisma.adminActivityLog.create({
      data: {
        admin_id: req.user?.id || 'unknown',
        admin_email: req.user?.id || 'unknown',
        action: 'REJECT_COACH',
        target_type: 'user',
        target_id: id,
        description: `Rejected coach: ${user.display_name || user.username || user.email}${note ? ` — ${note}` : ''}`,
      },
    }).catch(() => {});

    // Send rejection email
    if (user.email) {
      sendCoachRejectedEmail({
        to: user.email,
        coachName: user.display_name || user.username || 'Coach',
        leagueName: 'VarsityHub',
        reason: note || undefined,
      }).catch((err) => console.error('[admin] Failed to send coach rejected email:', err));
    }

    // Create in-app notification
    await prisma.notification.create({
      data: {
        user_id: id,
        type: 'COACH_REJECTED',
        meta: { rejected_by: 'admin', reason: note || undefined },
      },
    }).catch(() => {});

    return res.json({ ok: true, message: `Coach ${user.display_name || user.username} rejected` });
  } catch (error) {
    console.error('[admin] Error rejecting coach:', error);
    return res.status(500).json({ error: 'Failed to reject coach' });
  }
});

/**
 * GET /admin/metrics
 * Founder metrics (new users, reports, messages) over a time range
 */
adminRouter.get('/metrics', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    const daysParam = Number.parseInt(String(req.query.days || '7'), 10);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 30) : 7;
    const report = await getFounderMetricsReport(days);
    return res.json({ ok: true, report });
  } catch (error) {
    console.error('[admin] Error fetching metrics:', error);
    return res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /admin/activity-log
 * Get admin activity audit trail
 * Query params:
 * - type: filter by target_type (e.g., 'user', 'team', 'ad', 'post')
 * - q: search query for action, description, or admin_email
 * - page: page number (default 1)
 * - limit: items per page (default 50, max 100)
 */
adminRouter.get('/activity-log', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
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
});

// Type for authenticated request
type AuthedRequest = express.Request & { user?: { id: string } };

/**
 * Middleware to check if user is admin (LEGACY - use requireAdminMiddleware for new routes)
 */
async function requireAdmin(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: { email: true }
    });

    // Check if user is admin using ADMIN_EMAILS environment variable
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (!user || !adminEmails.includes(user.email?.toLowerCase() || '')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('[admin] Error checking admin status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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
adminRouter.get('/transactions', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
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
      return res.status(400).json({ error: 'Invalid date format', message: 'Use ISO date strings for startDate and endDate.' });
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
});

/**
 * GET /admin/transactions/summary
 * Get transaction summary/analytics
 * Query params:
 * - startDate: start of date range (ISO string, optional)
 * - endDate: end of date range (ISO string, optional)
 */
adminRouter.get('/transactions/summary', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
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
});

/**
 * GET /admin/transactions/:sessionId
 * Get a specific transaction by Stripe session ID
 */
adminRouter.get('/transactions/:sessionId', requireVerified as any, requireAdmin as any, async (req: AuthedRequest, res) => {
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
});

// ============================================
// Moderation Endpoints
// ============================================

/**
 * GET /admin/report-spike
 * Check if there's a report volume spike
 */
adminRouter.get('/report-spike', requireVerified as any, requireAdminMiddleware as any, async (_req: AuthedRequest, res) => {
  try {
    const spike = await checkReportSpike();
    return res.json(spike);
  } catch (error) {
    console.error('[admin] Error checking report spike:', error);
    return res.status(500).json({ error: 'Failed to check report spike' });
  }
});

/**
 * GET /admin/users/:id/moderation
 * Get moderation history for a user
 */
adminRouter.get('/users/:id/moderation', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    const history = await getUserModerationHistory(req.params.id);
    return res.json(history);
  } catch (error) {
    console.error('[admin] Error fetching moderation history:', error);
    return res.status(500).json({ error: 'Failed to fetch moderation history' });
  }
});

/**
 * POST /admin/users/:id/warn
 * Issue a warning to a user
 */
const warnSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  severity: z.enum(['warning', 'strike', 'final_warning']).optional().default('warning'),
});

adminRouter.post('/users/:id/warn', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
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
});

/**
 * POST /admin/users/:id/suspend
 * Temporarily suspend a user
 */
const suspendSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
  days: z.number().int().min(1).max(365).optional().default(7),
});

adminRouter.post('/users/:id/suspend', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
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
});

/**
 * POST /admin/users/:id/ban
 * Ban a user with reason
 */
const banSchema = z.object({
  reason: z.string().max(500).optional(),
});

adminRouter.post('/users/:id/ban', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const parsed = banSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    const { reason } = parsed.data;
    const bannedUserId = req.params.id;

    await prisma.user.update({
      where: { id: bannedUserId },
      data: {
        banned: true,
        ban_reason: reason || 'Banned by admin for violating community guidelines.',
      },
    });

    // Audit log: who banned whom (for compliance and debugging)
    console.warn('[ADMIN_AUDIT] user_banned', {
      admin_id: req.user.id,
      banned_user_id: bannedUserId,
      reason: reason || 'Banned by admin',
      at: new Date().toISOString(),
    });

    await issueWarning({
      userId: req.params.id,
      reason: reason || 'Banned by admin',
      severity: 'final_warning',
      issuedBy: req.user.id,
    });

    // Notify the banned user via email
    const bannedUser = await prisma.user.findUnique({ where: { id: bannedUserId }, select: { email: true, display_name: true } });
    if (bannedUser?.email) {
      sendAccountPermanentBanEmail({
        to: bannedUser.email,
        userName: bannedUser.display_name || 'User',
        banReason: reason || 'Violation of community guidelines',
      }).catch(err => console.warn('[admin] Ban email failed:', err));
    }

    return res.json({ ok: true, banned: true });
  } catch (error) {
    console.error('[admin] Error banning user:', error);
    return res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * POST /admin/users/:id/unban
 * Unban a user with audit trail
 */
adminRouter.post('/users/:id/unban', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const unbannedUserId = req.params.id;

    await prisma.user.update({
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

    return res.json({ ok: true, banned: false });
  } catch (error) {
    console.error('[admin] Error unbanning user:', error);
    return res.status(500).json({ error: 'Failed to unban user' });
  }
});

/**
 * POST /admin/wipe-production
 * Wipes all data except the demo account. Admin-only, requires confirmation header.
 */
adminRouter.post('/wipe-production', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (req.headers['x-confirm-wipe'] !== 'YES_WIPE_EVERYTHING') {
      return res.status(400).json({ error: 'Missing confirmation header: x-confirm-wipe: YES_WIPE_EVERYTHING' });
    }

    const demo = await prisma.user.findFirst({ where: { email: 'demo@varsityhub.app' } });
    const admin = await prisma.user.findFirst({ where: { email: 'emancero@varsityhub.app' } });
    const keepIds = [demo?.id, admin?.id].filter(Boolean) as string[];

    // Use raw SQL to bypass FK constraints
    await prisma.$executeRawUnsafe(`DELETE FROM "Story"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "GameVote"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "EventRsvp"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "AdReservation"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Ad"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "PollVote"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "PollOption"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Poll"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "PostUpvote"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "PostBookmark"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "CategoryAssignment"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Comment"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Notification"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Message"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Follows"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "TeamFollow"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "OrganizationFollow"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "CategoryFollow"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "BlockedUser"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "GroupChatMessage"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "GroupChatMember"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "GroupChat"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Post"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Event"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Game"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "TeamMembership"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "TeamInvite"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Team"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "OrganizationMembership"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "OrganizationJoinRequest"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "Organization"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "UserWarning"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "AbuseReport"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "AdminActivityLog"`);
    await prisma.$executeRawUnsafe(`DELETE FROM "RefreshToken" WHERE "user_id" NOT IN (${keepIds.map(id => `'${id}'`).join(',')})`);
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE "id" NOT IN (${keepIds.map(id => `'${id}'`).join(',')})`);


    const remaining = await prisma.user.count();
    return res.json({ ok: true, message: `Wiped. Users remaining: ${remaining}`, demo_kept: !!demoId });
  } catch (error) {
    console.error('[admin] Wipe error:', error);
    return res.status(500).json({ error: 'Wipe failed', details: (error as any)?.message });
  }
});

export default adminRouter;
