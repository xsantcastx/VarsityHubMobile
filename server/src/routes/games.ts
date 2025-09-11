import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const gamesRouter = Router();

gamesRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const orderBy = sort === '-date' ? { date: 'desc' as const } : sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const games = await prisma.game.findMany({ orderBy });
  res.json(games);
});

// Get single game by id
gamesRouter.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const game = await prisma.game.findUnique({ where: { id } });
  if (!game) return res.status(404).json({ error: 'Not found' });
  return res.json(game);
});

// Update cover image
gamesRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const id = String(req.params.id);
  const schema = z.object({ cover_image_url: z.string().url().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const game = await prisma.game.update({ where: { id }, data: { cover_image_url: parsed.data.cover_image_url } });
  return res.json(game);
});

// Stories
gamesRouter.get('/:id/stories', async (req, res) => {
  const id = String(req.params.id);
  const stories = await prisma.story.findMany({ where: { game_id: id }, orderBy: { created_at: 'desc' } });
  return res.json(stories);
});

gamesRouter.post('/:id/stories', async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const id = String(req.params.id);
  const schema = z.object({ media_url: z.string().min(1), caption: z.string().optional() });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const story = await prisma.story.create({ data: { game_id: id, user_id: req.user.id, media_url: parsed.data.media_url, caption: parsed.data.caption } });
  return res.status(201).json(story);
});
