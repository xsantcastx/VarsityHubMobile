import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const messagesRouter = Router();

messagesRouter.get('/', async (req, res) => {
  const sort = String(req.query.sort || '').trim();
  const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
  const orderBy = sort === '-created_date' ? { created_date: 'desc' as const } : { created_date: 'desc' as const };
  const messages = await prisma.message.findMany({ orderBy, take: limit });
  res.json(messages);
});

