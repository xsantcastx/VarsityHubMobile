import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getAuthorizedUsersOrgLimit } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';

// Canonical tiers stored in user.subscription_tier column (legacy): free | premium | pro
// New onboarding-facing tiers (preferences.plan): rookie | veteran | legend
// We maintain a synonym map to unify checks.
const canonicalOrder = ['free','premium','pro'] as const;
const onboardingOrder = ['rookie','veteran','legend'] as const;

const synonyms: Record<string,string> = {
  rookie: 'free',
  veteran: 'premium',
  legend: 'pro',
  free: 'free',
  premium: 'premium',
  pro: 'pro'
};

export type CanonicalTier = typeof canonicalOrder[number];
export type OnboardingTier = typeof onboardingOrder[number];
export type AnyTier = CanonicalTier | OnboardingTier;
type DbClient = Prisma.TransactionClient | typeof prisma;

function isAnyTier(value: any): value is AnyTier {
  return canonicalOrder.includes(value) || onboardingOrder.includes(value);
}

function toCanonical(tier: string | undefined | null): CanonicalTier {
  const key = (tier || '').toLowerCase();
  const mapped = synonyms[key];
  if (mapped && canonicalOrder.includes(mapped as CanonicalTier)) return mapped as CanonicalTier;
  return 'free';
}

// Compare tiers irrespective of naming variant
function tierGte(a: AnyTier, b: AnyTier): boolean {
  const ca = toCanonical(a);
  const cb = toCanonical(b);
  return canonicalOrder.indexOf(ca) >= canonicalOrder.indexOf(cb);
}

// Fetch plan from preferences (rookie/veteran/legend) falling back to subscription_tier column
export async function getUserPlan(userId: string, db: DbClient = prisma): Promise<AnyTier> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { subscription_tier: true, subscription_status: true, preferences: true, paid_by_owner: true },
  });
  if (!user) return 'free';
  const prefs = (user.preferences && typeof user.preferences === 'object') ? (user.preferences as any) : {};

  // Coaches covered by league owner: look up the owner's plan instead
  if (user.paid_by_owner) {
    return getLeagueOwnerPlan(userId, db);
  }

  // Rule A: If payment_pending is true, the coach selected a paid plan but hasn't
  // paid yet (awaiting admin approval or checkout). Treat as free until payment completes.
  if (prefs.payment_pending === true) return 'free';

  // Rule A2: If subscription is past_due or unpaid, downgrade to free until payment resolves.
  if (user.subscription_status === 'past_due' || user.subscription_status === 'unpaid') return 'free';

  // Rule B: If subscription has an expiry date and it's in the past, treat as free.
  const expiryRaw = prefs.subscription_end_date || prefs.plan_expiry_date;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      return 'free';
    }
  }

  const prefPlan = prefs.plan as string | undefined; // rookie | veteran | legend

  const plan = prefPlan || user.subscription_tier;

  return toCanonical(plan);
}

// For coaches with paid_by_owner, resolve the league owner's plan
async function getLeagueOwnerPlan(coachId: string, db: DbClient): Promise<AnyTier> {
  // Find the coach's active org membership → org → league owner
  const membership = await db.organizationMembership.findFirst({
    where: { user_id: coachId, status: 'active' },
    select: {
      organization: {
        select: {
          league_owner_id: true,
        },
      },
    },
  });

  const ownerId = membership?.organization?.league_owner_id;
  if (!ownerId) return 'free'; // no league owner found

  // Get the owner's plan (non-recursive — owners are never paid_by_owner)
  const owner = await db.user.findUnique({
    where: { id: ownerId },
    select: { subscription_tier: true, preferences: true },
  });
  if (!owner) return 'free';

  const ownerPrefs = (owner.preferences && typeof owner.preferences === 'object') ? (owner.preferences as any) : {};

  if (ownerPrefs.payment_pending === true) return 'free';

  const expiryRaw = ownerPrefs.subscription_end_date || ownerPrefs.plan_expiry_date;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) return 'free';
  }

  const plan = ownerPrefs.plan || owner.subscription_tier;
  return toCanonical(plan);
}

// Express middleware factory enforcing minimum plan
// Usage: router.post('/some-route', requirePlan('veteran'), handler)
export function requirePlan(minPlan: AnyTier) {
  return async function(req: Request, res: Response, next: NextFunction) {
    try {
      const authReq = req as any; // AuthedRequest
      const authedUser = authReq.user;
      if (!authedUser?.id) {
        return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Authentication required.' });
      }
      const currentPlan = await getUserPlan(authedUser.id);
      if (!tierGte(currentPlan, minPlan)) {
        return res.status(403).json({
          error: 'PLAN_UPGRADE_REQUIRED',
          message: `This feature requires at least ${String(minPlan).toLowerCase()} plan. Current plan: ${String(currentPlan).toLowerCase()}.`,
          required: String(minPlan).toLowerCase(),
          current: String(currentPlan).toLowerCase(),
          upgrade_url: '/settings/manage-subscription'
        });
      }
      // Attach canonical + raw for downstream use
      (req as any).plan = {
        raw: currentPlan,
        canonical: toCanonical(currentPlan),
        minRequired: minPlan
      };
      return next();
    } catch (err) {
      console.error('[requirePlan] Failed', err);
      return res.status(500).json({ error: 'PLAN_CHECK_FAILED', message: 'Unable to verify subscription plan.' });
    }
  };
}

// Helper to compute the organization-wide authorized user limit for a plan.
// This is derived from shared plan definitions:
// Rookie: fixed allowance, Veteran: per-team allowance, Legend: unlimited.
export function computeAuthorizedUserLimit(plan: AnyTier, teamCountTotal: number): number | null {
  return getAuthorizedUsersOrgLimit(plan, teamCountTotal);
}

// Convenience gate you can call inline (returns error payload or null)
export function checkPlanAtLeast(currentPlan: AnyTier, minPlan: AnyTier) {
  if (tierGte(currentPlan, minPlan)) return null;
  return {
    error: 'PLAN_UPGRADE_REQUIRED',
    message: `Requires ${String(minPlan).toLowerCase()} plan (current: ${String(currentPlan).toLowerCase()}).`,
    required: String(minPlan).toLowerCase(),
    current: String(currentPlan).toLowerCase(),
  };
}
