/**
 * Parental consent firewall.
 *
 * Runs after auth but before route dispatch. For 13–17 minors whose
 * `parental_consent_status` is `pending` or `denied`, blocks every request
 * EXCEPT a small allowlist that lets them keep using the auth/status surface
 * and request a fresh consent email.
 *
 * Allowlist (matched by path prefix on `req.path` — note this runs after
 * `/v1` is stripped by the parent app.use mount):
 *   - /auth/me, /auth/refresh, /auth/logout, /auth/sign-out
 *   - /me  (the meProxy that forwards to /auth/me — same surface)
 *   - /me/consent/resend
 *   - /consent/...
 *   - /health
 *
 * Anything else returns 403 with a categorical error code so the mobile
 * client can route to a "waiting for parent" screen instead of guessing.
 *
 * Admins (god-admin emails) bypass the gate entirely so support staff can
 * still investigate a minor's account on their behalf.
 */

import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';
import { isMinor } from '../lib/userAge.js';

const ALLOWED_PREFIXES = [
  '/auth/me',
  '/auth/refresh',
  '/auth/logout',
  '/auth/sign-out',
  // Email verification MUST stay reachable regardless of consent state.
  // Without this, a minor who provided DOB at registration (so consent
  // flipped to pending) gets a JWT but is firewall-blocked from
  // /auth/verify/confirm — they can never verify their email and are
  // permanently locked out of onboarding. The verify endpoints already
  // require auth + rate-limit + check email_verified independently, so
  // allowlisting adds no new attack surface.
  '/auth/verify',
  '/me/consent/resend',
  '/consent',
  '/health',
];

// /me alone (without /me/consent/resend) is just the meProxy alias; treat
// it as allowed too. Using `===` so we don't accidentally allow /me/anything.
const ALLOWED_EXACT = ['/me'];

function isAllowedPath(path: string): boolean {
  if (ALLOWED_EXACT.includes(path)) return true;
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix + '/')
  );
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

  // Adult or under-13-blocked-at-signup → no consent gate.
  if (!isMinor({ date_of_birth: u.date_of_birth, preferences: u.preferences })) {
    return next();
  }

  // Approved or not-required → pass.
  if (u.parental_consent_status === 'approved' || u.parental_consent_status === 'not_required') {
    return next();
  }

  // Pending or denied → block with a categorical error code.
  const isDenied = u.parental_consent_status === 'denied';
  return res.status(403).json({
    error: isDenied ? 'PARENTAL_CONSENT_DENIED' : 'PARENTAL_CONSENT_PENDING',
    message: isDenied
      ? 'A parent or guardian denied this account. Contact support@varsityhub.app if this was in error.'
      : 'Waiting for your parent or guardian to approve this account.',
  });
}
