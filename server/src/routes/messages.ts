import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import { notifyNewMessage } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { messageLimiter } from '../middleware/rateLimiters.js';
import { registerIdValidation } from '../middleware/validateParams.js';
import { sendError } from '../lib/http/sendError.js';

export const messagesRouter = Router();
registerIdValidation(messagesRouter);

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob || typeof dob !== 'string') return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

const baseUserSelect = { id: true, display_name: true, avatar_url: true, username: true };

function parseSort(q: unknown) {
  const s = String(q ?? '').trim();
  if (s === '-created_at' || s === '-created_date') return { created_at: 'desc' as const };
  if (s === 'created_at' || s === 'created_date') return { created_at: 'asc' as const };
  return { created_at: 'desc' as const };
}

async function resolveWithToUserId(withParam?: string) {
  if (!withParam) return undefined;
  if (!withParam.includes('@')) {
    const u = await prisma.user.findUnique({ where: { id: withParam } });
    if (u) return u.id;
  }
  const u = await prisma.user.findUnique({ where: { email: withParam } });
  return u?.id;
}

messagesRouter.get(
  '/unread-count',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const count = await prisma.message.count({
      where: { recipient_id: req.user.id, read: false },
    });
    return res.json({ count });
  })
);

messagesRouter.get(
  '/',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const orderBy = parseSort((req.query as any).sort);
    const limit = Math.max(
      1,
      Math.min(parseInt(String((req.query as any).limit ?? '50'), 10) || 50, 50)
    );
    const conversation_id = (req.query as any).conversation_id
      ? String((req.query as any).conversation_id)
      : undefined;
    const withParam = (req.query as any).with ? String((req.query as any).with) : undefined;
    const all = String((req.query as any).all || '') === '1';

    if (all) {
      const isAdmin = await getIsAdmin(req);
      if (!isAdmin) return sendError(res, 403, 'Admin only');
      const msgs = await prisma.message.findMany({
        orderBy,
        take: limit,
        include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
      });
      return res.json(msgs);
    }

    const meId = req.user.id;

    if (conversation_id) {
      const accessCheck = await prisma.message.findFirst({
        where: {
          conversation_id,
          OR: [{ sender_id: meId }, { recipient_id: meId }],
        },
        select: { id: true },
      });
      if (!accessCheck) {
        return sendError(res, 403, 'Forbidden');
      }
      const messages = await prisma.message.findMany({
        where: {
          conversation_id,
          OR: [{ sender_id: meId }, { recipient_id: meId }],
        },
        orderBy,
        take: limit,
        include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
      });
      return res.json(messages);
    }

    const otherUserId = await resolveWithToUserId(withParam);

    if (otherUserId) {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { sender_id: meId, recipient_id: otherUserId },
            { sender_id: otherUserId, recipient_id: meId },
          ],
        },
        orderBy,
        take: limit,
        include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
      });
      return res.json(messages);
    }

    const messages = await prisma.message.findMany({
      where: { OR: [{ sender_id: meId }, { recipient_id: meId }] },
      orderBy,
      take: limit,
      include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
    });
    return res.json(messages);
  })
);

const sendSchema = z.object({
  content: z.string().min(1).max(5000),
  conversation_id: z.string().min(1).optional(),
  recipient_id: z.string().min(1).optional(),
  recipient_email: z.string().email().optional(),
});

