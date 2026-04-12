import { Router } from 'express';
import { z } from 'zod';
import { validateContent } from '../lib/contentFilter.js';
import { createInAppNotification, notifyNewMessage } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { messageLimiter } from '../middleware/rateLimiters.js';

export const messagesRouter = Router();
messagesRouter.use(requireAuth as any);

// Lightweight unread message count — used by the tab bar badge
messagesRouter.get('/unread-count', async (req: AuthedRequest, res) => {
  try {
    const meId = req.user?.id;
    if (!meId) return res.status(401).json({ error: 'Unauthorized' });
    const count = await prisma.message.count({
      where: { recipient_id: meId, read: false },
    });
    return res.json({ count });
  } catch (e: any) {
    console.error('[messages/unread-count]', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

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

async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.blockedUser.findMany({
    where: {
      OR: [
        { blocker_id: userId },
        { blocked_id: userId },
      ],
    },
    select: { blocker_id: true, blocked_id: true },
  });

  return new Set(
    blocks
      .map((block) => (block.blocker_id === userId ? block.blocked_id : block.blocker_id))
      .filter(Boolean)
  );
}

async function hasAcceptedFollow(followerId: string, followingId: string): Promise<boolean> {
  const follow = await prisma.follows.findUnique({
    where: {
      follower_id_following_id: {
        follower_id: followerId,
        following_id: followingId,
      },
    },
    select: { status: true },
  });

  return follow?.status === 'accepted';
}

function normalizeDmPolicy(raw: unknown): 'everyone' | 'following' | 'no_one' {
  if (raw === 'following' || raw === 'no_one') return raw;
  return 'everyone';
}

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

messagesRouter.get('/', async (req: AuthedRequest, res) => {
const orderBy = parseSort((req.query as any).sort);
const limit = Math.min(parseInt(String((req.query as any).limit ?? '50'), 10) || 50, 200);
const conversation_id = (req.query as any).conversation_id ? String((req.query as any).conversation_id) : undefined;
const withParam = (req.query as any).with ? String((req.query as any).with) : undefined;
const all = String((req.query as any).all || '') === '1';

if (all) {
return res.status(403).json({
error: 'MESSAGE_AUDIT_SCOPE_REQUIRED',
message: 'Platform-wide private message browsing is disabled. Review messages through report-scoped moderation flows only.',
});
}

const meId = req.user!.id;
const blockedUserIds = await getBlockedUserIds(meId);

if (conversation_id) {
const accessCheck = await prisma.message.findFirst({
where: {
conversation_id,
OR: [
{ sender_id: meId },
{ recipient_id: meId },
],
},
select: { id: true },
});
if (!accessCheck) {
return res.status(403).json({ error: 'Forbidden' });
}
const messages = await prisma.message.findMany({
where: {
conversation_id,
OR: [
{ sender_id: meId },
{ recipient_id: meId },
],
},
orderBy,
take: limit,
include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
});
return res.json(messages.filter((message) => !blockedUserIds.has(message.sender_id) && !blockedUserIds.has(message.recipient_id)));
}

const otherUserId = await resolveWithToUserId(withParam);

if (otherUserId) {
if (blockedUserIds.has(otherUserId)) {
return res.status(403).json({ error: 'MESSAGE_BLOCKED', message: 'Messaging is disabled between these users.' });
}
const messages = await prisma.message.findMany({
where: { OR: [ { sender_id: meId, recipient_id: otherUserId }, { sender_id: otherUserId, recipient_id: meId }, ], },
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
return res.json(messages.filter((message) => !blockedUserIds.has(message.sender_id) && !blockedUserIds.has(message.recipient_id)));
});

const sendSchema = z.object({
content: z.string().min(1).max(4000),
conversation_id: z.string().min(1).optional(),
recipient_id: z.string().min(1).optional(),
recipient_email: z.string().email().optional(),
});

messagesRouter.post('/', messageLimiter, async (req: AuthedRequest, res) => {
const parsed = sendSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
const { content, conversation_id, recipient_id, recipient_email } = parsed.data;

if (!conversation_id && !recipient_id && !recipient_email) {
return res.status(400).json({ error: 'Provide conversation_id or recipient_id/email' });
}

const filterResult = validateContent({ content });
if (!filterResult.valid) {
  return res.status(400).json({ error: filterResult.error, code: filterResult.code });
}

const meId = req.user!.id;
let toId = recipient_id;

if (!toId && recipient_email) {
const u = await prisma.user.findUnique({ where: { email: recipient_email } });
if (!u) return res.status(404).json({ error: 'Recipient not found' });
toId = u.id;
}

let convId = conversation_id;
if (!convId && toId) {
const pair = [meId, toId].sort();
convId = `dm:${pair[0]}__${pair[1]}`;
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
return res.status(403).json({ error: 'MESSAGE_BLOCKED', message: 'Messaging is disabled between these users.' });
}

// AGE POLICY: Fetch both users' DOB for age checks
const [me, recipient] = await Promise.all([
  prisma.user.findUnique({ where: { id: meId }, select: { preferences: true } }),
  prisma.user.findUnique({ where: { id: toId! }, select: { preferences: true } }),
]);
const recipientDmPolicy = normalizeDmPolicy((recipient?.preferences as any)?.dm_policy);
const senderAge = ageFromDob((me?.preferences as any)?.dob);
const recipientAge = ageFromDob((recipient?.preferences as any)?.dob);

if (recipientDmPolicy === 'no_one') {
  return res.status(403).json({
    error: 'DM_POLICY_BLOCKED',
    message: 'This user is not accepting direct messages right now.',
  });
}

if (recipientDmPolicy === 'following') {
  const senderFollowsRecipient = await hasAcceptedFollow(meId, toId!);
  if (!senderFollowsRecipient) {
    return res.status(403).json({
      error: 'DM_POLICY_BLOCKED',
      message: 'You can only message people you follow.',
    });
  }
}

// Minor (under 18) may only message accounts they follow
if (senderAge !== null && senderAge < 18) {
  const follows = await hasAcceptedFollow(meId, toId!);
  if (!follows) {
    return res.status(403).json({
      error: 'AGE_POLICY_BLOCKED',
      message: 'Users under 18 can only message accounts they follow.'
    });
  }
}

// Adult (18+) messaging minor (under 18): adult must follow the minor
if (senderAge !== null && senderAge >= 18 && recipientAge !== null && recipientAge < 18) {
  const adultFollowsMinor = await hasAcceptedFollow(meId, toId!);
  if (!adultFollowsMinor) {
    return res.status(403).json({
      error: 'AGE_POLICY_BLOCKED',
      message: 'You must follow this user to send them a message.'
    });
  }
}

const created = await prisma.message.create({
data: {
conversation_id: convId!,
sender_id: meId,
recipient_id: toId!,
content
},
include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
});

// Create in-app notification and send push notification to recipient
// Only notify if recipient is different from sender (prevent self-notifications)
if (toId !== meId) {
  try {
    await createInAppNotification({
      userId: toId!,
      actorId: meId,
      type: 'MESSAGE',
      messageId: created.id,
      meta: {
        conversation_id: convId!,
        message_id: created.id,
        preview: content.substring(0, 100),
      },
    });
    
    // Send push notification
    await notifyNewMessage(
      toId!,
      meId,
      created.sender?.display_name || 'Someone',
      content
    );
  } catch (e) {
    console.error('Failed to send message notification:', e);
  }
}

return res.status(201).json(created);
});

messagesRouter.post('/mark-read', async (req: AuthedRequest, res) => {
  const { conversation_id, with: withParam } = req.body || {};
  const meId = req.user!.id;
  
  try {
    let updateCount = 0;
    
    if (conversation_id) {
      // Mark all messages in this conversation as read where I'm the recipient
      const result = await prisma.message.updateMany({
        where: {
          conversation_id: String(conversation_id),
          recipient_id: meId,
          read: false
        },
        data: { read: true }
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
            read: false
          },
          data: { read: true }
        });
        updateCount = result.count;
      }
    }
    
    return res.json({ updated: updateCount });
  } catch (e) {
    console.error('Failed to mark messages as read:', e);
    return res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});
