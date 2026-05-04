import {
  getCanonicalBillingState,
  getCanonicalPlan,
  getCanonicalPendingPlan,
  getEffectiveEntitledPlan,
} from '@/utils/billingState';

describe('billingState', () => {
  it('prefers top-level billing columns over preferences when both exist', () => {
    expect(
      getCanonicalBillingState({
        plan: 'legend',
        pending_plan: null,
        payment_pending: false,
        payment_approved: false,
        subscription_tier: 'free',
        preferences: {
          plan: 'rookie',
          pending_plan: 'veteran',
          payment_pending: true,
          payment_approved: true,
        },
      })
    ).toEqual({
      plan: 'legend',
      pending_plan: null,
      payment_pending: false,
      payment_approved: false,
      selected_plan: 'legend',
      effective_plan: 'legend',
    });
  });

  it('falls back to normalized preference values when billing columns are absent', () => {
    expect(
      getCanonicalBillingState({
        subscription_tier: 'premium',
        preferences: {
          plan: 'free',
          pending_plan: 'pro',
          payment_pending: true,
          payment_approved: false,
        },
      })
    ).toEqual({
      plan: 'rookie',
      pending_plan: 'legend',
      payment_pending: true,
      payment_approved: false,
      selected_plan: 'legend',
      effective_plan: 'rookie',
    });
  });

  it('uses subscription_tier as a last-resort plan fallback', () => {
    expect(getCanonicalPlan({ subscription_tier: 'premium' })).toBe('veteran');
    expect(getCanonicalPlan({ subscription_tier: 'pro' })).toBe('legend');
    expect(getCanonicalPlan({ subscription_tier: 'free' })).toBe('rookie');
  });

  it('returns null pending plan when no pending selection exists', () => {
    expect(getCanonicalPendingPlan({ plan: 'rookie', preferences: {} })).toBeNull();
  });

  it('treats payment-pending users as effectively rookie until payment clears', () => {
    expect(
      getEffectiveEntitledPlan({
        plan: 'veteran',
        payment_pending: true,
      })
    ).toBe('rookie');
  });
});
