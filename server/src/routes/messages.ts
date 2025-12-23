import { Router } from 'express';
import { z } from 'zod';
import { notifyNewMessage } from '../lib/notifications.js';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { getIsAdmin } from '../middleware/requireAdmin.js';
import { buildConversationId } from '../lib/messageHelpers.js';

export const messagesRouter = Router();

const baseUserSelect = { id: true, email: true, display_name: true, avatar_url: true };

// Rate limiting for message sends: 30 per 5 minutes per user
const MESSAGE_RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MESSAGE_RATE_LIMIT = 30;
const userMessageBuckets = new Map<string, number[]>();

function checkMessageRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - MESSAGE_RATE_WINDOW_MS;
  
  const bucket = userMessageBuckets.get(userId) || [];
  const pruned = bucket.filter(ts => ts >= windowStart);
  
  if (pruned.length >= MESSAGE_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  pruned.push(now);
  userMessageBuckets.set(userId, pruned);
  
  return { allowed: true, remaining: MESSAGE_RATE_LIMIT - pruned.length };
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
if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
const orderBy = parseSort((req.query as any).sort);
const limit = Math.min(parseInt(String((req.query as any).limit ?? '50'), 10) || 50, 200);
const conversation_id = (req.query as any).conversation_id ? String((req.query as any).conversation_id) : undefined;
const withParam = (req.query as any).with ? String((req.query as any).with) : undefined;
const all = String((req.query as any).all || '') === '1';

if (all) {
const isAdmin = await getIsAdmin(req);
if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
const msgs = await prisma.message.findMany({ orderBy, take: limit, include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } }, });
return res.json(msgs);
}

const meId = req.user.id;

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
return res.json(messages);
}

const otherUserId = await resolveWithToUserId(withParam);

if (otherUserId) {
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
return res.json(messages);
});

const sendSchema = z.object({
content: z.string().min(1),
conversation_id: z.string().min(1).optional(),
recipient_id: z.string().min(1).optional(),
recipient_email: z.string().email().optional(),
});

messagesRouter.post('/', async (req: AuthedRequest, res) => {
if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

// Rate limiting check
const rateCheck = checkMessageRateLimit(req.user.id);
if (!rateCheck.allowed) {
  return res.status(429).json({ 
    error: 'RATE_LIMIT_EXCEEDED', 
    message: `Message rate limit exceeded. Try again in a few minutes.`,
    retry_after: Math.ceil(MESSAGE_RATE_WINDOW_MS / 1000)
  });
}

const parsed = sendSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
const { content, conversation_id, recipient_id, recipient_email } = parsed.data;

if (!conversation_id && !recipient_id && !recipient_email) {
return res.status(400).json({ error: 'Provide conversation_id or recipient_id/email' });
}

const meId = req.user.id;
let toId = recipient_id;

if (!toId && recipient_email) {
const u = await prisma.user.findUnique({ where: { email: recipient_email } });
if (!u) return res.status(404).json({ error: 'Recipient not found' });
toId = u.id;
}

let convId = conversation_id;
if (!convId && toId) {
convId = buildConversationId(meId, toId);
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

 // AGE POLICY: Under-18 users may only message accounts they follow
 try {
   const me = await prisma.user.findUnique({ where: { id: meId }, select: { preferences: true } });
   const recipient = await prisma.user.findUnique({ where: { id: toId! }, select: { preferences: true } });
   const senderDob = (me?.preferences as any)?.dob;
   if (senderDob) {
     const age = (() => {
       const d = new Date(String(senderDob));
       const now = new Date();
       let a = now.getFullYear() - d.getFullYear();
       const m = now.getMonth() - d.getMonth();
       if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
       return a;
     })();
     if (age < 18) {
       // Check follow relationship (minor must follow recipient)
       const follows = await prisma.follows.findUnique({
         where: { follower_id_following_id: { follower_id: meId, following_id: toId! } }
       });
       if (!follows) {
         return res.status(403).json({
           error: 'AGE_POLICY_BLOCKED',
           message: 'Users under 18 can only message accounts they follow.'
         });
       }
     }
   }
 } catch (e) {
   console.warn('[messages][age-policy] check failed', e);
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

// Send push notification to recipient
try {
  await notifyNewMessage(
    toId!,
    meId,
    created.sender?.display_name || 'Someone',
    content
  );
} catch (e) {
  console.error('Failed to send message notification:', e);
}

return res.status(201).json(created);
});

messagesRouter.post('/mark-read', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  const { conversation_id, with: withParam } = req.body || {};
  const meId = req.user.id;
  
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
