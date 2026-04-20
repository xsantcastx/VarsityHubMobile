import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';
import { updateUserAndInvalidate } from '../lib/userCache.js';
import { isMinor } from '../lib/userAge.js';

/**
 * Middleware that rejects requests from users who haven't completed onboarding.
 * Also blocks coaches with PENDING approval_status from coach-only actions.
 * For coaches, verifies their org is admin_approved (god-admin gated).
 * Must be placed after auth middleware (requireAuth or requireVerified).
 */
export async function requireOnboarded(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // Intentionally cast to `any` via an intermediate — Prisma's generated
  // types may not yet expose `date_of_birth` / `parental_consent_status`
  // until `prisma generate` runs post-schema-change. Accessing through a
  // typed shadow keeps the rest of the handler type-safe.
  const u = (await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      preferences: true,
      approval_status: true,
      paid_by_owner: true,
      email: true,
      date_of_birth: true,
      parental_consent_status: true,
    } as any,
  })) as {
    preferences: Record<string, unknown> | null;
    approval_status: string;
    paid_by_owner: boolean;
    email: string;
    date_of_birth: Date | null;
    parental_consent_status: 'not_required' | 'pending' | 'approved' | 'denied';
  } | null;
  const uAny = u as any;
  const prefs = (u?.preferences ?? null) as Record<string, unknown> | null;

  // God-admins bypass all onboarding/approval checks
  if (isEmailAdmin(u?.email)) {
    return next();
  }

  // Parental-consent gate: 13-17 minors with a `pending` or `denied` consent
  // status must not be allowed through onboarded-only routes. The error codes
  // are distinct so the mobile client can show "waiting for parent" vs
  // "account denied" screens instead of a generic 403.
  if (
    isMinor({ date_of_birth: uAny?.date_of_birth ?? null, preferences: uAny?.preferences }) &&
    uAny?.parental_consent_status &&
    uAny.parental_consent_status !== 'approved' &&
    uAny.parental_consent_status !== 'not_required'
  ) {
    const isDenied = uAny.parental_consent_status === 'denied';
    return res.status(403).json({
      error: isDenied ? 'PARENTAL_CONSENT_DENIED' : 'PARENTAL_CONSENT_PENDING',
      message: isDenied
        ? 'A parent or guardian denied this account. Contact support@varsityhub.app if this was in error.'
        : 'Waiting for your parent or guardian to approve this account.',
    });
  }

  // Allow team creation during onboarding (coach creates team in step 3 before onboarding completes)
  const isTeamsCreateRoute =
    req.baseUrl === '/teams' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/create');
  if (req.body?.onboarding === true && isTeamsCreateRoute && prefs?.onboarding_completed !== true && prefs?.role === 'coach') {
    return next();
  }

  if (prefs?.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block coaches whose approval_status is not explicitly APPROVED.
  // The Prisma default is APPROVED (for fans), but coaches must be set to PENDING
  // during onboarding and only transition to APPROVED via god-admin or org-admin action.
  if (prefs?.role === 'coach' && u?.approval_status !== 'APPROVED') {
    const isRejected = u?.approval_status === 'REJECTED';
    return res.status(403).json({
      error: isRejected
        ? 'Your coach application was not approved. Contact support@varsityhub.app for assistance.'
        : 'Your coach account is pending approval.',
      code: isRejected ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUIRED',
    });
  }

  // Extra guard: coaches must belong to an admin-approved org
  if (prefs?.role === 'coach' && u?.approval_status === 'APPROVED') {
    const orgId = prefs?.organization_id as string | undefined;
    if (orgId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { admin_approved: true },
      });
      if (org && !org.admin_approved) {
        return res.status(403).json({
          error: 'Your organization is pending approval.',
          code: 'APPROVAL_REQUIRED',
        });
      }
    }
  }

  // v1.0.2: Approved coaches must accept the coach agreement before accessing coach tools.
  // Previously this was UI-only — any API client could bypass by calling coach endpoints directly.
  //
  // v1.0.3: Agreement versioning. When the agreement text changes, bump
  // `REQUIRED_COACH_AGREEMENT_VERSION` in this file (or via env var) and
  // existing coaches will be forced to re-accept. The version stored in
  // `preferences.coach_agreement_version` is compared against the required
  // constant. Legacy users with only `accepted_at` (no version field) are
  // treated as having accepted version 1 — bump to 2+ to force re-accept.
  if (prefs?.role === 'coach' && u?.approval_status === 'APPROVED') {
    const REQUIRED_COACH_AGREEMENT_VERSION = Number(
      process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1
    );
    const acceptedAt = prefs?.coach_agreement_accepted_at;
    const acceptedVersion = Number(prefs?.coach_agreement_version ?? 1);
    if (!acceptedAt) {
      return res.status(403).json({
        error: 'You must accept the coach agreement before accessing coach tools.',
        code: 'COACH_AGREEMENT_REQUIRED',
      });
    }
    if (acceptedVersion < REQUIRED_COACH_AGREEMENT_VERSION) {
      return res.status(403).json({
        error:
          'The coach agreement has been updated. Please review and accept the latest version.',
        code: 'COACH_AGREEMENT_OUTDATED',
        current_version: acceptedVersion,
        required_version: REQUIRED_COACH_AGREEMENT_VERSION,
      });
    }
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
          max_teams: 3,
        },
      });
      console.warn('[requireOnboarded] Lazy-downgraded user after grace period expiry', { userId: req.user.id });
      // Continue with downgraded state; coach paid-tier check below will catch them if needed.
    }
  }

  // Additional Apple safety net: if the stored App Store expiry is already in the past,
  // downgrade locally even if the S2S EXPIRED notification never arrived.
  const appleExpiresAt = (prefs as any)?.apple_expires_date;
  const currentPlan = String((prefs?.plan as string | undefined) || '').toLowerCase();
  if (
    appleExpiresAt &&
    (currentPlan === 'veteran' || currentPlan === 'legend') &&
    u?.paid_by_owner !== true
  ) {
    const expires = new Date(String(appleExpiresAt));
    if (!Number.isNaN(expires.getTime()) && expires < new Date()) {
      const downgradedPrefs = { ...(prefs as any), plan: 'rookie', apple_expires_date: null };
      delete downgradedPrefs.apple_product_id;
      await updateUserAndInvalidate(prisma, {
        where: { id: req.user.id },
        data: {
          preferences: downgradedPrefs,
          subscription_tier: 'free',
          subscription_status: 'expired',
          max_teams: 3,
        },
      });
      console.warn('[requireOnboarded] Lazy-downgraded user after Apple expiry passed', {
        userId: req.user.id,
      });
    }
  }

  // Approved coach accounts that selected a paid tier must complete checkout
  // before accessing coach tools, unless their league owner covers billing.
  if (prefs?.role === 'coach' && u?.approval_status === 'APPROVED' && u?.paid_by_owner !== true) {
    const pendingPlan = String((prefs?.pending_plan as string | undefined) || '').toLowerCase();
    const currentPlan = String((prefs?.plan as string | undefined) || '').toLowerCase();
    const selectedPlan = pendingPlan || currentPlan;
    const requiresPayment = selectedPlan === 'veteran' || selectedPlan === 'legend';
    const paymentPending = prefs?.payment_pending === true;
    const paymentApproved = prefs?.payment_approved === true;
    const joinRequestPending = prefs?.join_request_pending === true;
    const canCheckoutNow = paymentApproved || !joinRequestPending;

    if (requiresPayment && paymentPending && canCheckoutNow) {
      return res.status(403).json({
        error: 'Checkout required before accessing coach tools.',
        code: 'PAYMENT_REQUIRED',
        pending_plan: selectedPlan,
      });
    }
  }

  return next();
}
