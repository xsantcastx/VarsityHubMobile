import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { getIsAdmin } from '../middleware/requireAdmin.js';

export const messagesRouter = Router();

const baseUserSelect = { id: true, email: true, display_name: true, avatar_url: true };

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
const messages = await prisma.message.findMany({
where: { conversation_id },
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
const pair = [meId, toId].sort();
convId = `dm:${pair[0]}__${pair[1]}`;
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
return res.status(201).json(created);
});

messagesRouter.post('/mark-read', async (_req: AuthedRequest, res) => {
// No read flag in schema yet; return OK to avoid client errors.
return res.json({ updated: 0 });
});
