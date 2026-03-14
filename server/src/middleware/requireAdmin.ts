import type { NextFunction, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthedRequest } from './auth.js';

export function isEmailAdmin(email?: string | null): boolean {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, email_verified: true },
  });
  if (!me?.email_verified) return res.status(403).json({ error: 'Email verification required' });
  if (!isEmailAdmin(me?.email)) return res.status(403).json({ error: 'Admin only' });
  return next();
}

export async function getIsAdmin(req: AuthedRequest): Promise<boolean> {
  if (!req.user) return false;
  const me = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { email: true, email_verified: true },
  });
  return !!me?.email_verified && isEmailAdmin(me?.email);
}

