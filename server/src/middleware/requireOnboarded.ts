import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from './auth.js';
import { prisma } from '../lib/prisma.js';
import { isEmailAdmin } from './requireAdmin.js';
import { updateUserAndInvalidate } from '../lib/userCache.js';
import { isMinor } from '../lib/userAge.js';
import {
  buildAuthStateColumns,
  getCanonicalAuthState,
  getCanonicalOrganizationId,
  getCanonicalUserRole,
  isUserOnboardingComplete,
  mergeAuthStateIntoPreferences,
} from '../lib/userAuthState.js';
import {
  buildBillingStateColumns,
  getCanonicalBillingState,
  mergeBillingStateIntoPreferences,
} from '../lib/userBillingState.js';

/**
 * Fans can get stuck with onboarding_completed=false after OAuth or legacy flows
 * even when profile fields are complete. Heal in middleware (server-only) so
 * ads, comments, and posts are not blocked incorrectly. Coaches are never auto-healed.
 */
async function healFanOnboardingIfEligible(
  userId: string,
  userState: {
    preferences?: Record<string, unknown> | null;
    onboarding_completed?: boolean | null;
    role?: string | null;
  } | null | undefined
): Promise<Record<string, unknown> | null> {
  if (isUserOnboardingComplete(userState as any)) return null;
  const role = getCanonicalUserRole(userState as any);
  if (role === 'coach') return null;

  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      email_verified: true,
      preferences: true,
      role: true,
      onboarding_completed: true,
    },
  });
  if (!row?.email_verified || !row.username) return null;
  const p = (row.preferences as Record<string, unknown>) || {};
  const dob = (p.dob || p.date_of_birth) as string | undefined;
  const zip = (p.zip_code || p.zip) as string | undefined;
  if (!dob || !String(dob).trim()) return null;
  if (!zip || !String(zip).trim()) return null;

  const merged = mergeAuthStateIntoPreferences(p, { onboarding_completed: true });
  const updated = await updateUserAndInvalidate(prisma, {
    where: { id: userId },
    data: {
      preferences: merged,
      ...buildAuthStateColumns({ onboarding_completed: true }),
    },
  });
  console.warn('[requireOnboarded] Healed stuck onboarding_completed for fan', { userId });
  return (updated.preferences as Record<string, unknown>) || merged;
}

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
      role: true,
      onboarding_completed: true,
      organization_id: true,
      coach_agreement_accepted_at: true,
      coach_agreement_version: true,
      plan: true,
      pending_plan: true,
      payment_pending: true,
      payment_approved: true,
    } as any,
  })) as {
    preferences: Record<string, unknown> | null;
    approval_status: string;
    paid_by_owner: boolean;
    email: string;
    date_of_birth: Date | null;
    parental_consent_status: 'not_required' | 'pending' | 'approved' | 'denied';
    role?: 'fan' | 'coach';
    onboarding_completed?: boolean;
    organization_id?: string | null;
    coach_agreement_accepted_at?: Date | null;
    coach_agreement_version?: number | null;
    plan?: 'rookie' | 'veteran' | 'legend';
    pending_plan?: 'rookie' | 'veteran' | 'legend' | null;
    payment_pending?: boolean;
    payment_approved?: boolean;
  } | null;
  const uAny = u as any;
  // `let` (not const) because the fan-onboarding healer at line ~110 may
  // reassign this to the freshly-healed preferences snapshot. Railway's
  // tsc caught this in 1.0.1 build; keep as `let` going forward.
  let prefs = (u?.preferences ?? null) as Record<string, unknown> | null;
  let authState = getCanonicalAuthState(u as any);
  let billingState = getCanonicalBillingState(u as any);

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

  // Allow team/org creation during onboarding (coach creates org+team in step 3 before onboarding completes).
  // Mirror the bypass already in requireVerified.ts so these middlewares stay in lockstep.
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
    String(req.body?.onboarding ?? req.query?.onboarding ?? '') === 'true';
  const uploadContext = String(req.body?.upload_context ?? req.query?.upload_context ?? '');
  const isOnboardingSupportDocUpload =
    req.baseUrl === '/uploads' &&
    req.method === 'POST' &&
    (req.path === '/' || req.path === '/files') &&
    onboardingFlag &&
    uploadContext === 'organization_supporting_document';
  if (
    ((onboardingFlag && (isTeamsCreateRoute || isOrgCreateRoute)) ||
      isOnboardingSupportDocUpload) &&
    authState.onboarding_completed !== true &&
    authState.role === 'coach'
  ) {
    return next();
  }

  if (authState.onboarding_completed !== true) {
    const healed = await healFanOnboardingIfEligible(req.user.id, {
      preferences: prefs,
      onboarding_completed: authState.onboarding_completed,
      role: authState.role,
    });
    if (healed) prefs = healed;
    if (healed) {
      authState = getCanonicalAuthState({
        ...u,
        preferences: healed,
        onboarding_completed: true,
      } as any);
      billingState = getCanonicalBillingState({
        ...u,
        preferences: healed,
      } as any);
    }
  }

  if (authState.onboarding_completed !== true) {
    return res.status(403).json({ error: 'Please complete onboarding before creating content.' });
  }

  // Block coaches whose approval_status is not explicitly APPROVED.
  // The Prisma default is APPROVED (for fans), but coaches must be set to PENDING
  // during onboarding and only transition to APPROVED via god-admin or org-admin action.
  if (authState.role === 'coach' && u?.approval_status !== 'APPROVED') {
    const isRejected = u?.approval_status === 'REJECTED';
    return res.status(403).json({
      error: isRejected
        ? 'Your coach application was not approved. Contact support@varsityhub.app for assistance.'
        : 'Your coach account is pending approval.',
      code: isRejected ? 'APPROVAL_REJECTED' : 'APPROVAL_REQUIRED',
    });
  }

  // Extra guard: coaches must belong to an admin-approved org
  if (authState.role === 'coach' && u?.approval_status === 'APPROVED') {
    const orgId = getCanonicalOrganizationId(u as any) || undefined;
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
  if (authState.role === 'coach' && u?.approval_status === 'APPROVED') {
    const REQUIRED_COACH_AGREEMENT_VERSION = Number(
      process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1
    );
    const acceptedAt = authState.coach_agreement_accepted_at;
    const acceptedVersion = Number(authState.coach_agreement_version ?? 1);
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
          preferences: mergeBillingStateIntoPreferences(downgradedPrefs, {
            plan: 'rookie',
            pending_plan: null,
            payment_pending: false,
            payment_approved: false,
          }),
          ...buildBillingStateColumns({
            plan: 'rookie',
            pending_plan: null,
            payment_pending: false,
            payment_approved: false,
          }),
          subscription_tier: 'free',
          subscription_status: 'expired',
          max_teams: 3,
        },
      });
      prefs = downgradedPrefs;
      billingState = {
        ...billingState,
        plan: 'rookie',
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
        selected_plan: 'rookie',
        effective_plan: 'rookie',
      };
      console.warn('[requireOnboarded] Lazy-downgraded user after grace period expiry', { userId: req.user.id });
      // Continue with downgraded state; coach paid-tier check below will catch them if needed.
    }
  }

  // Additional Apple safety net: if the stored App Store expiry is already in the past,
  // downgrade locally even if the S2S EXPIRED notification never arrived.
  const appleExpiresAt = (prefs as any)?.apple_expires_date;
  const currentPlan = billingState.plan;
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
          preferences: mergeBillingStateIntoPreferences(downgradedPrefs, {
            plan: 'rookie',
            pending_plan: null,
            payment_pending: false,
            payment_approved: false,
          }),
          ...buildBillingStateColumns({
            plan: 'rookie',
            pending_plan: null,
            payment_pending: false,
            payment_approved: false,
          }),
          subscription_tier: 'free',
          subscription_status: 'expired',
          max_teams: 3,
        },
      });
      prefs = downgradedPrefs;
      billingState = {
        ...billingState,
        plan: 'rookie',
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
        selected_plan: 'rookie',
        effective_plan: 'rookie',
      };
      console.warn('[requireOnboarded] Lazy-downgraded user after Apple expiry passed', {
        userId: req.user.id,
      });
    }
  }

  // Approved coach accounts that selected a paid tier must complete checkout
  // before accessing coach tools, unless their league owner covers billing.
  if (authState.role === 'coach' && u?.approval_status === 'APPROVED' && u?.paid_by_owner !== true) {
    const selectedPlan = billingState.selected_plan;
    const requiresPayment = selectedPlan === 'veteran' || selectedPlan === 'legend';
    const paymentPending = billingState.payment_pending === true;
    const paymentApproved = billingState.payment_approved === true;
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
