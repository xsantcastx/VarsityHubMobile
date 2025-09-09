import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const gamesRouter = Router();

gamesRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const orderBy = sort === '-date' ? { date: 'desc' as const } : sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const games = await prisma.game.findMany({ orderBy });
  res.json(games);
});

