import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';
import { updateUserAndInvalidate } from '../lib/userCache.js';
import { SERVER_ROOKIE_TEAM_LIMIT } from '../lib/planDefinitions.js';
import {
  getCanonicalUserRole,
  hasCoachFanModeAccess,
  isUserOnboardingComplete,
} from '../lib/userAuthState.js';

/**
 * Middleware that rejects requests from users who haven't completed onboarding.
 * Also blocks coaches with PENDING approval_status from coach-only actions.
 * Must be placed after auth middleware (requireAuth or requireVerified).
 */
export async function requireOnboarded(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Reuse the DB user cached by requireVerified (when both middleware are stacked) to avoid
  // a redundant DB round-trip for the same user on the same request.
  const u = req._dbUser ?? await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      preferences: true,
      approval_status: true,
      email: true,
      // v1.0.3: include the top-level `role` + `onboarding_completed` columns so
      // the canonical helpers can see them. Previously only `preferences` was
      // selected, which made the onboarding-bypass fail whenever the column and
      // the JSON had briefly diverged (updatePreferences writes both, but
      // cache/timing races meant new coaches were blocked at step 3 with
      // "Please complete onboarding before creating content.").
      role: true,
      onboarding_completed: true,
    },
  });
  const prefs = u?.preferences as Record<string, unknown> | null;
  const role = getCanonicalUserRole(u as any);
  const onboardingComplete = isUserOnboardingComplete(u as any);
  const hasFanModeAccess = hasCoachFanModeAccess(u as any);

  // God-admins bypass all onboarding/approval checks
  if (isEmailAdmin(u?.email)) {
    return next();
  }

  // Allow team/org creation during onboarding (coach creates org+team in step 3 before onboarding completes).
  // Mirror the bypass already in requireVerified.ts — these two middlewares must stay in lockstep.
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

  // v1.0.3: use canonical role (checks both the `role` column and
  // `preferences.role`) so a coach whose prefs JSON hasn't been repopulated
  // after the last write can still submit their org during step 3.
  //
  // Invariant: `buildAuthStateColumns` (column write) and
  // `mergeAuthStateIntoPreferences` (JSON write) MUST be called together in
  // the same Prisma update so role/onboarding state stays atomic across both
  // storage surfaces. Any code path that writes only one side will recreate
  // the exact drift this canonical-role bypass was added to work around.
  if (
    onboardingFlag &&
    (isTeamsCreateRoute || isOrgCreateRoute) &&
    !onboardingComplete &&
    role === 'coach'
  ) {
    return next();
  }

  const isFanSafePostCreateRoute =
    req.baseUrl === '/posts' && req.method === 'POST' && req.path === '/';
  const isFanSafeEventCreateRoute =
    req.baseUrl === '/events' && req.method === 'POST' && req.path === '/';
  const isFanSafeCommentRoute =
    req.baseUrl === '/posts' && req.method === 'POST' && /^\/[^/]+\/comments$/.test(req.path);
  const isFanSafePollVoteRoute =
    req.baseUrl === '/posts' && req.method === 'POST' && /^\/[^/]+\/poll\/vote$/.test(req.path);

  let isFanSafeOwnPostManageRoute = false;
  if (req.baseUrl === '/posts' && (req.method === 'PATCH' || req.method === 'DELETE')) {
    const postMatch = req.path.match(/^\/([^/]+)$/);
    if (postMatch) {
      const post = await prisma.post.findUnique({
        where: { id: postMatch[1] },
        select: { author_id: true, deleted_at: true },
      });
      isFanSafeOwnPostManageRoute = !!post && !post.deleted_at && post.author_id === req.user.id;
    }
  }

  const isFanSafeRoute =
    isFanSafePostCreateRoute ||
    isFanSafeEventCreateRoute ||
    isFanSafeCommentRoute ||
    isFanSafePollVoteRoute ||
    isFanSafeOwnPostManageRoute;

  if (hasFanModeAccess && isFanSafeRoute) {
    return next();
  }

  // Pending/rejected coaches in "proceed as fan" mode may use the narrow fan-safe
  // content routes above, but coach-only routes should still be gated by their
  // approval/account state rather than collapsing into a generic onboarding error.
  if (!onboardingComplete && !(role === 'coach' && hasFanModeAccess)) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block coaches whose approval_status is not explicitly APPROVED.
  // The Prisma default is APPROVED (for fans), but coaches must be set to PENDING
  // during onboarding and only transition to APPROVED via god-admin or org-admin action.
  if (role === 'coach' && u?.approval_status !== 'APPROVED') {
    const isRejected = u?.approval_status === 'REJECTED';
    return res.status(403).json({
      error: isRejected
        ? 'Your coach application was not approved. Contact support@varsityhub.app for assistance.'
        : 'Your coach account is pending approval.',
      code: isRejected ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUIRED',
    });
  }

  // v1.0.2 pass 8: safety net for Apple IAP grace period expiry. If Apple's EXPIRED
  // notification was lost, this catches users whose grace period has elapsed and
  // downgrades them lazily on their next coach API call. Without this, users could
  // retain Premium access indefinitely after a failed renewal.
  const graceExpiresAt = (prefs as any)?.grace_period_expires_at;
  if (graceExpiresAt) {
    const expires = new Date(String(graceExpiresAt));
    if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
      const downgradedPrefs = { ...(prefs as any), plan: 'rookie', grace_period_expires_at: null };
      delete downgradedPrefs.apple_product_id;
      delete downgradedPrefs.apple_expires_date;
      await updateUserAndInvalidate(prisma, {
        where: { id: req.user.id },
        data: {
          preferences: downgradedPrefs,
          subscription_tier: 'free',
          subscription_status: 'expired',
          max_teams: SERVER_ROOKIE_TEAM_LIMIT,
        },
      });
      console.warn('[requireOnboarded] Lazy-downgraded user after grace period expiry', { userId: req.user.id });
      // Continue with downgraded state; approval remains the only coach-feature gate here.
    }
  }

  return next();
}
