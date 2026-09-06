/**
 * Google Play subscription reconciliation.
 *
 * Google Play does not send us server-to-server renewal notifications (no RTDN
 * webhook exists yet), so a Google subscriber's stored expiry is never refreshed
 * on renewal and never lapses on cancel. The 2026-07-14 audit found this let
 * Google entitlements live forever.
 *
 * This job periodically re-verifies each active Google subscriber's purchase
 * token against the Play Developer API (the same call the purchase endpoint
 * uses) and:
 *   - extends google_expires_date when the subscription has renewed, so the
 *     read-side expiry safety-net (middleware/subscription.ts) does not
 *     wrongly downgrade a paying renewing user;
 *   - downgrades to rookie when the store reports the subscription expired or
 *     cancelled.
 *
 * It reuses the payment service verifier so there is a single source of truth
 * for Google verify without importing the HTTP route module.
 */

import { prisma } from './prisma.js';
import { captureException } from './sentry.js';
import { buildBillingStateColumns, mergeBillingStateIntoPreferences } from './userBillingState.js';
import { invalidateMeCacheForUser } from './userCache.js';
import {
  GOOGLE_ALLOWED_PACKAGES,
  hasGooglePlayVerifierConfig,
  verifyGooglePurchaseWithPlayApi,
} from '../services/payments/googlePlayVerifier.js';

const BATCH_LIMIT = 200;

export type GooglePlayReconciliationResult = {
  checked: number;
  refreshed: number;
  downgraded: number;
  skipped: number;
  errors: number;
  durationMs: number;
};

export async function reconcileGooglePlaySubscriptions(): Promise<GooglePlayReconciliationResult> {
  const startedAt = Date.now();
  let checked = 0;
  let refreshed = 0;
  let downgraded = 0;
  let skipped = 0;
  let errors = 0;

  if (!hasGooglePlayVerifierConfig()) {
    // No credentials → we cannot safely re-verify. Do nothing rather than guess.
    return { checked, refreshed, downgraded, skipped, errors, durationMs: Date.now() - startedAt };
  }

  const subscribers = await prisma.user.findMany({
    where: {
      subscription_status: 'active',
      preferences: { path: ['subscription_platform'], equals: 'google' },
    },
    select: { id: true, preferences: true },
    take: BATCH_LIMIT,
  });

  for (const user of subscribers) {
    checked++;
    const prefs =
      user.preferences && typeof user.preferences === 'object'
        ? (user.preferences as Record<string, any>)
        : {};
    const purchaseToken =
      typeof prefs.google_purchase_token === 'string' ? prefs.google_purchase_token : null;
    const productId = typeof prefs.google_product_id === 'string' ? prefs.google_product_id : null;
    if (!purchaseToken || !productId) {
      skipped++;
      continue;
    }

    try {
      // Try each configured package name until one verifies (usually just one).
      let verified: Awaited<ReturnType<typeof verifyGooglePurchaseWithPlayApi>> | null = null;
      for (const packageName of GOOGLE_ALLOWED_PACKAGES) {
        const result = await verifyGooglePurchaseWithPlayApi({
          packageName,
          productId,
          purchaseToken,
        });
        verified = result;
        if (result.verified) break;
      }

      if (verified && verified.verified) {
        // Renewed / still active — refresh the stored expiry.
        const nextExpiry = verified.expiresAt;
        if (nextExpiry && prefs.google_expires_date !== nextExpiry) {
          const nextPrefs = { ...prefs, google_expires_date: nextExpiry };
          await prisma.user.update({
            where: { id: user.id },
            data: { preferences: nextPrefs as any },
          });
          await invalidateMeCacheForUser(user.id);
          refreshed++;
        }
      } else {
        // Store says expired/cancelled/unknown — downgrade to rookie.
        const { google_purchase_token, google_product_id, google_expires_date, ...restPrefs } =
          prefs;
        void google_purchase_token;
        void google_product_id;
        void google_expires_date;
        const nextPrefs = mergeBillingStateIntoPreferences(restPrefs, {
          plan: 'rookie',
          pending_plan: null,
          payment_pending: false,
          payment_approved: false,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            preferences: nextPrefs as any,
            ...buildBillingStateColumns({
              plan: 'rookie',
              pending_plan: null,
              payment_pending: false,
              payment_approved: false,
            }),
            subscription_tier: 'free',
            subscription_status: 'canceled',
          },
        });
        await invalidateMeCacheForUser(user.id);
        downgraded++;
        console.warn(
          `[google-play-reconcile] downgraded user=${user.id} reason=${(verified as any)?.reason ?? 'unverified'}`
        );
      }
    } catch (error) {
      errors++;
      captureException(error instanceof Error ? error : new Error(String(error)), {
        context: 'google_play_reconciliation',
        user_id: user.id,
      });
      console.error(`[google-play-reconcile] error user=${user.id}`, error);
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[google-play-reconcile] checked=${checked} refreshed=${refreshed} downgraded=${downgraded} skipped=${skipped} errors=${errors} duration_ms=${durationMs}`
  );
  return { checked, refreshed, downgraded, skipped, errors, durationMs };
}
