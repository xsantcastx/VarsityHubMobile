import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const manageSubscription = read('app/settings/manage-subscription.tsx');
const subscriptionPaywall = read('app/subscription-paywall.tsx');
const adCalendar = read('app/ad-calendar.tsx');
const settingsScreen = read('app/settings/index.tsx');
const paymentCancel = read('app/payment-cancel.tsx');
const paymentSuccess = read('app/payment-success.tsx');
const adConfirmation = read('app/ad-confirmation.tsx');

describe('iap review ui guards', () => {
  it('settings uses canonical billing state to keep the billing entry point visible', () => {
    expect(settingsScreen).toContain(
      "import { getCanonicalBillingState } from '@/utils/billingState';"
    );
    expect(settingsScreen).toContain('const billingState = getCanonicalBillingState(me as any);');
    expect(settingsScreen).toContain('setPlan(billingState.selected_plan);');
  });

  it('manage subscription constrains content width for larger screens', () => {
    expect(manageSubscription).toContain('const isLargeScreen = width >= 768;');
    expect(manageSubscription).toContain('contentInnerLarge');
    expect(manageSubscription).toContain('maxWidth: 720');
    expect(manageSubscription).toContain('syncBillingState');
    expect(manageSubscription).toContain('checkAuth({ forceRefresh: options?.forceRefresh === true })');
  });

  it('subscription paywall constrains content width and keeps restore purchases visible', () => {
    expect(subscriptionPaywall).toContain('const isLargeScreen = width >= 768;');
    expect(subscriptionPaywall).toContain('contentInnerLarge');
    expect(subscriptionPaywall).toContain('maxWidth: 860');
    expect(subscriptionPaywall).toContain('Restore Purchases');
    expect(subscriptionPaywall).toContain('getFreshAuthSnapshot');
  });

  it('ad calendar constrains content width for larger screens', () => {
    expect(adCalendar).toContain('const isLargeScreen = width >= 768;');
    expect(adCalendar).toContain('contentInnerLarge');
    expect(adCalendar).toContain('maxWidth: 860');
    expect(adCalendar).toContain('All Sales Final');
  });

  it('payment cancel keeps post-checkout copy readable on iPad and avoids light-only text colors', () => {
    expect(paymentCancel).toContain('const isLargeScreen = width >= 768;');
    expect(paymentCancel).toContain('contentInnerLarge');
    expect(paymentCancel).toContain('maxWidth: 560');
    expect(paymentCancel).not.toContain('Colors.light.mutedText');
  });

  it('payment success constrains post-purchase content width for larger screens', () => {
    expect(paymentSuccess).toContain('const isLargeScreen = width >= 768;');
    expect(paymentSuccess).toContain('contentInnerLarge');
    expect(paymentSuccess).toContain('maxWidth: 860');
    expect(paymentSuccess).not.toContain("we'll keep verifying in the background");
  });

  it('ad confirmation constrains content width and avoids light-only neutral surfaces', () => {
    expect(adConfirmation).toContain('const isLargeScreen = width >= 768;');
    expect(adConfirmation).toContain('contentInnerLarge');
    expect(adConfirmation).toContain('maxWidth: 860');
    expect(adConfirmation).not.toContain("backgroundColor: '#f0f0f0'");
  });
});
