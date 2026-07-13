/**
 * Legacy minor firewall.
 *
 * VarsityHub no longer requires parental consent for 13–17 users. The only
 * age-based hard block is under-13 access, which should already be rejected at
 * signup. This middleware remains as a defense-in-depth backstop for any
 * legacy under-13 accounts that still exist in the database.
 *
 * Allowlist (matched by path prefix on `req.path` — note this runs after
 * `/v1` is stripped by the parent app.use mount):
 *   - /auth/me, /auth/refresh, /auth/logout, /auth/sign-out
 *   - /me  (the meProxy that forwards to /auth/me — same surface)
 *   - /auth/verify/*
 *   - /health
 *
 * Admins (god-admin emails) bypass the gate entirely so support staff can
 * still investigate a minor's account on their behalf.
 */

import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';
import { isChild } from '../lib/userAge.js';

const ALLOWED_PREFIXES = [
  '/auth/me',
  '/auth/refresh',
  '/auth/logout',
  '/auth/sign-out',
  '/auth/verify',
  '/health',
];

// /me alone (without /me/consent/resend) is just the meProxy alias; treat
// it as allowed too. Using `===` so we don't accidentally allow /me/anything.
const ALLOWED_EXACT = ['/me'];

function isAllowedPath(path: string): boolean {
  if (ALLOWED_EXACT.includes(path)) return true;
  return ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'));
}

export async function requireParentalConsent(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  // Unauthenticated requests — let downstream auth middleware handle it.
  if (!req.user?.id) return next();

  // Always allow the consent + auth/status surface, even before we read the
  // user record. Cheap path-check first to avoid a DB hit on common routes
  // for users who AREN'T minors.
  if (isAllowedPath(req.path)) return next();

  // Look up consent state. Single field — minimal DB cost.
  const u = (await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      email: true,
      date_of_birth: true,
      parental_consent_status: true,
      preferences: true,
    } as any,
  })) as {
    email: string;
    date_of_birth: Date | null;
    parental_consent_status: 'not_required' | 'pending' | 'approved' | 'denied';
    preferences: unknown;
  } | null;

  if (!u) return next(); // user not found — let downstream produce the right error

  // God-admins always pass.
  if (isEmailAdmin(u.email)) return next();

  // Only legacy under-13 users are blocked here. Teen accounts are allowed.
  if (!isChild({ date_of_birth: u.date_of_birth, preferences: u.preferences })) {
    return next();
  }

  return res.status(403).json({
    error: 'COPPA_UNDER_13',
    message:
      'VarsityHub is not available for users under 13. Please have a parent or guardian contact support@varsityhub.app.',
  });
}
