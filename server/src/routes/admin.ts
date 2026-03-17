import express from 'express';
import { z } from 'zod';
import { checkReportSpike, getUserModerationHistory, issueWarning, suspendUser } from '../lib/moderation.js';
import { prisma } from '../lib/prisma.js';
import { getFounderMetricsReport } from '../lib/founderMetrics.js';
import {
  getAllTransactions,
  getTransactionBySession,
  getTransactionSummary
} from '../lib/transactionLogger.js';
import { requireAdmin as requireAdminMiddleware } from '../middleware/requireAdmin.js';
import { requireVerified } from '../middleware/requireVerified.js';

const adminRouter = express.Router();

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
      recentActivity
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
      }).catch(() => [] as Array<{ id: string; admin_email: string; action: string; target_type: string; description: string; timestamp: Date }>)
    ]);

    return res.json({
      ok: true,
      totalUsers,
      verifiedUsers,
      bannedUsers,
      totalTeams,
      totalAds,
      pendingAds,
      totalPosts,
      totalMessages,
      recentActivity: recentActivity || []
    });
  } catch (error) {
    console.error('[admin] Error fetching dashboard data:', error);
    return res.status(500).json({ error: 'Failed to fetch dashboard data' });
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
    const limitNum = Math.min(parseInt(String(limit), 10), 100); // Max 100 per page
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
adminRouter.post('/users/:id/warn', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { reason, severity } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const result = await issueWarning({
      userId: req.params.id,
      reason,
      severity: severity || 'warning',
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
adminRouter.post('/users/:id/suspend', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { days, reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Reason is required' });
    const suspendDays = Math.max(1, Math.min(365, parseInt(days) || 7));

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
adminRouter.post('/users/:id/ban', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const { reason } = req.body;
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

    return res.json({ ok: true, banned: true });
  } catch (error) {
    console.error('[admin] Error banning user:', error);
    return res.status(500).json({ error: 'Failed to ban user' });
  }
});

export default adminRouter;
