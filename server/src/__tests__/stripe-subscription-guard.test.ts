/**
 * Phase 1c authority: a Stripe subscription webhook (deleted / payment_failed)
 * must only mutate entitlement for the user's CURRENTLY-ACTIVE Stripe
 * subscription. The 2026-07-14 audit found the handlers matched by
 * stripe_customer_id only, so:
 *   - deleting an OLD Stripe sub after an upgrade downgraded the user on the NEW sub
 *   - a user who migrated to Apple/Google IAP (but kept the old Stripe
 *     subscription_id in prefs) got downgraded when Stripe deleted the stale sub
 *
 * shouldApplyStripeSubscriptionEvent is the single source of truth for "does
 * this Stripe event apply to this user's live entitlement".
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldApplyStripeSubscriptionEvent } from '../lib/stripeSubscriptionGuard.js';

describe('the guard is wired into every write path that can mutate entitlement from a Stripe event', () => {
  const paymentsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'payments.ts'), 'utf8');
  const internalsSrc = readFileSync(
    join(process.cwd(), 'src', 'lib', 'paymentInternals.ts'),
    'utf8'
  );

  it('customer.subscription.deleted and invoice.payment_failed both call the guard', () => {
    const calls = paymentsSrc.match(/shouldApplyStripeSubscriptionEvent\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('syncStripeSubscriptionState (the customer.subscription.updated write path) calls the guard', () => {
    const calls = internalsSrc.match(/shouldApplyStripeSubscriptionEvent\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('shouldApplyStripeSubscriptionEvent', () => {
  it("applies when the event is for the user's active Stripe subscription", () => {
    expect(shouldApplyStripeSubscriptionEvent({ subscription_id: 'sub_A' }, 'sub_A')).toBe(true);
  });

  it('applies for a plain Stripe user with no stored subscription id (legit cancel)', () => {
    expect(shouldApplyStripeSubscriptionEvent({}, 'sub_A')).toBe(true);
  });

  it('SKIPS when the event is for a different (old) Stripe subscription', () => {
    expect(shouldApplyStripeSubscriptionEvent({ subscription_id: 'sub_NEW' }, 'sub_OLD')).toBe(
      false
    );
  });

  it('SKIPS when the user has migrated to Apple (apple_expires_date present)', () => {
    expect(
      shouldApplyStripeSubscriptionEvent(
        { subscription_id: 'sub_OLD', apple_expires_date: '2099-01-01T00:00:00Z' },
        'sub_OLD'
      )
    ).toBe(false);
  });

  it('SKIPS when the user has an Apple product id (migrated rail)', () => {
    expect(
      shouldApplyStripeSubscriptionEvent(
        { subscription_id: 'sub_OLD', apple_product_id: 'com.vh.veteran' },
        'sub_OLD'
      )
    ).toBe(false);
  });

  it('SKIPS when the user is on the Google rail', () => {
    expect(
      shouldApplyStripeSubscriptionEvent(
        { subscription_platform: 'google', google_purchase_token: 'tok' },
        'sub_OLD'
      )
    ).toBe(false);
  });

  it('applies when no subscription id is on the event but the user is pure Stripe', () => {
    expect(shouldApplyStripeSubscriptionEvent({ subscription_id: 'sub_A' }, null)).toBe(true);
  });
});
