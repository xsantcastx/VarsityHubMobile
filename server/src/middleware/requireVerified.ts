import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { ensureOAuthUserVerified } from '../lib/oauthVerification.js';

export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email_verified: true, google_id: true, apple_id: true },
  });
  const verifiedUser = await ensureOAuthUserVerified(u);
  if (!verifiedUser?.email_verified)
    return res.status(403).json({ error: 'Email verification required' });
  return next();
}
