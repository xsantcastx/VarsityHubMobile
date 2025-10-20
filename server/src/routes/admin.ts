import express from 'express';
import { prisma } from '../lib/prisma.js';
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
      prisma.post.count(),
      
      // Total messages
      prisma.message.count(),
      
      // Recent activity (last 5 admin actions) - Check if table exists
      prisma.$queryRaw`
        SELECT id, admin_email, action, target_type, description, timestamp
        FROM "AdminActivityLog"
        ORDER BY timestamp DESC
        LIMIT 5
      `.catch(() => []) // Return empty array if table doesn't exist yet
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

    const filters: any = {};
    if (type) filters.transactionType = String(type);
    if (status) filters.status = String(status);
    if (userId) filters.userId = String(userId);
    if (startDate) filters.startDate = new Date(String(startDate));
    if (endDate) filters.endDate = new Date(String(endDate));

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

export default adminRouter;
