/**
 * Phase 4 client billing guard: the Veteran plan's Stripe subscription
 * quantity must only be updated on the Stripe-metered rail
 * (`/teams/limits` -> `metered: true`) AND only when the new team introduces
 * a NEW billable sport program. IAP veterans (Apple/Google — no Stripe
 * subscription to meter) are unlimited on their rail and must skip straight
 * to team creation without calling `Subscriptions.updateQuantity`. A
 * Stripe-metered veteran adding a team to a sport program the org already
 * runs (an existing program with an active team) must also skip the
 * quantity update — the server's billable-program count only counts a
 * program once it has an active team, so joining an established program
 * doesn't add a new billable unit, and bumping Stripe quantity there would
 * over-bill by one unit permanently.
 *
 * `resolveVeteranMeteringAction` is the pure decision helper extracted from
 * the veteran branch of `handleSubmit` in create-team.tsx (same pattern as
 * the file's existing `sportLabelToSlug`/`buildProgramFields` helpers) so
 * this guard is unit-testable without a full component render harness.
 */
import { describe, expect, it } from '@jest/globals';
import { resolveVeteranMeteringAction } from '../(tabs)/create-team';

describe('resolveVeteranMeteringAction', () => {
  it('metered veteran (Stripe rail) adding a NEW sport: meters quantity, program count + 1', () => {
    const result = resolveVeteranMeteringAction({
      metered: true,
      programCount: 5,
      rookieProgramLimit: 5,
      isNewProgram: true,
    });
    expect(result.shouldMeterQuantity).toBe(true);
    expect(result.newProgramCount).toBe(6);
    expect(result.billableProgramCount).toBe(1);
  });

  it('metered veteran (Stripe rail) joining an EXISTING sport: does not meter, program count unchanged', () => {
    const result = resolveVeteranMeteringAction({
      metered: true,
      programCount: 6,
      rookieProgramLimit: 5,
      isNewProgram: false,
    });
    expect(result.shouldMeterQuantity).toBe(false);
    expect(result.newProgramCount).toBe(6);
    expect(result.billableProgramCount).toBe(1);
  });

  it('non-metered veteran (IAP rail): does not meter even for a new sport, proceeds without a Stripe quantity update', () => {
    const result = resolveVeteranMeteringAction({
      metered: false,
      programCount: 5,
      rookieProgramLimit: 5,
      isNewProgram: true,
    });
    expect(result.shouldMeterQuantity).toBe(false);
  });

  it('undefined/missing metered field (stale or errored /teams/limits response): defaults to not metering', () => {
    const result = resolveVeteranMeteringAction({
      metered: undefined,
      programCount: 5,
      rookieProgramLimit: 5,
      isNewProgram: true,
    });
    expect(result.shouldMeterQuantity).toBe(false);
  });

  it('billable count never goes negative when under the free rookie floor', () => {
    const result = resolveVeteranMeteringAction({
      metered: true,
      programCount: 0,
      rookieProgramLimit: 5,
      isNewProgram: true,
    });
    expect(result.newProgramCount).toBe(1);
    expect(result.billableProgramCount).toBe(0);
  });
});
