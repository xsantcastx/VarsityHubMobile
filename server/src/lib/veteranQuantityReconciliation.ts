import Stripe from 'stripe';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from './planDefinitions.js';
import { prisma as defaultPrisma } from './prisma.js';
import { getVeteranBillingSnapshot, resolveOwnerBillingOrgId } from './paymentInternals.js';
import { getEffectiveEntitledPlan } from './userBillingState.js';
import { captureException, captureMessage } from './sentry.js';

/**
 * Down-only reconciliation of a metered Veteran's Stripe subscription-item
 * quantity against their actual active billable-program count.
 *
 * Stripe item quantity == max(0, activeProgramCount - free tier). The team
 * create flow bumps it UP (with explicit owner consent); nothing ever brought
 * it DOWN when programs were archived, and archival is terminal (no restore
 * path), so the quantity ratcheted up and over-charged owners for sports they
 * no longer run. This decides the correction the nightly job applies.
 *
 * Invariants:
 *  - NEVER raises quantity — an increase is a surprise charge and only a create
 *    (with consent) may do it. An under-billed owner is left untouched here.
 *  - When the owner has dropped to the free tier (0 billable) it FLAGS a plan
 *    downgrade rather than writing quantity 0 — moving them off Veteran is a
 *    higher-stakes plan change left to the owner/operator, not this job.
 */
export type VeteranQuantityReconciliation =
  | { action: 'none'; targetQuantity: number }
  | { action: 'lower'; targetQuantity: number }
  | { action: 'flag_downgrade'; targetQuantity: 0 };

export function resolveVeteranQuantityReconciliation(input: {
  currentQuantity: number;
  activeProgramCount: number;
}): VeteranQuantityReconciliation {
  const current = Math.max(0, Math.trunc(input.currentQuantity || 0));
  const programs = Math.max(0, Math.trunc(input.activeProgramCount || 0));
  const billable = Math.max(0, programs - SERVER_ROOKIE_PROGRAM_LIMIT);

  if (billable === 0) {
    // Free-tier usage on a paid Veteran sub — surface as a plan downgrade
    // rather than zeroing the quantity automatically.
    return current > 0
      ? { action: 'flag_downgrade', targetQuantity: 0 }
      : { action: 'none', targetQuantity: 0 };
  }

  if (current > billable) {
    return { action: 'lower', targetQuantity: billable };
  }

  // Aligned, or under-billed (current < billable) — never raise here.
  return { action: 'none', targetQuantity: billable };
}

// ── Nightly job wrapper ──────────────────────────────────────────────────────

// Minimal Stripe surface the job uses — lets tests inject a stub.
type StripeLike = {
  subscriptions: { retrieve: (id: string) => Promise<any> };
  subscriptionItems: { update: (itemId: string, params: { quantity: number }) => Promise<any> };
};

export type VeteranReconcileResult = {
  scanned: number;
  lowered: number;
  flagged: number;
  errors: number;
  truncated: boolean;
  durationMs: number;
};

type VeteranReconcileDeps = {
  db?: typeof defaultPrisma;
  stripe?: StripeLike;
  /** Bound on candidates scanned per run. */
  limit?: number;
  /** Test hook: restrict to specific user ids. */
  onlyUserIds?: string[];
};

const DEFAULT_SCAN_LIMIT = 1000;

/**
 * Re-align each metered Veteran's Stripe item quantity DOWN to their actual
 * billable-program count. Down-only, idempotent, per-owner isolated. Owner-
 * covered (`paid_by_owner`) and IAP-flat (no `subscription_id`) veterans are
 * skipped — they are unmetered. Free-tier owners are flagged to Sentry for a
 * plan downgrade rather than having their quantity zeroed automatically.
 */
export async function runVeteranQuantityReconciliation(
  deps: VeteranReconcileDeps = {}
): Promise<VeteranReconcileResult> {
  const startedAt = Date.now();
  const db = deps.db ?? defaultPrisma;
  const limit = deps.limit ?? DEFAULT_SCAN_LIMIT;

  let stripe = deps.stripe;
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      console.log('[veteran-quantity-reconcile] STRIPE_SECRET_KEY not set — skipping');
      return { scanned: 0, lowered: 0, flagged: 0, errors: 0, truncated: false, durationMs: 0 };
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 20000, maxNetworkRetries: 2 });
  }

  const candidates = await db.user.findMany({
    where: {
      plan: 'veteran',
      paid_by_owner: false,
      ...(deps.onlyUserIds ? { id: { in: deps.onlyUserIds } } : {}),
    },
    select: {
      id: true,
      preferences: true,
      plan: true,
      pending_plan: true,
      payment_pending: true,
      payment_approved: true,
    },
    take: limit + 1,
  });
  const truncated = candidates.length > limit;
  const batch = truncated ? candidates.slice(0, limit) : candidates;

  let lowered = 0;
  let flagged = 0;
  let errors = 0;

  for (const user of batch) {
    try {
      // Re-derive the entitled plan (column can lag prefs); only meter real veterans.
      if (getEffectiveEntitledPlan(user as any) !== 'veteran') continue;
      const prefs =
        user.preferences && typeof user.preferences === 'object'
          ? (user.preferences as Record<string, any>)
          : {};
      const subscriptionId = prefs.subscription_id;
      if (typeof subscriptionId !== 'string' || !subscriptionId) continue; // IAP-flat, unmetered

      const scopeOrgId = await resolveOwnerBillingOrgId(user.id);
      const snapshot = await getVeteranBillingSnapshot(user.id, scopeOrgId);

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (subscription.status !== 'active' && subscription.status !== 'trialing') continue;
      const item = subscription.items?.data?.[0];
      if (!item) continue;

      const decision = resolveVeteranQuantityReconciliation({
        currentQuantity: item.quantity ?? 0,
        activeProgramCount: snapshot.programCount,
      });

      if (decision.action === 'lower') {
        await stripe.subscriptionItems.update(item.id, { quantity: decision.targetQuantity });
        lowered += 1;
        console.warn(
          `[veteran-quantity-reconcile] lowered sub ${subscriptionId} quantity ${item.quantity} -> ${decision.targetQuantity} (programs ${snapshot.programCount})`
        );
      } else if (decision.action === 'flag_downgrade') {
        flagged += 1;
        captureMessage('veteran_billing_free_tier_downgrade_candidate', {
          level: 'warning',
          context: 'veteran_quantity_reconciliation',
          userId: user.id,
          subscriptionId,
          currentQuantity: item.quantity,
          activeProgramCount: snapshot.programCount,
        } as any);
      }
    } catch (err) {
      errors += 1;
      captureException(err instanceof Error ? err : new Error(String(err)), {
        context: 'veteran_quantity_reconciliation_owner_failed',
        userId: user.id,
      } as any);
    }
  }

  return {
    scanned: batch.length,
    lowered,
    flagged,
    errors,
    truncated,
    durationMs: Date.now() - startedAt,
  };
}
