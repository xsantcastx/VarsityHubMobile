/**
 * Single source of truth for "does this Stripe subscription webhook apply to the
 * user's currently-active entitlement?". Used by customer.subscription.deleted
 * and invoice.payment_failed so a stale/old-subscription event cannot downgrade
 * a user whose live entitlement comes from a different Stripe sub or a migrated
 * Apple/Google IAP rail. See stripe-subscription-guard.test.ts.
 */
export function shouldApplyStripeSubscriptionEvent(
  prefs: Record<string, unknown> | null | undefined,
  eventSubscriptionId: string | null | undefined
): boolean {
  const p = (prefs && typeof prefs === 'object' ? prefs : {}) as Record<string, unknown>;

  // The user has moved to a non-Stripe rail — a Stripe event is stale, even if
  // the old Stripe subscription_id is still lingering in prefs.
  if (p.subscription_platform === 'apple' || p.subscription_platform === 'google') return false;
  if (p.apple_expires_date || p.apple_product_id || p.apple_original_transaction_id) return false;
  if (p.google_purchase_token || p.google_expires_date) return false;

  // Same rail: only the user's ACTIVE stored subscription may mutate entitlement.
  // If the event carries a subscription id that contradicts the stored one, it
  // is an old/other subscription and must be ignored.
  const storedId = typeof p.subscription_id === 'string' ? p.subscription_id : null;
  if (storedId && eventSubscriptionId && storedId !== eventSubscriptionId) return false;

  return true;
}
