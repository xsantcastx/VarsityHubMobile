/**
 * Phase 1d: Google Play subscriptions must expire server-side. The 2026-07-14
 * audit found the verify handler computed expiry then discarded it, no field in
 * the read-side expiry chain, and no reconciliation job — so Google entitlements
 * lived forever. These contracts pin all three parts of the fix.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(process.cwd(), 'src', ...p), 'utf8');

describe('google play expiry — persist', () => {
  it('verify-purchase persists google_expires_date from the store', () => {
    const src = read('routes', 'payments.ts');
    expect(src).toMatch(/google_expires_date/);
  });
});

describe('google play expiry — enforce (read side)', () => {
  it('subscription.ts includes google_expires_date in the expiry chain', () => {
    const src = read('middleware', 'subscription.ts');
    expect(src).toMatch(/prefs\.google_expires_date/);
  });
});

describe('google play expiry — reconciliation job (refresh on renewal / downgrade on lapse)', () => {
  it('a google-play-reconciliation job is registered in the scheduler', () => {
    const src = read('jobs', 'scheduler.ts');
    expect(src).toMatch(/google-play-reconciliation/);
    expect(src).toMatch(/reconcileGooglePlaySubscriptions/);
  });
});