messagesRouter.post(
  '/',
  requireAuth as any,
  messageLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, 'Invalid payload', { details: { issues: parsed.error.issues } });
    const { content, conversation_id, recipient_id, recipient_email } = parsed.data;

    if (!conversation_id && !recipient_id && !recipient_email) {
      return sendError(res, 400, 'Provide conversation_id or recipient_id/email');
    }

    const filterResult = validateContent({ content });
    if (!filterResult.valid) {
      return sendError(res, 400, filterResult.error, { code: filterResult.code });
    }

    const meId = req.user.id;
    let toId = recipient_id;

    if (!toId && recipient_email) {
      const u = await prisma.user.findUnique({ where: { email: recipient_email } });
      if (!u) return sendError(res, 404, 'Recipient not found');
      toId = u.id;
    }

    // If we have conversation_id but no recipient, resolve recipient from conversation
    if (!toId && conversation_id) {
      // DM conversation IDs follow pattern dm:<id1>__<id2> (sorted)
      const dmMatch = conversation_id.match(/^dm:(.+)__(.+)$/);
      if (dmMatch) {
        const [, id1, id2] = dmMatch;
        // Verify sender is actually a participant in this conversation
        if (id1 !== meId && id2 !== meId) {
          return sendError(res, 403, 'You are not a participant in this conversation');
        }
        toId = id1 === meId ? id2 : id1;
      } else {
        // Fallback: look up the other participant from existing messages — verify sender is a participant
        const existing = await prisma.message.findFirst({
          where: {
            conversation_id,
            OR: [{ sender_id: meId }, { recipient_id: meId }],
          },
          select: { sender_id: true, recipient_id: true },
        });
        if (existing) {
          toId =
            (existing.sender_id === meId ? existing.recipient_id : existing.sender_id) ?? undefined;
        }
      }
      if (!toId) {
        return sendError(res, 400, 'Could not determine recipient from conversation');
      }
    }

    let convId = conversation_id;
    if (!convId && toId) {
      const pair = [meId, toId].sort();
      convId = `dm:${pair[0]}__${pair[1]}`;
    }

    if (!toId) {
      return sendError(res, 400, 'Could not determine recipient');
    }

    // Prevent messaging if either user has blocked the other
    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blocker_id: meId, blocked_id: toId! },
          { blocker_id: toId!, blocked_id: meId },
        ],
      },
    });
    if (block) {
      return sendError(res, 403, 'Messaging is disabled between these users.', {
        code: 'MESSAGE_BLOCKED',
      });
    }

    // v1.0.2 audit fix: block banned users from sending DMs.
    const sender = await prisma.user.findUnique({
      where: { id: meId },
      select: { banned: true, banned_until: true },
    });
    const nowTs = new Date();
    if (sender?.banned || (sender?.banned_until && sender.banned_until > nowTs)) {
      return sendError(res, 403, 'Your account is suspended from messaging.', {
        code: 'USER_BANNED',
      });
    }

    // AGE POLICY: Fetch both users' DOB for age checks
    const [me, recipient] = await Promise.all([
      prisma.user.findUnique({ where: { id: meId }, select: { preferences: true } }),
      prisma.user.findUnique({ where: { id: toId! }, select: { preferences: true } }),
    ]);

    if (!recipient) {
      return sendError(res, 404, 'Recipient not found');
    }

    // Prevent messaging organization accounts
    const recipientPrefs = (recipient.preferences || {}) as any;
    if (recipientPrefs.account_type === 'organization') {
      return sendError(res, 403, 'Organization accounts cannot receive direct messages.', {
        code: 'ORG_ACCOUNT',
      });
    }

    // Enforce recipient's DM policy
    const dmPolicy = recipientPrefs.dm_policy || 'everyone';
    if (dmPolicy === 'no_one') {
      return sendError(res, 403, 'This user does not accept direct messages.', {
        code: 'DM_RESTRICTED',
      });
    }
    if (dmPolicy === 'following') {
      // Recipient only accepts DMs from people they follow (must be accepted, not pending)
      const recipientFollowsSender = await prisma.follows.findFirst({
        where: { follower_id: toId!, following_id: meId, status: 'accepted' },
      });
      if (!recipientFollowsSender) {
        return sendError(res, 403, 'This user only accepts messages from people they follow.', {
          code: 'DM_RESTRICTED',
        });
      }
    }

    const senderAge = ageFromDob((me?.preferences as any)?.dob);
    const recipientAge = ageFromDob(recipientPrefs?.dob);

    // Minor (under 18) may only message accounts they follow
    if (senderAge !== null && senderAge < 18) {
      const follows = await prisma.follows.findFirst({
        where: { follower_id: meId, following_id: toId!, status: 'accepted' },
      });
      if (!follows) {
        return sendError(res, 403, 'Users under 18 can only message accounts they follow.', {
          code: 'AGE_POLICY_BLOCKED',
        });
      }
    }

    // Adult (18+) messaging minor (under 18): adult must follow the minor
    if (senderAge !== null && senderAge >= 18 && recipientAge !== null && recipientAge < 18) {
      const adultFollowsMinor = await prisma.follows.findUnique({
        where: { follower_id_following_id: { follower_id: meId, following_id: toId! } },
      });
      if (!adultFollowsMinor) {
        return sendError(res, 403, 'You must follow this user to send them a message.', {
          code: 'AGE_POLICY_BLOCKED',
        });
      }
    }

    const created = await prisma.message.create({
      data: {
        conversation_id: convId!,
        sender_id: meId,
        recipient_id: toId!,
        content,
      },
      include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
    });

    // Create in-app notification and send push notification to recipient
    // Only notify if recipient is different from sender (prevent self-notifications)
    if (toId !== meId) {
      try {
        // Create in-app notification record with proper message_id foreign key
        await prisma.notification.create({
          data: {
            user_id: toId!,
            actor_id: meId,
            type: 'MESSAGE',
            message_id: created.id,
            meta: {
              conversation_id: convId!,
              preview: content.substring(0, 100),
            },
          },
        });

        // Send push notification
        await notifyNewMessage(
          toId!,
          meId,
          created.sender?.display_name || 'Someone',
          content,
          convId!
        );
      } catch (e) {
        console.error('Failed to send message notification:', e);
      }
    }

    return res.status(201).json(created);
  })
);

messagesRouter.post(
  '/mark-read',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');

    const markReadSchema = z.object({
      conversation_id: z.string().min(1).optional(),
      with: z.string().min(1).optional(),
    });
    const parsed = markReadSchema.safeParse(req.body);
    if (!parsed.success)
      return sendError(res, 400, 'Invalid payload', { details: { issues: parsed.error.issues } });
    const { conversation_id, with: withParam } = parsed.data;
    const meId = req.user.id;

    let updateCount = 0;

    if (conversation_id) {
      // Mark all messages in this conversation as read where I'm the recipient
      const result = await prisma.message.updateMany({
        where: {
          conversation_id: String(conversation_id),
          recipient_id: meId,
          read: false,
        },
        data: { read: true },
      });
      updateCount = result.count;
    } else if (withParam) {
      // Mark all messages from this user as read
      const otherUserId = await resolveWithToUserId(String(withParam));
      if (otherUserId) {
        const result = await prisma.message.updateMany({
          where: {
            sender_id: otherUserId,
            recipient_id: meId,
            read: false,
          },
          data: { read: true },
        });
        updateCount = result.count;
      }
    }

    return res.json({ updated: updateCount });
  })
);
