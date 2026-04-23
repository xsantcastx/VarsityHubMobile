import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { ensureOAuthUserVerified } from '../lib/oauthVerification.js';
import { isUserOnboardingComplete } from '../lib/userAuthState.js';

export async function requireVerified(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Allow onboarding team/org creation routes to bypass email verification.
  // Coaches create an organization in step-3 before onboarding completes.
  const isTeamsCreateRoute =
    req.baseUrl === '/teams' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/create');

  const isOrgCreateRoute =
    req.baseUrl === '/organizations' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/create');

  const onboardingFlag =
    req.body?.onboarding === true ||
    String(req.body?.onboarding ?? '') === 'true';

  if (onboardingFlag && (isTeamsCreateRoute || isOrgCreateRoute)) {
    // Only allow bypass if user genuinely hasn't completed onboarding yet.
    // v1.0.3: select both the `role` and `onboarding_completed` columns so
    // the canonical helper reads the column-authoritative values (matches
    // requireOnboarded.ts — the two middlewares must stay in lockstep).
    const onboardingUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true, onboarding_completed: true, role: true },
    });
    if (!isUserOnboardingComplete(onboardingUser as any)) {
      return next();
    }
  }

  const u = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email_verified: true, google_id: true, apple_id: true },
  });
  const verifiedUser = await ensureOAuthUserVerified(u);
  if (!verifiedUser?.email_verified)
    return res.status(403).json({ error: 'Email verification required' });
  return next();
}
