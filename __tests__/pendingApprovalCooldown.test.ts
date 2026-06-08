import {
  formatCoachReapplyCooldown,
  getCoachReapplyCooldownState,
} from '@/hooks/usePendingApprovalFlow';

describe('pending approval cooldown helpers', () => {
  it('marks the reapply cooldown active for 48 hours after rejection', () => {
    const rejectedAt = '2026-06-08T12:00:00.000Z';
    const nowMs = new Date('2026-06-09T11:00:00.000Z').getTime();

    const result = getCoachReapplyCooldownState(rejectedAt, nowMs);

    expect(result.isActive).toBe(true);
    expect(result.retryAt?.toISOString()).toBe('2026-06-10T12:00:00.000Z');
    expect(formatCoachReapplyCooldown(result.remainingMs)).toBe('25h');
  });

  it('marks the cooldown inactive once the retry window has passed', () => {
    const rejectedAt = '2026-06-08T12:00:00.000Z';
    const nowMs = new Date('2026-06-10T12:00:01.000Z').getTime();

    const result = getCoachReapplyCooldownState(rejectedAt, nowMs);

    expect(result.isActive).toBe(false);
    expect(result.remainingMs).toBe(0);
  });

  it('returns an inactive cooldown when the rejection timestamp is missing', () => {
    const result = getCoachReapplyCooldownState(null);

    expect(result.isActive).toBe(false);
    expect(result.retryAt).toBeNull();
  });
});
