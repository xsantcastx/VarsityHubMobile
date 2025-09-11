import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
  return next();
}

export async function getIsAdmin(req: AuthedRequest): Promise<boolean> {
  if (!req.user) return false;
  const me = await prisma.user.findUnique({ where: { id: req.user.id } });
  return isEmailAdmin(me?.email);
}

