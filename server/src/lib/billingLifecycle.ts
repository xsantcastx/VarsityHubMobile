import { createRequire } from 'node:module';
import type Stripe from 'stripe';
import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';
import { captureException } from './sentry.js';
import { invalidateMeCacheForUsers } from './userCache.js';
import { buildBillingStateColumns, mergeBillingStateIntoPreferences } from './userBillingState.js';

const require = createRequire(import.meta.url);
const StripeCtor = require('stripe') as typeof import('stripe').default;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecretKey
  ? new StripeCtor(stripeSecretKey, {
      apiVersion: '2024-06-20',
      timeout: 20000,
      maxNetworkRetries: 2,
    })
  : null;

const RECONCILE_LIMIT_DEFAULT = 500;

const ENTITLED_STRIPE_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
]);

const SUBSCRIPTION_STATUS_PRIORITY: Stripe.Subscription.Status[] = [
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'paused',
  'incomplete',
  'canceled',
  'incomplete_expired',
];

type StoredPrefs = Record<string, unknown>;

type BillingUserRecord = {
  id: string;
  stripe_customer_id: string | null;
  subscription_tier: string;
  subscription_status: string;
  preferences: unknown;
};

function getPrefsObject(preferences: unknown): StoredPrefs {
  return preferences && typeof preferences === 'object' && !Array.isArray(preferences)
    ? ({ ...(preferences as StoredPrefs) } as StoredPrefs)
    : {};
}

function getStoredSubscriptionId(preferences: unknown): string | null {
  const prefs = getPrefsObject(preferences);
  return typeof prefs.subscription_id === 'string' && prefs.subscription_id.trim()
    ? prefs.subscription_id.trim()
    : null;
}

function getStoredSubscriptionPeriodEnd(preferences: unknown): string | null {
  const prefs = getPrefsObject(preferences);
  return typeof prefs.subscription_period_end === 'string' && prefs.subscription_period_end.trim()
    ? prefs.subscription_period_end.trim()
    : null;
}

function getPlanFromPriceId(priceId: string | null | undefined): 'veteran' | 'legend' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_VETERAN) return 'veteran';
  if (priceId === process.env.STRIPE_PRICE_LEGEND) return 'legend';
  return null;
}

function getPlanFromTier(tier: string | null | undefined): 'veteran' | 'legend' | null {
  if (tier === 'premium') return 'veteran';
  if (tier === 'pro') return 'legend';
  return null;
}

function getPlanFromPrefs(preferences: unknown): 'veteran' | 'legend' | null {
  const prefs = getPrefsObject(preferences);
  if (prefs.plan === 'veteran') return 'veteran';
  if (prefs.plan === 'legend') return 'legend';
  return null;
}

function getTierFromPlan(plan: 'veteran' | 'legend' | null): 'free' | 'premium' | 'pro' {
  if (plan === 'veteran') return 'premium';
  if (plan === 'legend') return 'pro';
  return 'free';
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const statusMap: Record<Stripe.Subscription.Status, string> = {
    active: 'active',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    past_due: 'past_due',
    paused: 'paused',
    trialing: 'active',
    unpaid: 'unpaid',
  };
  return statusMap[status] || status;
}

function chooseBestSubscription(
  subscriptions: Stripe.ApiList<Stripe.Subscription>['data']
): Stripe.Subscription | null {
  if (!subscriptions.length) return null;
  const ranked = [...subscriptions].sort((a, b) => {
    const aRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(a.status);
    const bRank = SUBSCRIPTION_STATUS_PRIORITY.indexOf(b.status);
    if (aRank !== bRank) return aRank - bRank;
    return (b.current_period_end || 0) - (a.current_period_end || 0);
  });
  return ranked[0] || null;
}

function buildPaidPreferences(
  currentPrefs: StoredPrefs,
  plan: 'veteran' | 'legend',
  subscriptionId: string,
  currentPeriodEndIso: string | null
): StoredPrefs {
  const nextPrefs = mergeBillingStateIntoPreferences(currentPrefs, {
    plan,
    pending_plan: null,
    payment_pending: false,
    payment_approved: false,
  });
  nextPrefs.subscription_id = subscriptionId;
  if (currentPeriodEndIso) {
    nextPrefs.subscription_period_end = currentPeriodEndIso;
  } else {
    delete nextPrefs.subscription_period_end;
  }
  return nextPrefs;
}

function buildFreePreferences(currentPrefs: StoredPrefs): StoredPrefs {
  const nextPrefs = mergeBillingStateIntoPreferences(currentPrefs, {
    plan: 'rookie',
    pending_plan: null,
    payment_pending: false,
    payment_approved: false,
  });
  delete nextPrefs.subscription_id;
  delete nextPrefs.subscription_period_end;
  return nextPrefs;
}

async function retrieveSubscriptionSafe(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  if (!stripe) return null;
  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err: any) {
    if (err?.code === 'resource_missing' || err?.statusCode === 404) return null;
    throw err;
  }
}

