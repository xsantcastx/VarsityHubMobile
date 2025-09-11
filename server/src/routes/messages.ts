import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { getIsAdmin } from '../middleware/requireAdmin.js';

export const messagesRouter = Router();

messagesRouter.get('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const sort = String(req.query.sort || '').trim();
  const limit = Math.min(parseInt(String((req.query as any).limit || '50'), 10) || 50, 200);
  const conversation_id = (req.query as any).conversation_id ? String((req.query as any).conversation_id) : undefined;
  const withEmail = (req.query as any).with ? String((req.query as any).with) : undefined;
  const all = String((req.query as any).all || '') === '1';
  const orderBy = sort === '-created_date' ? { created_date: 'desc' as const } : { created_date: 'desc' as const };
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  const myEmail = me?.email || '';

  if (all) {
    const isAdmin = await getIsAdmin(req);
    if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
    const msgs = await prisma.message.findMany({ orderBy, take: limit });
    return res.json(msgs);
  }

  if (conversation_id) {
    const messages = await prisma.message.findMany({ where: { conversation_id }, orderBy, take: limit });
    return res.json(messages);
  }

  if (withEmail) {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const me = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!me?.email) return res.status(400).json({ error: 'User email not found' });
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { sender_email: myEmail, recipient_email: withEmail },
          { sender_email: withEmail, recipient_email: myEmail },
        ],
      },
      orderBy,
      take: limit,
    });
    return res.json(messages);
  }

  // Default: list my messages only
  const messages = await prisma.message.findMany({
    where: { OR: [{ sender_email: myEmail }, { recipient_email: myEmail }] },
    orderBy,
    take: limit,
  });
  return res.json(messages);
});

const sendSchema = z.object({
  content: z.string().min(1),
  conversation_id: z.string().min(1).optional(),
  recipient_email: z.string().email().optional(),
});

messagesRouter.post('/', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
  const { content, conversation_id, recipient_email } = parsed.data;
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me?.email) return res.status(400).json({ error: 'User email not found' });

  if (!conversation_id && !recipient_email) {
    return res.status(400).json({ error: 'Provide conversation_id or recipient_email' });
  }

  let convId = conversation_id;
  let to = recipient_email || null;
  if (!convId && recipient_email) {
    // Deterministic DM conversation id from two emails
    const a = [me.email, recipient_email].sort();
    convId = `dm:${a[0]}__${a[1]}`;
  }

  const created = await prisma.message.create({
    data: {
      conversation_id: convId,
      sender_email: me.email,
      recipient_email: to,
      content,
    },
  });
  return res.status(201).json(created);
});

// Mark messages as read in a thread (by conversation or with specific email)
messagesRouter.post('/mark-read', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const withEmail = (req.body && req.body.with) ? String(req.body.with) : undefined;
  const conversation_id = (req.body && req.body.conversation_id) ? String(req.body.conversation_id) : undefined;
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!me?.email) return res.status(400).json({ error: 'User email not found' });
  const where: any = { read: false, recipient_email: me.email };
  if (conversation_id) where.conversation_id = conversation_id;
  if (withEmail) where.sender_email = withEmail;
  const result = await prisma.message.updateMany({ where, data: { read: true } });
  return res.json({ updated: result.count });
});
