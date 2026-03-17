import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';

export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Allow only onboarding team creation routes to bypass email verification.
  // This must stay narrowly scoped to teams router endpoints.
  const isTeamsCreateRoute =
    req.baseUrl === '/teams' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/create');

  if (req.body?.onboarding === true && isTeamsCreateRoute) {
    // Only allow bypass if user genuinely hasn't completed onboarding yet
    const onboardingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });
    const prefs = (onboardingUser?.preferences as any) || {};
    if (!prefs.onboarding_completed) {
      return next();
    }
  }

  const u = await prisma.user.findUnique({ where: { id: req.user.id }, select: { email_verified: true } });
  if (!u?.email_verified) return res.status(403).json({ error: 'Email verification required' });
  return next();
}