async function retrieveCustomerSafe(
  customerId: string
): Promise<Stripe.Customer | Stripe.DeletedCustomer | null> {
  if (!stripe) return null;
  try {
    return await stripe.customers.retrieve(customerId);
  } catch (err: any) {
    if (err?.code === 'resource_missing' || err?.statusCode === 404) return null;
    throw err;
  }
}

async function listSubscriptionsForCustomer(customerId: string): Promise<Stripe.Subscription[]> {
  if (!stripe) return [];
  const response = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 100,
  });
  return response.data;
}

export async function cleanupStripeBillingForDeletedUser(params: {
  userId: string;
  stripeCustomerId?: string | null;
  subscriptionId?: string | null;
}): Promise<{
  customerDeleted: boolean;
  canceledSubscriptionIds: string[];
}> {
  const stripeCustomerId = params.stripeCustomerId?.trim() || null;
  const subscriptionId = params.subscriptionId?.trim() || null;

  if (!stripeCustomerId && !subscriptionId) {
    return { customerDeleted: false, canceledSubscriptionIds: [] };
  }

  if (!stripe) {
    const err = new Error('STRIPE_NOT_CONFIGURED_FOR_ACCOUNT_DELETION');
    captureException(err, {
      extra: { context: 'account_delete_billing_cleanup_missing_stripe', userId: params.userId },
    });
    throw err;
  }

  const subscriptionIdsToCancel = new Set<string>();
  if (subscriptionId) {
    subscriptionIdsToCancel.add(subscriptionId);
  }
  if (stripeCustomerId) {
    const subscriptions = await listSubscriptionsForCustomer(stripeCustomerId);
    for (const subscription of subscriptions) {
      subscriptionIdsToCancel.add(subscription.id);
    }
  }

  const canceledSubscriptionIds: string[] = [];
  for (const currentSubscriptionId of subscriptionIdsToCancel) {
    const subscription = await retrieveSubscriptionSafe(currentSubscriptionId);
    if (!subscription) continue;
    if (
      !ENTITLED_STRIPE_STATUSES.has(subscription.status) &&
      subscription.status !== 'incomplete'
    ) {
      continue;
    }
    // Immediate cancel with proration — account deletion is a "stop everything
    // now" event. `invoice_now: true` generates a prorated credit invoice for
    // the unused portion. Stripe will automatically refund if the customer's
    // default payment method is still on file.
    await stripe.subscriptions.cancel(subscription.id, {
      prorate: true,
      invoice_now: true,
    });
    canceledSubscriptionIds.push(subscription.id);
  }

  // Tombstone the Stripe customer rather than hard-deleting it. Full `del()`
  // destroys transaction history that we still need for chargeback/dispute
  // workflows in the 60-day window after deletion. Stripping PII (email, name,
  // address, phone) via `update()` satisfies GDPR pseudonymization while
  // retaining the audit trail. Hard delete is reserved for explicit Article 17
  // erasure requests, which would be a separate admin-facing path.
  let customerTombstoned = false;
  if (stripeCustomerId) {
    const customer = await retrieveCustomerSafe(stripeCustomerId);
    if (customer && !('deleted' in customer && customer.deleted)) {
      await stripe.customers.update(stripeCustomerId, {
        email: '',
        name: '',
        phone: '',
        address: {
          line1: '',
          line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: '',
        },
        metadata: {
          varsityhub_anonymized: 'true',
          varsityhub_deleted_at: new Date().toISOString(),
          varsityhub_original_user_id: params.userId,
        },
      });
      customerTombstoned = true;
    } else if (customer && 'deleted' in customer && customer.deleted) {
      customerTombstoned = true;
    }
  }

  debugLog('[billing-reconcile] Stripe billing cleaned up for account deletion', {
    userId: params.userId,
    stripeCustomerId,
    canceledSubscriptionIds,
    customerTombstoned,
  });

  // Back-compat field name: callers may still read `customerDeleted` even
  // though we tombstone rather than hard-delete.
  return {
    customerDeleted: customerTombstoned,
    canceledSubscriptionIds,
  };
}

async function applyReconciledState(
  user: BillingUserRecord,
  next: {
    stripeCustomerId: string | null;
    subscriptionTier: 'free' | 'premium' | 'pro';
    subscriptionStatus: string;
    preferences: StoredPrefs;
  }
): Promise<boolean> {
  const currentPrefs = getPrefsObject(user.preferences);
  const changed =
    user.stripe_customer_id !== next.stripeCustomerId ||
    user.subscription_tier !== next.subscriptionTier ||
    user.subscription_status !== next.subscriptionStatus ||
    JSON.stringify(currentPrefs) !== JSON.stringify(next.preferences);

  if (!changed) return false;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripe_customer_id: next.stripeCustomerId,
      subscription_tier: next.subscriptionTier,
      subscription_status: next.subscriptionStatus,
      preferences: next.preferences as any,
      ...buildBillingStateColumns({
        plan:
          next.subscriptionTier === 'pro'
            ? 'legend'
            : next.subscriptionTier === 'premium'
              ? 'veteran'
              : 'rookie',
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
      }),
    },
  });
  return true;
}

