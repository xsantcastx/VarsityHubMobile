/**
 * Phase 4 client billing guard: the Veteran plan's Stripe subscription
 * quantity must only be updated on the Stripe-metered rail
 * (`/teams/limits` -> `metered: true`). IAP veterans (Apple/Google — no
 * Stripe subscription to meter) are unlimited on their rail and must skip
 * straight to team creation without calling `Subscriptions.updateQuantity`.
 *
 * `resolveVeteranMeteringAction` is the pure decision helper extracted from
 * the veteran branch of `handleSubmit` in create-team.tsx (same pattern as
 * the file's existing `sportLabelToSlug`/`buildProgramFields` helpers) so
 * this guard is unit-testable without a full component render harness.
 */
import { describe, expect, it } from '@jest/globals';
import { resolveVeteranMeteringAction } from '../(tabs)/create-team';

describe('resolveVeteranMeteringAction', () => {
  it('metered veteran (Stripe rail): meters quantity, program count + 1', () => {
    const result = resolveVeteranMeteringAction({
      metered: true,
      programCount: 5,
      rookieProgramLimit: 4,
    });
    expect(result.shouldMeterQuantity).toBe(true);
    expect(result.newProgramCount).toBe(6);
    expect(result.billableProgramCount).toBe(2);
  });

  it('non-metered veteran (IAP rail): does not meter, proceeds without a Stripe quantity update', () => {
    const result = resolveVeteranMeteringAction({
      metered: false,
      programCount: 5,
      rookieProgramLimit: 4,
    });
    expect(result.shouldMeterQuantity).toBe(false);
  });

  it('undefined/missing metered field (stale or errored /teams/limits response): defaults to not metering', () => {
    const result = resolveVeteranMeteringAction({
      metered: undefined,
      programCount: 5,
      rookieProgramLimit: 4,
    });
    expect(result.shouldMeterQuantity).toBe(false);
  });

  it('billable count never goes negative when under the free rookie floor', () => {
    const result = resolveVeteranMeteringAction({
      metered: true,
      programCount: 0,
      rookieProgramLimit: 4,
    });
    expect(result.newProgramCount).toBe(1);
    expect(result.billableProgramCount).toBe(0);
  });
});
