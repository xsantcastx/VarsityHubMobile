import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getAuthorizedUsersOrgLimit } from '../lib/planLimits.js';
import { prisma } from '../lib/prisma.js';
import {
  getEffectiveEntitledPlan,
} from '../lib/userBillingState.js';

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
type PlanUserRow = {
  id: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  preferences: unknown;
  paid_by_owner: boolean;
  plan: string | null;
  pending_plan: string | null;
  payment_pending: boolean;
  payment_approved: boolean;
};

function isAnyTier(value: any): value is AnyTier {
  return canonicalOrder.includes(value) || onboardingOrder.includes(value);
}

function toCanonical(tier: string | undefined | null): CanonicalTier {
  const key = (tier || '').toLowerCase();
  const mapped = synonyms[key];
  if (mapped && canonicalOrder.includes(mapped as CanonicalTier)) return mapped as CanonicalTier;
  return 'free';
}

const userPlanSelect = {
  id: true,
  subscription_tier: true,
  subscription_status: true,
  preferences: true,
  paid_by_owner: true,
  plan: true,
  pending_plan: true,
  payment_pending: true,
  payment_approved: true,
} as const;

// Compare tiers irrespective of naming variant
function tierGte(a: AnyTier, b: AnyTier): boolean {
  const ca = toCanonical(a);
  const cb = toCanonical(b);
  return canonicalOrder.indexOf(ca) >= canonicalOrder.indexOf(cb);
}

function resolvePlanFromUserRecord(user: Omit<PlanUserRow, 'id' | 'paid_by_owner'> | null | undefined): AnyTier {
  if (!user) return 'free';
  const prefs = user.preferences && typeof user.preferences === 'object' ? (user.preferences as any) : {};

  const effectivePlan = getEffectiveEntitledPlan(user as any);
  if (effectivePlan === 'rookie') return 'free';

  if (user.subscription_status === 'past_due' || user.subscription_status === 'unpaid') return 'free';

  const expiryRaw = prefs.subscription_end_date || prefs.plan_expiry_date;
  if (expiryRaw) {
    const expiry = new Date(expiryRaw);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      return 'free';
    }
  }

  const plan = effectivePlan || user.subscription_tier;
  return toCanonical(plan);
}

export async function getUserPlans(userIds: string[], db: DbClient = prisma): Promise<Map<string, AnyTier>> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, AnyTier>();
  if (uniqueUserIds.length === 0) return result;

  const users = await db.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: userPlanSelect,
  });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const paidByOwnerUserIds = users.filter((user) => user.paid_by_owner).map((user) => user.id);
  let ownerPlanByCoachId = new Map<string, AnyTier>();

  if (paidByOwnerUserIds.length > 0) {
    const ownerLinks = await db.organizationMembership.findMany({
      where: {
        user_id: { in: paidByOwnerUserIds },
        status: 'active',
      },
      select: {
        user_id: true,
        organization: {
          select: {
            league_owner_id: true,
          },
        },
      },
    });

    const ownerIdByCoachId = new Map<string, string>();
    for (const link of ownerLinks) {
      const ownerId = link.organization?.league_owner_id;
      if (ownerId && !ownerIdByCoachId.has(link.user_id)) {
        ownerIdByCoachId.set(link.user_id, ownerId);
      }
    }

    const ownerIds = [...new Set(ownerIdByCoachId.values())];
    const ownerRows = ownerIds.length
      ? await db.user.findMany({
          where: { id: { in: ownerIds } },
          select: userPlanSelect,
        })
      : [];
    const ownerRowsById = new Map(ownerRows.map((owner) => [owner.id, owner]));

    ownerPlanByCoachId = new Map(
      [...ownerIdByCoachId.entries()].map(([coachId, ownerId]) => [
        coachId,
        resolvePlanFromUserRecord(ownerRowsById.get(ownerId) ?? null),
      ])
    );
  }

  for (const userId of uniqueUserIds) {
    const user = usersById.get(userId);
    if (!user) {
      result.set(userId, 'free');
      continue;
    }
    if (user.paid_by_owner) {
      result.set(userId, ownerPlanByCoachId.get(userId) ?? 'free');
      continue;
    }
    result.set(userId, resolvePlanFromUserRecord(user));
  }

  return result;
}

// Fetch plan from preferences (rookie/veteran/legend) falling back to subscription_tier column
export async function getUserPlan(userId: string, db: DbClient = prisma): Promise<AnyTier> {
  return (await getUserPlans([userId], db)).get(userId) ?? 'free';
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
