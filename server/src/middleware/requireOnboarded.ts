import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

/**
 * Middleware that rejects requests from users who haven't completed onboarding.
 * Must be placed after auth middleware (requireAuth or requireVerified).
 */
export async function requireOnboarded(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { preferences: true },
  });
  const prefs = u?.preferences as Record<string, unknown> | null;

  if (prefs?.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  return next();
}