async function reconcileUserBillingState(user: BillingUserRecord): Promise<{
  updated: boolean;
  reason: string;
}> {
  const currentPrefs = getPrefsObject(user.preferences);
  const storedSubscriptionId = getStoredSubscriptionId(user.preferences);
  let stripeCustomerId = user.stripe_customer_id;

  if (!stripe) {
    return { updated: false, reason: 'stripe_not_configured' };
  }

  let subscription = storedSubscriptionId
    ? await retrieveSubscriptionSafe(storedSubscriptionId)
    : null;

  if (!subscription && stripeCustomerId) {
    const customer = await retrieveCustomerSafe(stripeCustomerId);
    if (!customer || ('deleted' in customer && customer.deleted)) {
      const updated = await applyReconciledState(user, {
        stripeCustomerId: null,
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
        preferences: buildFreePreferences(currentPrefs),
      });
      return { updated, reason: 'customer_missing' };
    }

    const subscriptions = await listSubscriptionsForCustomer(stripeCustomerId);
    subscription = chooseBestSubscription(subscriptions);
  }

  if (subscription) {
    stripeCustomerId =
      typeof subscription.customer === 'string' ? subscription.customer : stripeCustomerId;
    const priceId = subscription.items?.data?.[0]?.price?.id || null;
    const plan =
      getPlanFromPriceId(priceId) ||
      getPlanFromTier(user.subscription_tier) ||
      getPlanFromPrefs(user.preferences);
    const mappedStatus = mapStripeStatus(subscription.status);
    const currentPeriodEndIso = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : getStoredSubscriptionPeriodEnd(user.preferences);

    if (plan && ENTITLED_STRIPE_STATUSES.has(subscription.status)) {
      const updated = await applyReconciledState(user, {
        stripeCustomerId,
        subscriptionTier: getTierFromPlan(plan),
        subscriptionStatus: mappedStatus,
        preferences: buildPaidPreferences(currentPrefs, plan, subscription.id, currentPeriodEndIso),
      });
      return { updated, reason: 'subscription_synced' };
    }

    const updated = await applyReconciledState(user, {
      stripeCustomerId,
      subscriptionTier: 'free',
      subscriptionStatus: mappedStatus,
      preferences: buildFreePreferences(currentPrefs),
    });
    return { updated, reason: 'subscription_not_entitled' };
  }

  const updated = await applyReconciledState(user, {
    stripeCustomerId,
    subscriptionTier: 'free',
    subscriptionStatus:
      stripeCustomerId || storedSubscriptionId || user.subscription_tier !== 'free'
        ? 'canceled'
        : user.subscription_status,
    preferences: buildFreePreferences(currentPrefs),
  });
  return { updated, reason: stripeCustomerId ? 'no_subscription_found' : 'no_billing_identifiers' };
}

export async function runStripeSubscriptionReconciliation(
  limit = RECONCILE_LIMIT_DEFAULT
): Promise<{
  scanned: number;
  updated: number;
  failed: number;
}> {
  if (!stripe) {
    debugLog('[billing-reconcile] Stripe not configured, skipping subscription reconciliation');
    return { scanned: 0, updated: 0, failed: 0 };
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { stripe_customer_id: { not: null } },
        { subscription_tier: { in: ['premium', 'pro'] } },
        { subscription_status: { in: ['past_due', 'unpaid', 'paused', 'incomplete', 'canceled'] } },
      ],
    },
    select: {
      id: true,
      stripe_customer_id: true,
      subscription_tier: true,
      subscription_status: true,
      preferences: true,
    },
    take: limit,
    orderBy: { created_at: 'asc' },
  });

  let updated = 0;
  let failed = 0;
  const updatedIds: string[] = [];

  for (const user of users) {
    try {
      const result = await reconcileUserBillingState(user);
      if (result.updated) {
        updated += 1;
        updatedIds.push(user.id);
        debugLog('[billing-reconcile] Updated user billing state', {
          userId: user.id,
          reason: result.reason,
        });
      }
    } catch (error) {
      failed += 1;
      console.error('[billing-reconcile] Failed to reconcile user billing state', {
        userId: user.id,
        error: (error as any)?.message || error,
      });
      captureException(error instanceof Error ? error : new Error(String(error)), {
        extra: { context: 'stripe_subscription_reconciliation', userId: user.id },
      });
    }
  }

  if (updatedIds.length > 0) {
    await invalidateMeCacheForUsers(updatedIds);
  }

  return {
    scanned: users.length,
    updated,
    failed,
  };
}
