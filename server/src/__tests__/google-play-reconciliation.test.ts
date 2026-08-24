import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUserFindMany = jest.fn();
const mockUserUpdate = jest.fn(async () => ({}));
const mockCaptureException = jest.fn();
const mockInvalidateMeCache = jest.fn(async () => undefined);
const mockHasVerifierConfig = jest.fn(() => true);
const mockVerifyPurchase = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      update: mockUserUpdate,
    },
  },
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: mockCaptureException,
}));

jest.unstable_mockModule('../lib/userCache.js', () => ({
  invalidateMeCacheForUser: mockInvalidateMeCache,
}));

// Matches the real default (payments.ts GOOGLE_ALLOWED_PACKAGES) — two
// packages, not one. A purchase token is only valid for the package it was
// issued against, so the loop querying a second package for the same token
// is the real-world shape that exposed the multi-package overwrite bug.
jest.unstable_mockModule('../routes/payments.js', () => ({
  GOOGLE_ALLOWED_PACKAGES: ['com.varsityhub.varsityhub', 'com.xsantcastx.varsityhub'],
  hasGooglePlayVerifierConfig: mockHasVerifierConfig,
  verifyGooglePurchaseWithPlayApi: mockVerifyPurchase,
}));

const { reconcileGooglePlaySubscriptions } = await import('../lib/googlePlayReconciliation.js');

const baseUser = {
  id: 'user-1',
  preferences: {
    subscription_platform: 'google',
    google_purchase_token: 'tok-1',
    google_product_id: 'veteran_monthly',
    google_expires_date: '2026-01-01T00:00:00.000Z',
  },
};

describe('reconcileGooglePlaySubscriptions', () => {
  beforeEach(() => {
    mockUserFindMany.mockReset();
    mockUserUpdate.mockReset();
    mockUserUpdate.mockResolvedValue({});
    mockCaptureException.mockReset();
    mockInvalidateMeCache.mockReset();
    mockHasVerifierConfig.mockReset();
    mockHasVerifierConfig.mockReturnValue(true);
    mockVerifyPurchase.mockReset();
  });

  it('does NOT downgrade on a transient Play API error (429/500/auth)', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({ verified: false, reason: 'google_play_api_429' });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(result.downgraded).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('does NOT downgrade when the verifier is unconfigured', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_verifier_not_configured',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(result.downgraded).toBe(0);
  });

  it('DOES downgrade on a genuinely expired subscription', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_subscription_expired',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate.mock.calls[0][0].data.subscription_tier).toBe('free');
    expect(result.downgraded).toBe(1);
  });

  it('DOES downgrade on a genuinely canceled subscription', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_subscription_canceled',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(result.downgraded).toBe(1);
  });

  it('a genuine expiry from the first package is not overwritten by a "wrong package" error from the second', async () => {
    // Regression: with 2 configured packages, the token issued for package 1
    // genuinely expired, but package 2 (the token is invalid there) returns
    // a 404 API error. Without an early-break on genuine expiry, the second
    // iteration's transient-looking error used to overwrite the first
    // iteration's definitive expiry signal, and the user was never
    // downgraded — silently defeating the whole point of this reconciliation
    // job for every user whose token belongs to the first-listed package.
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase
      .mockResolvedValueOnce({ verified: false, reason: 'google_subscription_expired' })
      .mockResolvedValueOnce({ verified: false, reason: 'google_play_api_404' });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockVerifyPurchase).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate.mock.calls[0][0].data.subscription_tier).toBe('free');
    expect(result.downgraded).toBe(1);
    expect(result.errors).toBe(0);
  });

  it('still refreshes expiry on a verified renewal (unchanged behavior)', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: true,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(result.refreshed).toBe(1);
    expect(result.downgraded).toBe(0);
  });
});
