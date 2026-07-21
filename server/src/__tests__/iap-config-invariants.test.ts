/**
 * IAP product configuration invariants.
 *
 * These checks pin the subscription product IDs across client, server, and the
 * main operator docs so setup instructions cannot drift away from the live code.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  WEEKDAY_BLOCK_PRICE_CENTS,
  WEEKEND_BLOCK_PRICE_CENTS,
} from '../utils/adPricing.js';

const SERVER_ROOT = process.cwd();
const REPO_ROOT = join(SERVER_ROOT, '..');

const read = (...parts: string[]) => readFileSync(join(...parts), 'utf8');

const payments = read(SERVER_ROOT, 'src', 'routes', 'payments.ts');
const paymentInternals = read(SERVER_ROOT, 'src', 'lib', 'paymentInternals.ts');
const appleIapReconciliation = read(SERVER_ROOT, 'src', 'lib', 'appleIapReconciliation.ts');
const adPricing = read(SERVER_ROOT, 'src', 'utils', 'adPricing.ts');
const env = read(SERVER_ROOT, 'src', 'lib', 'env.ts');
const clientIap = read(REPO_ROOT, 'hooks', 'useIAP.ts');
const clientIapWeb = read(REPO_ROOT, 'hooks', 'useIAP.web.ts');
const clientAdIap = read(REPO_ROOT, 'hooks', 'useAdIAP.ts');
const clientAdIapWeb = read(REPO_ROOT, 'hooks', 'useAdIAP.web.ts');
const adCalendarScreen = read(REPO_ROOT, 'app', 'ad-calendar.tsx');
const adPricingUtil = read(SERVER_ROOT, 'src', 'utils', 'adPricing.ts');
const preReleaseDoc = read(REPO_ROOT, 'docs', 'PRE_RELEASE_CONFIG_VERIFICATION.md');
const externalSetupDoc = read(REPO_ROOT, 'docs', 'EXTERNAL_SETUP_GUIDE.md');
const appStoreDoc = read(REPO_ROOT, 'docs', 'BEFORE_APP_STORE_SUBMISSION.md');
const adIapDoc = read(REPO_ROOT, 'docs', 'AD_IAP_VERIFICATION_CHECKLIST.md');
const auditSummaryDoc = read(REPO_ROOT, 'docs', 'AUDIT_SUMMARY_AND_USER_ACTIONS.md');
const fullUatDoc = read(REPO_ROOT, 'docs', 'FULL_UAT_CHECKLIST.md');
const stripePricingDoc = read(REPO_ROOT, 'docs', 'STRIPE_PRICING_CONFIG.md');

describe('IAP product configuration invariants', () => {
  it('client subscription hooks use MIDTIER/TOPTIER product IDs', () => {
    expect(clientIap).toMatch(/veteran:\s*'MIDTIER'/);
    expect(clientIap).toMatch(/legend:\s*'TOPTIER'/);
    expect(clientIapWeb).toMatch(/veteran:\s*'MIDTIER'/);
    expect(clientIapWeb).toMatch(/legend:\s*'TOPTIER'/);
  });

  it('server maps MIDTIER/TOPTIER for Apple and Google subscription verification', () => {
    expect(paymentInternals).toMatch(
      /export const APPLE_PRODUCT_TO_PLAN[\s\S]*MIDTIER:\s*'veteran'/
    );
    expect(paymentInternals).toMatch(
      /export const APPLE_PRODUCT_TO_PLAN[\s\S]*TOPTIER:\s*'legend'/
    );
    // Google reuses the one canonical Apple map — no second literal that can drift.
    expect(payments).toMatch(/const GOOGLE_PRODUCT_TO_PLAN[^\n]*=\s*APPLE_PRODUCT_TO_PLAN/);
  });

  it('reconciliation reverse map is derived by inverting the canonical map (cannot drift)', () => {
    expect(appleIapReconciliation).toMatch(
      /const APPLE_PLAN_TO_PRODUCT[\s\S]*Object\.fromEntries[\s\S]*APPLE_PRODUCT_TO_PLAN/
    );
    // No hand-maintained literal SKUs in the reverse map.
    expect(appleIapReconciliation).not.toMatch(/APPLE_PLAN_TO_PRODUCT[\s\S]*'MIDTIER'/);
  });

  it('client and server ad IAP hooks use MOND_THURS/FRI_SUN product IDs', () => {
    expect(clientAdIap).toMatch(/weekday:\s*'MOND_THURS'/);
    expect(clientAdIap).toMatch(/weekend:\s*'FRI_SUN'/);
    expect(clientAdIapWeb).toMatch(/weekday:\s*'MOND_THURS'/);
    expect(clientAdIapWeb).toMatch(/weekend:\s*'FRI_SUN'/);
    expect(payments).toMatch(/const APPLE_AD_PRODUCTS = \['MOND_THURS', 'FRI_SUN'\]/);
    // Apple ad-IAP cents are derived from the single ad-pricing source so the
    // Apple and Stripe/Android ad prices cannot diverge.
    expect(paymentInternals).toMatch(
      /export const AD_PRODUCT_CENTS[\s\S]*MOND_THURS:\s*WEEKDAY_BLOCK_PRICE_CENTS/
    );
    expect(paymentInternals).toMatch(
      /export const AD_PRODUCT_CENTS[\s\S]*FRI_SUN:\s*WEEKEND_BLOCK_PRICE_CENTS/
    );
    // The canonical ad-price source still pins the real dollar amounts.
    expect(adPricing).toMatch(/WEEKDAY_BLOCK_PRICE\s*=\s*4\.99/);
    expect(adPricing).toMatch(/WEEKEND_BLOCK_PRICE\s*=\s*7\.99/);
  });

  it('client IAP hooks read the store product identifier via `id` (react-native-iap v14), not productId-only', () => {
    // react-native-iap v14 (Nitro rewrite) exposes fetched Product objects with
    // `id`, not `productId` (only Purchase objects keep `productId`). Reading
    // `.productId` off products makes the available-products list always empty,
    // which surfaces to users as "Apple ad products unavailable for this build".
    // Guard against regressing back to a productId-only read on the product list.
    expect(clientAdIap).toMatch(/product\?\.id \?\? product\?\.productId/);
    expect(clientAdIap).not.toMatch(
      /typeof product\?\.productId === 'string' \? product\.productId/
    );
    expect(clientIap).toMatch(/planSkus\.includes\(p\.id \?\? p\.productId \?\? ''\)/);
  });

  it('client ad dollar prices, server adPricing util, and AD_PRODUCT_CENTS stay pinned together', () => {
    expect(adCalendarScreen).toMatch(/const weekdayRate = 4\.99;/);
    expect(adCalendarScreen).toMatch(/const weekendRate = 7\.99;/);
    expect(adPricingUtil).toMatch(/const WEEKDAY_BLOCK_PRICE = 4\.99;/);
    expect(adPricingUtil).toMatch(/const WEEKEND_BLOCK_PRICE = 7\.99;/);
    // 4.99 * 100 = 499 cents (MOND_THURS), 7.99 * 100 = 799 cents (FRI_SUN).
    // AD_PRODUCT_CENTS derives from these canonical constants (asserted in the
    // ad IAP hooks test above), so pinning the runtime cents pins the map too.
    expect(WEEKDAY_BLOCK_PRICE_CENTS).toBe(499);
    expect(WEEKEND_BLOCK_PRICE_CENTS).toBe(799);
  });

  it('ad booking horizon of 56 days is pinned across the client calendar and both server checks', () => {
    expect(adCalendarScreen).toMatch(/56 \* DAY_MS/);
    expect(adCalendarScreen).toMatch(/8 weeks/);
    const serverHorizonMatches = payments.match(/MAX_BOOKING_HORIZON_DAYS = 56/g) || [];
    expect(serverHorizonMatches.length).toBe(2);
  });

  it('mobile ad checkout uses Apple IAP on iOS and Stripe PaymentSheet elsewhere', () => {
    expect(adCalendarScreen).toMatch(/if \(Platform\.OS === 'ios'\)/);
    expect(adCalendarScreen).toMatch(
      /const result = await purchaseAd\(\{\s*adId: String\(adId\),\s*dates,\s*weekdayBlocks,\s*weekendBlocks,?\s*\}\)/
    );
    expect(adCalendarScreen).toMatch(
      /httpPost\('\/payments\/create-payment-sheet', \{\s*ad_id: String\(adId\),\s*dates,\s*promo_code: promo \|\| undefined,?\s*\}\)/
    );
    expect(adCalendarScreen).toMatch(/const \{ error \} = await presentPaymentSheet\(\)/);
  });

  it('operator docs reference MIDTIER/TOPTIER and not stale legacy SKUs', () => {
    for (const doc of [preReleaseDoc, externalSetupDoc, appStoreDoc]) {
      expect(doc).toMatch(/MIDTIER/);
      expect(doc).toMatch(/TOPTIER/);
      expect(doc).not.toMatch(/veteran_vhub/i);
      expect(doc).not.toMatch(/legend_vhub/i);
    }
  });

  it('operator docs reference MOND_THURS/FRI_SUN and not stale ad SKUs', () => {
    for (const doc of [adIapDoc, auditSummaryDoc, externalSetupDoc]) {
      expect(doc).toMatch(/MOND_THURS/);
      expect(doc).toMatch(/FRI_SUN/);
      expect(doc).not.toMatch(/ad_weekday_vhub/i);
      expect(doc).not.toMatch(/ad_weekend_vhub/i);
    }
  });

  it('operator docs describe Android ad checkout as Stripe-based, not Play IAP', () => {
    expect(externalSetupDoc).toMatch(/Android ad bookings use Stripe PaymentSheet/i);
    expect(externalSetupDoc).toMatch(
      /Do \*\*not\*\* create `MOND_THURS` or `FRI_SUN` in Google Play Console/i
    );
    expect(adIapDoc).toMatch(/iOS-only checklist/i);
    expect(adIapDoc).toMatch(/Android ad bookings use Stripe PaymentSheet/i);
    expect(fullUatDoc).toMatch(
      /iOS ad checkout uses Apple IAP only for `MOND_THURS` and `FRI_SUN`/i
    );
    expect(fullUatDoc).toMatch(
      /Android ad checkout uses Stripe PaymentSheet and does not depend on Play ad IAP SKUs/i
    );
    expect(stripePricingDoc).toMatch(
      /These Stripe ad prices are used by Android and non-iOS checkout paths/i
    );
    expect(stripePricingDoc).toMatch(
      /On iOS, ad booking uses Apple IAP product IDs `MOND_THURS` and `FRI_SUN`/i
    );
  });

  it('production env validation hard-fails if APPLE_BUNDLE_ID is missing', () => {
    expect(env).toMatch(/if \(!env\.APPLE_BUNDLE_ID\)/);
    expect(env).toMatch(/App Review, TestFlight, and live iOS purchases/);
  });

  it('Apple JWS verification does not reject sandbox transactions in production', () => {
    expect(payments).not.toMatch(/Sandbox Apple transaction rejected in production/);
    expect(payments).toMatch(/Unexpected Apple transaction environment/);
  });
});
