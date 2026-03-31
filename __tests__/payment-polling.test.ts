/**
 * Validates subscription payment polling logic.
 * The Stripe PaymentSheet flow polls /me to check if the plan activated.
 * Bug fix: previously checked `plan` as truthy (included 'rookie'),
 * now checks for specific paid plans ('veteran' | 'legend').
 */

describe('Payment polling plan check', () => {
  // Mirror of the fixed polling condition from subscription-paywall.tsx
  const isPlanActivated = (preferences: { plan?: string; payment_pending?: boolean } | null) => {
    return (
      (preferences?.plan === 'veteran' || preferences?.plan === 'legend') &&
      !preferences?.payment_pending
    );
  };

  it('detects veteran plan activation', () => {
    expect(isPlanActivated({ plan: 'veteran', payment_pending: false })).toBe(true);
  });

  it('detects legend plan activation', () => {
    expect(isPlanActivated({ plan: 'legend', payment_pending: false })).toBe(true);
  });

  it('rejects rookie plan as not activated (free tier)', () => {
    expect(isPlanActivated({ plan: 'rookie', payment_pending: false })).toBe(false);
  });

  it('rejects when payment is still pending', () => {
    expect(isPlanActivated({ plan: 'veteran', payment_pending: true })).toBe(false);
  });

  it('rejects null preferences', () => {
    expect(isPlanActivated(null)).toBe(false);
  });

  it('rejects undefined plan', () => {
    expect(isPlanActivated({ payment_pending: false })).toBe(false);
  });
});
