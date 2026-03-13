import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

/**
 * Middleware that rejects requests from users who haven't completed onboarding.
 * Also blocks coaches with PENDING approval_status from coach-only actions.
 * Must be placed after auth middleware (requireAuth or requireVerified).
 */
export async function requireOnboarded(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { preferences: true, approval_status: true },
  });
  const prefs = u?.preferences as Record<string, unknown> | null;

  if (prefs?.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block pending coaches from coach-only actions (creating teams, posts, events, games)
  if (prefs?.role === 'coach' && u?.approval_status === 'PENDING') {
    return res.status(403).json({
      error: 'Your coach account is pending approval.',
      code: 'APPROVAL_REQUIRED',
    });
  }

  return next();
}
