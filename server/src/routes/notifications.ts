import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendError } from '../lib/http/sendError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const notificationsRouter = Router();
registerIdValidation(notificationsRouter);

const NOTIFICATIONS_QUERY_TIMEOUT_MS = 25000;

const encodeNotificationCursor = (row: { created_at: Date | string; id: string }) => {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();
  return `${createdAt}::${row.id}`;
};

const parseNotificationCursor = (cursor: string): { createdAt: Date; id: string } | null => {
  const [createdAtRaw, id] = cursor.split('::');
  if (!createdAtRaw || !id) return null;
  const createdAt = new Date(createdAtRaw);
  if (Number.isNaN(createdAt.getTime())) return null;
  return { createdAt, id };
};

const toSqlTimestamp = (value: Date) => value.toISOString().replace('T', ' ').replace('Z', '');

const withQueryTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs = NOTIFICATIONS_QUERY_TIMEOUT_MS
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutHandle!)
  ) as Promise<T>;
};

const summarize = (n: any) => {
  switch (n.type) {
    case 'FOLLOW':
      return 'followed you';
    case 'FOLLOW_REQUEST':
      return 'requested to follow you';
    case 'UPVOTE':
      return 'upvoted your post';
    case 'COMMENT':
      return 'commented on your post';
    case 'MESSAGE':
      return 'sent you a message';
    case 'TEAM_INVITE':
      return 'invited you to a team';
    case 'MENTION':
      return 'mentioned you';
    case 'COMMENT_REPLY':
      return 'replied to your comment';
    case 'SHARE':
      return 'shared your post';
    case 'GAME_REMINDER':
      return 'game reminder';
    case 'AD_APPROVED':
      return 'your ad has been approved';
    case 'AD_REJECTED':
      return 'your ad needs changes';
    case 'ORG_APPROVED':
      return 'your organization has been approved';
    case 'ORG_REJECTED':
      return 'your organization was not approved';
    case 'JOIN_REQUEST_APPROVED':
      return 'your join request was approved';
    case 'JOIN_REQUEST_DENIED':
      return 'your join request was not approved';
    case 'TEAM_INVITE_ACCEPTED':
      return 'accepted your team invite';
    case 'TEAM_INVITE_DECLINED':
      return 'declined your team invite';
    case 'TEAM_MEMBER_REMOVED':
      return 'you were removed from a team';
    case 'TEAM_ROLE_CHANGED':
      return 'your team role was changed';
    case 'TEAM_FOLLOWED':
      return 'followed your team';
    case 'GAME_CANCELLED':
      return 'a game has been cancelled';
    case 'GAME_STORY_ADDED':
      return 'added a story to a game';
    case 'EVENT_APPROVED':
      return 'your event has been approved';
    case 'EVENT_REJECTED':
      return 'your event was not approved';
    case 'COACH_REJECTED':
      return 'your coach application was not approved';
    default:
      return 'did something';
  }
};

