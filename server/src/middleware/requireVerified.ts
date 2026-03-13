import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Allow team creation during onboarding (step 5) before email is verified.
  // Email verification is enforced at step 10 completion instead.
  if (req.body?.onboarding === true && req.path?.includes('/create')) {
    return next();
  }

  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email_verified: true } });
  if (!u?.email_verified) return res.status(403).json({ error: 'Email verification required' });
  return next();
}

