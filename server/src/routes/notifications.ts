import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const notificationsRouter = Router();

const summarize = (n: any) => {
  switch (n.type) {
    case 'FOLLOW': return 'followed you';
    case 'UPVOTE': return 'upvoted your post';
    case 'COMMENT': return 'commented on your post';
    default: return 'did something';
  }
};

// GET /notifications?cursor=...&limit=...&unread=1
notificationsRouter.get('/', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const unreadOnly = String((req.query as any).unread || '') === '1';

  const where: any = { user_id: userId };
  if (unreadOnly) where.read_at = null;

  const query: any = {
    where,
    orderBy: [{ created_at: 'desc' as const }, { id: 'desc' as const }],
    take: limit + 1,
    include: {
      actor: { select: { id: true, display_name: true, avatar_url: true } },
      post: { select: { id: true, content: true, media_url: true, upvotes_count: true, created_at: true, author_id: true } },
      comment: { select: { id: true, content: true, post_id: true, created_at: true } },
    },
  };
  if (cursor) { query.cursor = { id: cursor }; query.skip = 1; }

  const rows = await (prisma as any).notification.findMany(query);
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? rows[limit].id : null;

  const payload = items.map((n: any) => ({
    id: n.id,
    type: n.type,
    created_at: n.created_at,
    read_at: n.read_at,
    actor: n.actor ? { id: n.actor.id, display_name: n.actor.display_name, avatar_url: n.actor.avatar_url } : null,
    post: n.post ? { id: n.post.id, content: n.post.content, media_url: n.post.media_url } : null,
    comment: n.comment ? { id: n.comment.id, content: n.comment.content, post_id: n.comment.post_id } : null,
    meta: { ...((n.meta as any) || {}), summary: summarize(n) },
  }));

  return res.json({ items: payload, nextCursor });
});

// POST /notifications/:id/read
notificationsRouter.post('/:id/read', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);
  const result = await (prisma as any).notification.updateMany({ where: { id, user_id: userId }, data: { read_at: new Date() } });
  if (result.count === 0) return res.status(404).json({ error: 'Not found' });
  return res.json({ ok: true, id });
});

// POST /notifications/mark-read-all
notificationsRouter.post('/mark-read-all', requireAuth as any, async (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  await (prisma as any).notification.updateMany({ where: { user_id: userId, read_at: null }, data: { read_at: new Date() } });
  return res.json({ ok: true });
});
