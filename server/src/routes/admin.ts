import express from 'express';
import { logAdminActivityFromReq } from '../lib/adminActivityLogger.js';
import {
  sendAccountPermanentBanEmail,
  sendAccountSuspension45DaysEmail,
  sendAccountSuspension7DaysEmail,
  sendAccountWarningEmail,
  sendContentRemovedEmail,
  sendOrganizationApprovalEmail,
  sendOrganizationDenialEmail,
} from '../lib/email.js';
import { createInAppNotification, sendPushNotification } from '../lib/notifications.js';
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

function getPreferenceObject(preferences: unknown): Record<string, any> {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? ({ ...(preferences as Record<string, any>) } as Record<string, any>)
    : {};
}

function addDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
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
      pendingCoachRows,
      pendingCoachQueue,
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

      prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count
        FROM "User"
        WHERE COALESCE("preferences"->>'role', '') = 'coach'
          AND (
            COALESCE("preferences"->>'approval_status', '') = 'PENDING'
            OR (
              COALESCE("preferences"->>'approval_status', '') = ''
              AND (
                COALESCE("preferences"->>'organization_id', '') <> ''
                OR COALESCE("preferences"->>'team_id', '') <> ''
              )
              AND COALESCE("preferences"->>'onboarding_completed', 'false') <> 'true'
            )
          )
      `,

      prisma.$queryRaw<Array<{
        id: string;
        email: string | null;
        display_name: string | null;
        created_at: Date;
        organization_id: string | null;
        organization_name: string | null;
        approval_status: string | null;
      }>>`
        SELECT
          id,
          email,
          display_name,
          created_at,
          NULLIF(COALESCE("preferences"->>'organization_id', ''), '') AS organization_id,
          NULLIF(COALESCE("preferences"->>'organization_name', ''), '') AS organization_name,
          NULLIF(COALESCE("preferences"->>'approval_status', ''), '') AS approval_status
        FROM "User"
        WHERE COALESCE("preferences"->>'role', '') = 'coach'
          AND (
            COALESCE("preferences"->>'approval_status', '') = 'PENDING'
            OR (
              COALESCE("preferences"->>'approval_status', '') = ''
              AND (
                COALESCE("preferences"->>'organization_id', '') <> ''
                OR COALESCE("preferences"->>'team_id', '') <> ''
              )
              AND COALESCE("preferences"->>'onboarding_completed', 'false') <> 'true'
            )
          )
        ORDER BY created_at DESC
        LIMIT 8
      `,
      
      // Total posts
      prisma.post.count({ where: { deleted_at: null } }),
      
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
      pendingCoachCount: Number(pendingCoachRows?.[0]?.count || 0),
      pendingCoaches: pendingCoachQueue || [],
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

adminRouter.get('/organizations', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const status = typeof req.query.status === 'string' && req.query.status.trim() ? String(req.query.status) : 'all';
  const where = status === 'all' ? {} : { status };
  const organizations = await prisma.organization.findMany({
    where,
    orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
    include: {
      _count: {
        select: { teams: true, memberships: true, joinRequests: true },
      },
    },
    take: 200,
  });
  return res.json({ items: organizations });
});

adminRouter.patch('/organizations/:id/status', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const status = String(req.body?.status || '').trim().toLowerCase();
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

  if (!['pending', 'active', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid organization status' });
  }

  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'Organization not found' });

  const updated = await prisma.organization.update({
    where: { id },
    data: { status, updated_at: new Date() },
  });

  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: id, role: 'owner', status: 'active' },
    include: { user: { select: { email: true } } },
    orderBy: { created_at: 'asc' },
  });

  const ownerEmail = ownerMembership?.user?.email;
  if (ownerEmail) {
    if (status === 'active') {
      await sendOrganizationApprovalEmail({
        to: ownerEmail,
        organizationName: updated.name,
      }).catch(() => {});
    } else if (status === 'rejected') {
      await sendOrganizationDenialEmail({
        to: ownerEmail,
        organizationName: updated.name,
        reason: note || undefined,
      }).catch(() => {});
    }
  }

  await logAdminActivityFromReq(
    req,
    'Review Organization',
    'organization',
    updated.id,
    `Set organization ${updated.name} to ${status}`,
    { status, note: note || null }
  );

  return res.json({ ok: true, organization: updated });
});

adminRouter.post('/users/:id/moderation', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const userId = String(req.params.id);
  const action = String(req.body?.action || '').trim();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const organizationId = typeof req.body?.organization_id === 'string' ? req.body.organization_id.trim() : '';

  if (
    ![
      'warning',
      'suspend_7_days',
      'suspend_45_days',
      'permanent_ban',
      'clear_suspension',
      'approve_coach',
      'reject_coach',
    ].includes(action)
  ) {
    return res.status(400).json({ error: 'Invalid moderation action' });
  }

  if (action !== 'clear_suspension' && !reason) {
    return res.status(400).json({ error: 'Reason is required' });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });
  if (!target) return res.status(404).json({ error: 'User not found' });

  const prefs = getPreferenceObject(target.preferences);
  const offenseCount = Number.isFinite(Number(prefs.offense_count)) ? Number(prefs.offense_count) : 0;
  const updatedPrefs: Record<string, any> = { ...prefs };
  const updateData: Record<string, any> = { preferences: updatedPrefs };

  let emailPromise: Promise<any> | null = null;
  const existingOrganizationId =
    typeof updatedPrefs.organization_id === 'string' ? updatedPrefs.organization_id.trim() : '';
  const resolvedOrganizationId = organizationId || existingOrganizationId;
  let resolvedOrganizationName =
    typeof updatedPrefs.organization_name === 'string' ? updatedPrefs.organization_name : '';

  if (action === 'warning') {
    updatedPrefs.offense_count = offenseCount + 1;
    updatedPrefs.last_warning_reason = reason;
    updatedPrefs.last_warning_at = new Date().toISOString();
    emailPromise = sendAccountWarningEmail({
      to: target.email,
      userName: target.display_name || target.email,
      warningReason: reason,
      offenseCount: updatedPrefs.offense_count,
    });
  }

  if (action === 'suspend_7_days' || action === 'suspend_45_days') {
    const days = action === 'suspend_7_days' ? 7 : 45;
    const suspensionEnd = addDays(days);
    updatedPrefs.offense_count = offenseCount + 1;
    updatedPrefs.suspension_until = suspensionEnd.toISOString();
    updatedPrefs.suspension_reason = reason;
    updatedPrefs.suspension_reviewed_at = new Date().toISOString();
    updateData.preferences = updatedPrefs;
    emailPromise =
      action === 'suspend_7_days'
        ? sendAccountSuspension7DaysEmail({
            to: target.email,
            userName: target.display_name || target.email,
            suspensionReason: reason,
            suspensionEndDate: suspensionEnd.toISOString().slice(0, 10),
          })
        : sendAccountSuspension45DaysEmail({
            to: target.email,
            userName: target.display_name || target.email,
            suspensionReason: reason,
            suspensionEndDate: suspensionEnd.toISOString().slice(0, 10),
          });
  }

  if (action === 'permanent_ban') {
    updatedPrefs.offense_count = offenseCount + 1;
    updatedPrefs.ban_reason = reason;
    updatedPrefs.ban_reviewed_at = new Date().toISOString();
    updateData.banned = true;
    emailPromise = sendAccountPermanentBanEmail({
      to: target.email,
      userName: target.display_name || target.email,
      banReason: reason,
    });
  }

  if (action === 'clear_suspension') {
    updatedPrefs.suspension_until = null;
    updatedPrefs.suspension_reason = null;
    updatedPrefs.suspension_reviewed_at = new Date().toISOString();
  }

  if (action === 'approve_coach' || action === 'reject_coach') {
    updatedPrefs.role = action === 'approve_coach' ? 'coach' : 'fan';
    updatedPrefs.approval_status = action === 'approve_coach' ? 'APPROVED' : 'REJECTED';
    updatedPrefs.approval_reason = reason;
    updatedPrefs.approval_reviewed_at = new Date().toISOString();
    if (resolvedOrganizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: resolvedOrganizationId },
        select: { id: true, name: true },
      });
      if (org) {
        updatedPrefs.organization_id = org.id;
        updatedPrefs.organization_name = org.name;
        resolvedOrganizationName = org.name;
      }
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      display_name: true,
      banned: true,
      preferences: true,
    },
  });

  if (emailPromise) {
    await emailPromise.catch(() => {});
  }

  if (action === 'approve_coach' && resolvedOrganizationId) {
    await prisma.$transaction(async (tx) => {
      const pendingJoinRequest = await tx.organizationJoinRequest.findUnique({
        where: {
          organization_id_user_id: {
            organization_id: resolvedOrganizationId,
            user_id: userId,
          } as any,
        },
      });

      if (pendingJoinRequest?.status === 'pending') {
        await tx.organizationJoinRequest.update({
          where: { id: pendingJoinRequest.id },
          data: {
            status: 'approved',
            reviewed_at: new Date(),
            reviewed_by: req.user!.id,
          },
        });
      }

      await tx.organizationMembership.upsert({
        where: {
          organization_id_user_id: {
            organization_id: resolvedOrganizationId,
            user_id: userId,
          } as any,
        },
        update: {
          status: 'active',
        },
        create: {
          organization_id: resolvedOrganizationId,
          user_id: userId,
          role: 'member',
          status: 'active',
        },
      });
    });

    await createInAppNotification({
      userId: updated.id,
      actorId: req.user!.id,
      type: 'COACH_APPROVED',
      meta: {
        organization_id: resolvedOrganizationId,
        organization_name: resolvedOrganizationName || null,
      },
    }).catch(() => {});

    await sendPushNotification(
      updated.id,
      'Coach account approved',
      resolvedOrganizationName
        ? `Your coach access for ${resolvedOrganizationName} is now active.`
        : 'Your coach access is now active.',
      {
        type: 'coach_approved',
        organization_id: resolvedOrganizationId,
        organization_name: resolvedOrganizationName || null,
        screen: 'organization',
      }
    ).catch(() => {});
  }

  if (action === 'reject_coach') {
    if (resolvedOrganizationId) {
      await prisma.$transaction(async (tx) => {
        const pendingJoinRequest = await tx.organizationJoinRequest.findUnique({
          where: {
            organization_id_user_id: {
              organization_id: resolvedOrganizationId,
              user_id: userId,
            } as any,
          },
        });

        if (pendingJoinRequest?.status === 'pending') {
          await tx.organizationJoinRequest.update({
            where: { id: pendingJoinRequest.id },
            data: {
              status: 'denied',
              reviewed_at: new Date(),
              reviewed_by: req.user!.id,
              message: reason || pendingJoinRequest.message,
            },
          });
        }

        await tx.organizationMembership.updateMany({
          where: {
            organization_id: resolvedOrganizationId,
            user_id: userId,
            NOT: { status: 'archived' },
          },
          data: {
            status: 'archived',
          },
        });
      });
    }

    await createInAppNotification({
      userId: updated.id,
      actorId: req.user!.id,
      type: 'COACH_REJECTED',
      meta: {
        organization_id: resolvedOrganizationId || null,
        organization_name: resolvedOrganizationName || null,
        reason: reason || null,
      },
    }).catch(() => {});

    await sendPushNotification(
      updated.id,
      'Coach application update',
      reason || 'Your coach application was not approved.',
      {
        type: 'coach_rejected',
        organization_id: resolvedOrganizationId || null,
        organization_name: resolvedOrganizationName || null,
        reason: reason || null,
        screen: 'profile',
      }
    ).catch(() => {});
  }

  await logAdminActivityFromReq(
    req,
    'Moderate User',
    'user',
    updated.id,
    `Applied moderation action ${action} to ${updated.email}`,
    { action, reason: reason || null, organization_id: organizationId || null }
  );

  return res.json({ ok: true, user: updated });
});

adminRouter.delete('/posts/:id', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const post = await prisma.post.findUnique({
    where: { id },
    include: { author: { select: { email: true, display_name: true } } },
  });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const deletedAt = new Date();
  await prisma.post.update({
    where: { id },
    data: { deleted_at: deletedAt },
  });

  if (post.author?.email) {
    await sendContentRemovedEmail({
      to: post.author.email,
      userName: post.author.display_name || post.author.email,
      contentType: 'post',
      contentTitle: post.title || undefined,
      removalReason: 'Removed by VarsityHub moderation.',
    }).catch(() => {});
  }

  await logAdminActivityFromReq(req, 'Delete Post', 'post', id, `Removed post ${id}`);
  return res.json({ ok: true, id, deleted_at: deletedAt.toISOString() });
});

adminRouter.delete('/messages/:id', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) return res.status(404).json({ error: 'Message not found' });

  await prisma.notification.deleteMany({ where: { message_id: id } });
  await prisma.message.delete({ where: { id } });
  await logAdminActivityFromReq(req, 'Delete Message', 'message', id, `Removed message ${id}`);
  return res.json({ ok: true, id });
});

adminRouter.delete('/events/:id', requireVerified as any, requireAdminMiddleware as any, async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ error: 'Event not found' });

  await prisma.event.delete({ where: { id } });
  await logAdminActivityFromReq(req, 'Delete Event', 'event', id, `Removed event ${event.title}`);
  return res.json({ ok: true, id });
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
