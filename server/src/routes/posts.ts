import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';

export const postsRouter = Router();

postsRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;
  const orderBy = sort === '-created_date' ? { created_at: 'desc' as const } : { created_at: 'desc' as const };
  const where: any = {};
  if (req.query.game_id) where.game_id = String(req.query.game_id);
  if (req.query.type) where.type = String(req.query.type);

  if (cursor) {
    const rows = await prisma.post.findMany({
      orderBy,
      cursor: { id: cursor },
      skip: 1,
      take: limit + 1,
      include: { _count: { select: { comments: true } } },
      where,
    });
    const items = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? rows[limit].id : null;
    return res.json({ items, nextCursor });
  }
  const posts = await prisma.post.findMany({ orderBy, take: limit, include: { _count: { select: { comments: true } } }, where });
  res.json(posts);
});

// Count posts by simple filters (e.g., game_id, type)
postsRouter.get('/count', async (req, res) => {
  const where: any = {};
  if (req.query.game_id) where.game_id = String(req.query.game_id);
  if (req.query.type) where.type = String(req.query.type);
  const count = await prisma.post.count({ where });
  res.json({ count });
});

const createPostSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(4000).optional(),
    type: z.string().max(50).optional(),
    // Accept any non-empty string to support data URIs or local uploads handled elsewhere
    media_url: z.string().trim().min(1).optional(),
    game_id: z.string().optional(),
  })
  // Require at least content or media_url
  .refine((d) => Boolean((d.content && d.content.trim().length > 0) || (d.media_url && d.media_url.trim().length > 0)), {
    message: 'Either content or media_url is required',
    path: ['content'],
  });

postsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data;
  const post = await prisma.post.create({ data: {
    title: data.title,
    content: data.content?.trim() || null,
    type: data.type || 'post',
    media_url: data.media_url,
    game_id: data.game_id,
  }});
  res.status(201).json(post);
});

postsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  const post = await prisma.post.findUnique({ where: { id }, include: { _count: { select: { comments: true } } } });
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json(post);
});

// Comments
postsRouter.get('/:id/comments', async (req, res) => {
  const { id } = req.params;
  const items = await prisma.comment.findMany({ where: { post_id: id }, orderBy: { created_at: 'desc' }, take: 50 });
  res.json(items);
});

postsRouter.post('/:id/comments', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const schema = z.object({ content: z.string().min(1).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const comment = await prisma.comment.create({ data: { post_id: id, content: parsed.data.content } });
  res.status(201).json(comment);
});

// Reactions
postsRouter.post('/:id/reactions/like', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const post = await prisma.post.update({ where: { id }, data: { upvotes_count: { increment: 1 } } });
  res.json({ upvotes_count: post.upvotes_count });
});

postsRouter.delete('/:id/reactions/like', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;
  const p = await prisma.post.findUnique({ where: { id } });
  if (!p) return res.status(404).json({ error: 'Not found' });
  const post = await prisma.post.update({ where: { id }, data: { upvotes_count: Math.max(0, (p.upvotes_count || 0) - 1) } });
  res.json({ upvotes_count: post.upvotes_count });
});
