// server/src/__tests__/veteran-program-metering.test.ts
import { describe, expect, it } from '@jest/globals';
import { getVeteranTotalTeamAllowance } from '../lib/paymentInternals.js';

describe('veteran program metering', () => {
  it('total allowance = 5 free programs + billable quantity', () => {
    expect(getVeteranTotalTeamAllowance(0)).toBe(5);
    expect(getVeteranTotalTeamAllowance(3)).toBe(8);
  });
});
