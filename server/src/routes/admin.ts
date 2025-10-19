import express from 'express';
import { prisma } from '../lib/prisma.js';
import {
    getAllTransactions,
    getTransactionBySession,
    getTransactionSummary
} from '../lib/transactionLogger.js';
import { requireVerified } from '../middleware/requireVerified.js';

const adminRouter = express.Router();

// Type for authenticated request
type AuthedRequest = express.Request & { user?: { id: string } };

/**
 * Middleware to check if user is admin
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

    // Check if user is admin (you can modify this logic as needed)
    if (!user || user.email !== 'admin@varsityhub.com') {
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
