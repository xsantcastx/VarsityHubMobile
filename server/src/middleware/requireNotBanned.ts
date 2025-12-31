import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from './auth.js';

export async function requireNotBanned(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { banned: true } });
  if (user?.banned) return res.status(403).json({ error: 'Account suspended or banned' });
  next();
}
