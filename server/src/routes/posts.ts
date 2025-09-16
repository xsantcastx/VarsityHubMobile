import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireVerified } from '../middleware/requireVerified.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const postsRouter = Router();

postsRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const cursor = (req.query.cursor as string | undefined) || undefined;
  const orderBy = sort === '-created_date' ? { created_at: 'desc' as const } : { created_at: 'desc' as const };
  const where: any = {};
  if (req.query.game_id) where.game_id = String(req.query.game_id);
  if (req.query.type) where.type = String(req.query.type);
  if (req.query.user_id) where.author_id = String(req.query.user_id);

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

const locationSchema = z.object({
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  place_id: z.string().nullable().optional(),
  place_name: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  admin_area: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
  source: z.enum(['device','places','zip','derived']).nullable().optional(),
  zip: z.string().nullable().optional(),
}).optional();

const createPostSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().max(4000).optional(),
    type: z.string().max(50).optional(),
    // Accept any non-empty string to support data URIs or local uploads handled elsewhere
    media_url: z.string().trim().min(1).optional(),
    game_id: z.string().optional(),
    location: locationSchema,
  })
  // Require at least content or media_url
  .refine((d) => Boolean((d.content && d.content.trim().length > 0) || (d.media_url && d.media_url.trim().length > 0)), {
    message: 'Either content or media_url is required',
    path: ['content'],
  });

import { reverseGeocode, geocodeZip, getCountryFromReqOrPrefs } from '../lib/geo.js';

postsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid payload',
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data;
  // Normalize and enrich location
  let lat: number | null = null;
  let lng: number | null = null;
  let country_code: string | null = null;
  let admin1: string | null = null;
  let place_name: string | null = null;
  
  const prefs = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
  const preferCountry = getCountryFromReqOrPrefs(req as any, prefs?.preferences);
  const loc = (data as any).location || {};
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    lat = loc.lat; lng = loc.lng;
    try {
      const rev = await reverseGeocode(lat, lng);
      country_code = rev.country_code || preferCountry;
      admin1 = rev.admin_area || null;
      place_name = rev.place_name || null;
    } catch {}
  } else if (loc.zip || (prefs?.preferences as any)?.zip_code) {
    try {
      const zip = String(loc.zip || (prefs?.preferences as any)?.zip_code);
      const gg = await geocodeZip(zip, preferCountry);
      lat = gg.lat; lng = gg.lng; country_code = gg.country_code || preferCountry;
    } catch {}
  } else {
    country_code = preferCountry || null;
  }

  const post = await prisma.post.create({
    data: {
      title: data.title,
      content: data.content?.trim() || null,
      type: data.type || 'post',
      media_url: data.media_url,
      game_id: data.game_id,
      author_id: req.user.id,
      country_code: country_code || undefined,
      admin1: admin1 || undefined,
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
    },
  });

  res.status(201).json({ ...post, location: { lat, lng, place_name, country_code } });
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
// Toggle upvote
postsRouter.post('/:id/upvote', requireAuth as any, async (req: AuthedRequest, res) => {
  const postId = String(req.params.id);
  const userId = req.user!.id;
  const existing = await prisma.postVote.findUnique({ where: { post_id_user_id: { post_id: postId, user_id: userId } } as any });
  if (existing) {
    await prisma.$transaction([
      prisma.postVote.delete({ where: { id: existing.id } }),
      prisma.post.update({ where: { id: postId }, data: { upvotes_count: { decrement: 1 } } }),
    ]);
    const { upvotes_count } = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { upvotes_count: true } });
    return res.json({ upvoted: false, count: upvotes_count });
  }
  await prisma.$transaction([
    prisma.postVote.create({ data: { post_id: postId, user_id: userId } }),
    prisma.post.update({ where: { id: postId }, data: { upvotes_count: { increment: 1 } } }),
  ]);
  const { upvotes_count } = await prisma.post.findUniqueOrThrow({ where: { id: postId }, select: { upvotes_count: true } });
  return res.json({ upvoted: true, count: upvotes_count });
});
