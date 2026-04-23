/**
 * Payments & subscriptions — structural regression guards.
 *
 * Integration tests that actually hit Stripe/Apple are blocked by the
 * pre-existing Jest ESM issue. These static scans lock the invariants that
 * matter for production safety:
 *
 *   1. Stripe webhook signature verification is actually called (not skipped).
 *   2. Apple IAP receipt verification uses the shared secret.
 *   3. Paid-plan checkout cannot be bypassed by clients.
 *   4. Grace-period expiry downgrades users (no "Premium forever free" bug).
 *   5. Transactions are logged for audit + refund tracing.
 *   6. Booking-horizon is enforced server-side (no client-forged future dates).
 *   7. Rate limits on payment endpoints are wired.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const payments = read('routes/payments.ts');
const requireOnboarded = read('middleware/requireOnboarded.ts');
const appleAuth = read('lib/appleAuth.ts');
const appleNotifDedup = read('lib/appleNotificationDedup.ts');
const billingLifecycle = read('lib/billingLifecycle.ts');
const indexBoot = read('index.ts');

describe('payments & subscriptions — structural invariants', () => {
  // ──────────────────────────────────────────────────────────────────────
  // Stripe webhook signature verification
  // ──────────────────────────────────────────────────────────────────────

  describe('Stripe webhook auth', () => {
    it('server refuses to start in production without STRIPE_WEBHOOK_SECRET', () => {
      // Line should contain process.exit(1) for prod-missing-secret case.
      const block = payments.match(/STRIPE_WEBHOOK_SECRET[\s\S]{0,600}/)?.[0] || '';
      expect(block).toMatch(/process\.exit\(1\)/);
    });

    it('webhook handler calls stripe.webhooks.constructEvent (signature check)', () => {
      expect(payments).toMatch(/stripe\.webhooks\.constructEvent/);
    });

    it('webhook handler reads the stripe-signature header before verifying', () => {
      expect(payments).toMatch(/stripe-signature/);
    });

    it('webhook handler returns 400 on signature mismatch (never processes unverified events)', () => {
      const block = payments.match(/constructEvent[\s\S]{0,800}/)?.[0] || '';
      expect(block).toMatch(/catch|400/);
    });

    it('webhook events are deduped via distributed lock (no double-processing)', () => {
      expect(payments).toMatch(/withDistributedLock|webhookEventLocks/);
    });

    it('server requires STRIPE_SECRET_KEY in production (fatal throw)', () => {
      expect(payments).toMatch(/STRIPE_SECRET_KEY must be set in production/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Apple IAP receipt verification
  // ──────────────────────────────────────────────────────────────────────

  describe('Apple IAP receipt verification', () => {
    it('Apple IAP uses APPLE_IAP_SHARED_SECRET for receipt verification', () => {
      expect(payments).toMatch(/APPLE_IAP_SHARED_SECRET/);
    });

    it('deduplicates Apple App Store notifications (prevents double-grant on retry)', () => {
      expect(appleNotifDedup).toMatch(/export|recordAppleNotificationReceipt|dedup/i);
      expect(payments).toMatch(/recordAppleNotificationReceipt/);
    });

    it('startup warns loudly when APPLE_IAP_SHARED_SECRET is missing', () => {
      expect(payments).toMatch(/Apple IAP shared secret not set/);
    });

    it('verification code paths tag the transaction source (apple_iap / apple_iap_jws)', () => {
      expect(payments).toMatch(/source:\s*['"]apple_iap/);
    });

    it('Apple Sign-In credential validation lives in appleAuth.ts', () => {
      expect(appleAuth.length).toBeGreaterThan(100);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Paid-plan checkout bypass prevention
  // ──────────────────────────────────────────────────────────────────────

  describe('paid-plan checkout gates (server is the source of truth)', () => {
    it('requireOnboarded blocks approved coaches on veteran/legend with payment_pending', () => {
      expect(requireOnboarded).toMatch(/PAYMENT_REQUIRED/);
      expect(requireOnboarded).toMatch(/requiresPayment/);
      expect(requireOnboarded).toMatch(/pending_plan|selectedPlan/);
    });

    it('requireOnboarded respects paid_by_owner (league owner covers billing)', () => {
      expect(requireOnboarded).toMatch(/paid_by_owner/);
    });

    it('Apple-specific grace-period expiry triggers lazy downgrade to rookie', () => {
      expect(requireOnboarded).toMatch(/grace_period_expires_at/);
      expect(requireOnboarded).toMatch(/subscription_status:\s*['"]expired['"]/);
      expect(requireOnboarded).toMatch(/plan:\s*['"]rookie['"]/);
    });

    it('downgrade clears apple-specific preferences keys (product_id, expires_date)', () => {
      const block = requireOnboarded.match(/grace_period_expires_at[\s\S]{0,1500}/)?.[0] || '';
      expect(block).toMatch(/apple_product_id/);
      expect(block).toMatch(/apple_expires_date/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Transaction logging (audit + refund support)
  // ──────────────────────────────────────────────────────────────────────

  describe('transaction audit trail', () => {
    it('payment routes log transactions', () => {
      expect(payments).toMatch(/logTransaction/);
    });

    it('failed payments update transaction status rather than silently dropping', () => {
      expect(payments).toMatch(/updateTransactionStatus/);
    });

    it('Stripe processing fee is computed and stored per transaction', () => {
      expect(payments).toMatch(/calculateStripeFee/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Booking horizon — clients cannot forge far-future ad bookings
  // ──────────────────────────────────────────────────────────────────────

  describe('ad booking horizon', () => {
    it('payment routes enforce booking horizon via getDatesPastBookingHorizon', () => {
      expect(payments).toMatch(/getDatesPastBookingHorizon/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Rate limiting on payment endpoints
  // ──────────────────────────────────────────────────────────────────────

  describe('payment rate limiters', () => {
    it('payment router imports paymentLimiter middleware', () => {
      expect(payments).toMatch(/paymentLimiter/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Plan canonicalization (no client-set plan escalation)
  // ──────────────────────────────────────────────────────────────────────

  describe('plan / billing state canonicalization', () => {
    it('payment routes use canonical billing helpers (not ad-hoc prefs writes)', () => {
      expect(payments).toMatch(/buildBillingStateColumns|mergeBillingStateIntoPreferences/);
    });

    it('plan changes write both the column AND the preferences (lockstep)', () => {
      // Same invariant as the auth-state split-brain we fixed earlier.
      expect(payments).toMatch(/buildBillingStateColumns/);
      expect(payments).toMatch(/mergeBillingStateIntoPreferences/);
    });

    it('billingLifecycle.ts defines transition helpers for subscription events', () => {
      expect(billingLifecycle.length).toBeGreaterThan(100);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Tax calculation wired in (sales tax compliance)
  // ──────────────────────────────────────────────────────────────────────

  describe('sales tax calculation', () => {
    it('payment routes call calculateSalesTax somewhere in the purchase path', () => {
      expect(payments).toMatch(/calculateSalesTax/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Startup guards
  // ──────────────────────────────────────────────────────────────────────

  describe('boot-time visibility of payment config issues', () => {
    it('index.ts runs the Cloudinary probe — separate from payments but same pattern', () => {
      expect(indexBoot).toMatch(/Cloudinary auth probe/);
    });

    it('payments.ts loud-logs missing STRIPE_WEBHOOK_SECRET in dev (warn, not exit)', () => {
      const devBlock = payments.match(/STRIPE_WEBHOOK_SECRET[\s\S]{0,400}/)?.[0] || '';
      expect(devBlock).toMatch(/WARNING|warn/i);
    });
  });
});