// GET /notifications?cursor=...&limit=...&unread=1
notificationsRouter.get(
  '/',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const limit = Math.max(1, Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50));
      const cursorRaw = typeof req.query.cursor === 'string' ? req.query.cursor : null;
      const unreadOnly = String((req.query as any).unread || '') === '1';

      let cursor: { createdAt: Date; id: string } | null = null;
      if (cursorRaw) {
        cursor = parseNotificationCursor(cursorRaw);
        if (!cursor) {
          return sendError(res, 400, 'INVALID_CURSOR', {
            message: 'Notification cursor is invalid.',
          });
        }
      }

      const pageSize = limit + 1;
      const cursorTimestamp = cursor ? toSqlTimestamp(cursor.createdAt) : null;
      const cursorClause = cursor
        ? Prisma.sql`AND ROW("created_at", "id") < ROW(CAST(${cursorTimestamp} AS timestamp), ${cursor.id})`
        : Prisma.empty;
      const unreadClause = unreadOnly ? Prisma.sql`AND "read_at" IS NULL` : Prisma.empty;

      const pageRows = await withQueryTimeout(
        prisma.$queryRaw<Array<{ id: string; created_at: Date }>>(Prisma.sql`
          SELECT "id", "created_at"
          FROM "Notification"
          WHERE "user_id" = ${userId}
          ${unreadClause}
          ${cursorClause}
          ORDER BY "created_at" DESC, "id" DESC
          LIMIT ${pageSize}
        `)
      );

      const items = pageRows.slice(0, limit);
      const notificationIds = items.map(row => row.id);
      const nextCursor =
        pageRows.length > limit && items.length > 0
          ? encodeNotificationCursor(items[items.length - 1])
          : null;

      if (notificationIds.length === 0) {
        return res.json({ items: [], nextCursor: null });
      }

      const rows = await withQueryTimeout(
        // audit-allow unbounded -- bounded by notificationIds derived from the paginated page slice above
        prisma.notification.findMany({
          where: { id: { in: notificationIds } },
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
                avatar_url: true,
              },
            },
            post: {
              select: {
                id: true,
                content: true,
                media_url: true,
                upvotes_count: true,
                created_at: true,
                author_id: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
                post_id: true,
                created_at: true,
              },
            },
          },
        })
      );
      const rowsById = new Map(rows.map((row: any) => [row.id, row]));
      const orderedRows = notificationIds
        .map(id => rowsById.get(id))
        .filter((row): row is NonNullable<typeof row> => Boolean(row));

      const payload = orderedRows.map((n: any) => {
        const meta = (n.meta as any) || {};
        // Extract message_id from meta if it exists (stored there temporarily until migration)
        const messageId = meta.message_id;
        return {
          id: n.id,
          type: n.type,
          created_at: n.created_at,
          read_at: n.read_at,
          actor: n.actor
            ? {
                id: n.actor.id,
                username: n.actor.username,
                display_name: n.actor.display_name,
                avatar_url: n.actor.avatar_url,
              }
            : null,
          post: n.post
            ? { id: n.post.id, content: n.post.content, media_url: n.post.media_url }
            : null,
          comment: n.comment
            ? { id: n.comment.id, content: n.comment.content, post_id: n.comment.post_id }
            : null,
          // message_id column doesn't exist in database yet, but we can extract from meta
          message:
            messageId || meta.conversation_id
              ? { id: messageId, conversation_id: meta.conversation_id }
              : null,
          event: meta.event_id ? { id: meta.event_id, title: meta.event_title } : null,
          meta: { ...meta, summary: summarize(n) },
        };
      });

      return res.json({ items: payload, nextCursor });
    } catch (error: any) {
      console.error('[notifications] Error fetching notifications:', error);
      if (error.message === 'Query timeout') {
        return sendError(res, 504, 'REQUEST_TIMEOUT', {
          message: 'Notifications query took too long. Please try again.',
        });
      }
      return sendError(res, 500, 'NOTIFICATIONS_FETCH_FAILED', {
        message: 'Failed to fetch notifications',
      });
    }
  })
);

// GET /notifications/unread-count
notificationsRouter.get(
  '/unread-count',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
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
  })
);

// POST /notifications/mark-read-all  (must be before /:id/read to avoid Express treating "mark-read-all" as an :id)
notificationsRouter.post(
  '/mark-read-all',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      await prisma.notification.updateMany({
        where: { user_id: userId, read_at: null },
        data: { read_at: new Date() },
      });
      return res.json({ ok: true });
    } catch (error: any) {
      console.error('[notifications] Error marking all notifications as read:', error);
      return sendError(res, 500, 'NOTIFICATIONS_MARK_ALL_READ_FAILED', {
        message: 'Failed to mark all notifications as read',
      });
    }
  })
);

// POST /notifications/:id/read
notificationsRouter.post(
  '/:id/read',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    try {
      const userId = req.user!.id;
      const id = String(req.params.id);
      const result = await prisma.notification.updateMany({
        where: { id, user_id: userId },
        data: { read_at: new Date() },
      });
      if (result.count === 0) {
        return sendError(res, 404, 'NOT_FOUND', {
          message: 'Notification not found',
        });
      }
      return res.json({ ok: true, id });
    } catch (error: any) {
      console.error('[notifications] Error marking notification as read:', error);
      return sendError(res, 500, 'NOTIFICATIONS_MARK_READ_FAILED', {
        message: 'Failed to mark notification as read',
      });
    }
  })
);
