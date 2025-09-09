import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const eventsRouter = Router();

eventsRouter.get('/', async (req, res) => {
  const status = String(req.query.status || '').trim();
  const sort = String(req.query.sort || '').trim();
  const where: any = {};
  if (status) where.status = status;
  const orderBy = sort === 'date' ? { date: 'asc' as const } : { created_at: 'desc' as const };
  const events = await prisma.event.findMany({ where, orderBy });
  res.json(events);
});

