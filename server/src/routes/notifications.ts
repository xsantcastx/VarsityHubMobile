import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const notificationsRouter = Router();
registerIdValidation(notificationsRouter);

const summarize = (n: any) => {
  const meta = (n?.meta as any) || {};
  switch (n.type) {
    case 'FOLLOW': return 'followed you';
    case 'FOLLOW_REQUEST': return 'requested to follow you';
    case 'UPVOTE': return 'upvoted your post';
    case 'COMMENT': return 'commented on your post';
    case 'MESSAGE': return 'sent you a message';
    case 'TEAM_INVITE':
      if (meta.coach_request) return 'requested coach approval';
      if (meta.coach_approved) return 'your coach application was approved';
      if (meta.coach_denied) return 'your coach application was declined';
      return 'invited you to a team';
    case 'MENTION': return 'mentioned you';
    case 'COMMENT_REPLY': return 'replied to your comment';
    case 'SHARE': return 'shared your post';
    case 'GAME_REMINDER': return 'game reminder';
    case 'AD_APPROVED': return 'your ad has been approved';
    case 'AD_REJECTED': return 'your ad needs changes';
    case 'ORG_APPROVED': return 'your organization has been approved';
    case 'JOIN_REQUEST_APPROVED': return 'your join request was approved';
    default: return 'did something';
  }
};

const CURSOR_SEPARATOR = '::';
const encodeCursor = (row: { created_at: Date; id: string }) =>
  `${new Date(row.created_at).toISOString()}${CURSOR_SEPARATOR}${row.id}`;

async function resolveCursor(cursor: string): Promise<{ created_at: Date; id: string } | null> {
  if (!cursor) return null;
  if (cursor.includes(CURSOR_SEPARATOR)) {
    const [iso, id] = cursor.split(CURSOR_SEPARATOR);
    const created_at = new Date(iso);
    if (!id || Number.isNaN(created_at.getTime())) return null;
    return { created_at, id };
  }

  // Backward compatibility for older clients that still send plain ID cursors.
  const row = await prisma.notification.findUnique({
    where: { id: cursor },
    select: { id: true, created_at: true },
  });
  return row ? { id: row.id, created_at: row.created_at } : null;
}

// GET /notifications?cursor=...&limit=...&unread=1
notificationsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
    const unreadOnly = String((req.query as any).unread || '') === '1';

    // Build where clause
    const where: any = { user_id: userId };
    if (unreadOnly) {
      where.read_at = null;
    }

    // Handle cursor pagination
    if (cursor) {
      const resolvedCursor = await resolveCursor(cursor);
      if (resolvedCursor) {
        // Stable pagination for created_at desc, id desc ordering.
        where.OR = [
          { created_at: { lt: resolvedCursor.created_at } },
          {
            AND: [
              { created_at: resolvedCursor.created_at },
              { id: { lt: resolvedCursor.id } },
            ],
          },
        ];
      } else {
        // Graceful fallback for malformed cursors.
        where.id = { lt: cursor };
      }
    }

    // Standard orderBy - always use created_at desc, id desc for consistency
    const orderBy = [{ created_at: 'desc' as const }, { id: 'desc' as const }];

    // Build Prisma query
    const query = {
      where,
      orderBy,
      take: limit + 1,
      select: {
        id: true,
        type: true,
        created_at: true,
        read_at: true,
        meta: true,
        // message_id removed - column doesn't exist in database yet
        actor: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar_url: true
          }
        },
        post: { 
          select: { 
            id: true, 
            content: true, 
            media_url: true, 
            upvotes_count: true, 
            created_at: true, 
            author_id: true 
          } 
        },
        comment: { 
          select: { 
            id: true, 
            content: true, 
            post_id: true, 
            created_at: true 
          } 
        },
      },
    };

    // Execute query with timeout
    const queryPromise = prisma.notification.findMany(query);
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error('Query timeout')), 25000);
    });

    const rows = await Promise.race([queryPromise, timeoutPromise]).finally(() => clearTimeout(timeoutHandle!)) as any[];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastReturned = items.length ? items[items.length - 1] : null;
    const nextCursor = hasMore && lastReturned ? encodeCursor(lastReturned) : null;

    const payload = items.map((n: any) => {
      const meta = (n.meta as any) || {};
      // Extract message_id from meta if it exists (stored there temporarily until migration)
      const messageId = meta.message_id;
      return {
        id: n.id,
        type: n.type,
        created_at: n.created_at,
        read_at: n.read_at,
        actor: n.actor ? { id: n.actor.id, username: n.actor.username, display_name: n.actor.display_name, avatar_url: n.actor.avatar_url } : null,
        post: n.post ? { id: n.post.id, content: n.post.content, media_url: n.post.media_url } : null,
        comment: n.comment ? { id: n.comment.id, content: n.comment.content, post_id: n.comment.post_id } : null,
        // message_id column doesn't exist in database yet, but we can extract from meta
        message: (messageId || meta.conversation_id) ? { id: messageId, conversation_id: meta.conversation_id } : null,
        event: meta.event_id ? { id: meta.event_id, title: meta.event_title } : null,
        meta: { ...meta, summary: summarize(n) },
      };
    });

    return res.json({ items: payload, nextCursor });
  } catch (error: any) {
    console.error('[notifications] Error fetching notifications:', error);
    // Return empty result instead of error to prevent app crashes
    if (error.message === 'Query timeout') {
      return res.status(504).json({ 
        error: 'Request timeout', 
        message: 'Notifications query took too long. Please try again.',
        items: [],
        nextCursor: null 
      });
    }
    // Return graceful error response - don't crash the app
    return res.status(500).json({
      error: 'Failed to fetch notifications',
      items: [],
      nextCursor: null
    });
  }
});

// GET /notifications/unread-count
notificationsRouter.get('/unread-count', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const count = await prisma.notification.count({
      where: { user_id: userId, read_at: null },
    });
    return res.json({ count });
  } catch (error: any) {
    console.error('[notifications] Error counting unread:', error);
    return res.json({ count: 0 });
  }
});

// POST /notifications/mark-read-all  (must be before /:id/read to avoid Express treating "mark-read-all" as an :id)
notificationsRouter.post('/mark-read-all', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    await prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() }
    });
    return res.json({ ok: true });
  } catch (error: any) {
    console.error('[notifications] Error marking all notifications as read:', error);
    return res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// POST /notifications/:id/read
notificationsRouter.post('/:id/read', requireAuth as any, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const id = String(req.params.id);
    const result = await prisma.notification.updateMany({
      where: { id, user_id: userId },
      data: { read_at: new Date() }
    });
    if (result.count === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true, id });
  } catch (error: any) {
    console.error('[notifications] Error marking notification as read:', error);
    return res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});
