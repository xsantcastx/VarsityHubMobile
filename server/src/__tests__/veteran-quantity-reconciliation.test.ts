/**
 * Veteran subscription quantity reconciliation — the pure decision.
 *
 * Stripe item quantity for a metered veteran must equal the billable program
 * count: max(0, activeProgramCount - free tier). The create flow bumps it UP;
 * nothing ever brought it DOWN when programs were archived, so owners over-paid
 * for archived sports indefinitely. This function decides the down-only
 * correction the nightly job applies. It NEVER raises quantity (a surprise
 * up-charge), and it flags — rather than silently zeroes — a veteran who has
 * dropped to the free tier (that is a plan downgrade, not a quantity change).
 */

import { describe, it, expect } from '@jest/globals';
import { resolveVeteranQuantityReconciliation } from '../lib/veteranQuantityReconciliation.js';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from '../lib/planDefinitions.js';

const FREE = SERVER_ROOKIE_PROGRAM_LIMIT;

describe('resolveVeteranQuantityReconciliation', () => {
  it('lowers quantity to the billable count when Stripe is over-charging', () => {
    // 6 programs -> 1 billable; Stripe still on 3 from archived sports.
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 3,
      activeProgramCount: FREE + 1,
    });
    expect(r).toEqual({ action: 'lower', targetQuantity: 1 });
  });

  it('does nothing when Stripe quantity already matches the billable count', () => {
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 2,
      activeProgramCount: FREE + 2,
    });
    expect(r).toEqual({ action: 'none', targetQuantity: 2 });
  });

  it('never raises quantity (under-billed stays untouched — no surprise up-charge)', () => {
    // 8 programs -> 3 billable, but Stripe only on 1. Reconciliation must not
    // raise it; only a create (with explicit consent) may bump up.
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 1,
      activeProgramCount: FREE + 3,
    });
    expect(r).toEqual({ action: 'none', targetQuantity: 3 });
  });

  it('flags a downgrade instead of setting quantity 0 when the owner dropped to the free tier', () => {
    // 5 programs -> 0 billable, but still paying for 2. Should move to Rookie —
    // a plan change the job surfaces, not a quantity write.
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 2,
      activeProgramCount: FREE,
    });
    expect(r).toEqual({ action: 'flag_downgrade', targetQuantity: 0 });
  });

  it('does nothing when already at the free tier with no billable quantity', () => {
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 0,
      activeProgramCount: FREE,
    });
    expect(r).toEqual({ action: 'none', targetQuantity: 0 });
  });

  it('is idempotent: re-running after a lower is a no-op', () => {
    const first = resolveVeteranQuantityReconciliation({
      currentQuantity: 4,
      activeProgramCount: FREE + 1,
    });
    expect(first).toEqual({ action: 'lower', targetQuantity: 1 });
    const second = resolveVeteranQuantityReconciliation({
      currentQuantity: first.targetQuantity,
      activeProgramCount: FREE + 1,
    });
    expect(second).toEqual({ action: 'none', targetQuantity: 1 });
  });

  it('never proposes a target above the current quantity (down-only invariant)', () => {
    for (let current = 0; current <= 10; current++) {
      for (let programs = 0; programs <= 12; programs++) {
        const r = resolveVeteranQuantityReconciliation({
          currentQuantity: current,
          activeProgramCount: programs,
        });
        if (r.action === 'lower') {
          expect(r.targetQuantity).toBeLessThan(current);
        }
      }
    }
  });

  it('coerces fractional/negative inputs to safe integers', () => {
    const r = resolveVeteranQuantityReconciliation({
      currentQuantity: 3.9,
      activeProgramCount: FREE + 1.2,
    });
    expect(r).toEqual({ action: 'lower', targetQuantity: 1 });
  });
});
