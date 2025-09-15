import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { getIsAdmin } from '../middleware/requireAdmin.js';

export const messagesRouter = Router();

function parseSort(q: unknown) {
  const s = String(q ?? '').trim();
  // accept old and new names; always map to created_at
  if (s === '-created_at' || s === '-created_date') return { created_at: 'desc' as const };
  if (s === 'created_at' || s === 'created_date') return { created_at: 'asc' as const };
  return { created_at: 'desc' as const };
}

// Resolve a `with` query param that could be a user id or an email.
// Returns user id or undefined.
async function resolveWithToUserId(withParam?: string) {
  if (!withParam) return undefined;
  // If it already looks like a cuid/uuid-ish id, try it directly
  if (!withParam.includes('@')) {
    const u = await prisma.user.findUnique({ where: { id: withParam } });
    if (u) return u.id;
  }
  // Otherwise treat as email
  const u = await prisma.user.findUnique({ where: { email: withParam } });
  return u?.id;
}

const baseUserSelect = { id: true, email: true, display_name: true, avatar_url: true };

messagesRouter.get('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const orderBy = parseSort((req.query as any).sort);
  const limit = Math.min(parseInt(String((req.query as any).limit ?? '50'), 10) || 50, 200);
  const conversation_id = (req.query as any).conversation_id
    ? String((req.query as any).conversation_id)
    : undefined;
  const withParam = (req.query as any).with ? String((req.query as any).with) : undefined;
  const all = String((req.query as any).all || '') === '1';

  if (all) {
    const isAdmin = await getIsAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const msgs = await prisma.message.findMany({
      orderBy,
      take: limit,
      include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
    });
    return res.json(msgs);
  }

  const meId = req.user.id;

  if (conversation_id) {
    const messages = await prisma.message.findMany({
      where: { conversation_id },
      orderBy,
      take: limit,
      include: { sender: { select: baseUserSelect }, recipient: { select: baseUserSelect } },
    });
    return res.json(messages);
  }

  // with = user id (preferred) or email (back-compat)
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

  // Default: list my messages only
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
  // prefer user id; still accept email as back-compat (we’ll resolve below)
  recipient_id: z.string().min(1).optional(),
  recipient_email: z.string().email().optional(),
});

messagesRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  }
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
  // If still missing (shouldn’t happen), fail
  if (!toId && !conversation_id) {
    return res.status(400).json({ error: 'Recipient not resolved' });
  }

  let convId = conversation_id;
  if (!convId && toId) {
    // Deterministic DM id by user ids
    const pair = [meId, toId].sort();
    convId = `dm:${pair[0]}__${pair[1]}`;
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
  return res.status(201).json(created);
});

// Mark messages as read — schema no longer has a `read` field.
// Implement a MessageRead model later if you need per-user read state.
// For now, respond 200 with updated: 0 so the client doesn’t break.
messagesRouter.post('/mark-read', async (_req: AuthedRequest, res) => {
  return res.json({ updated: 0 });
});
