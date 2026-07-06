import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockTeamCount = jest.fn();
const mockTeamMembershipCount = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    team: {
      count: mockTeamCount,
    },
    teamMembership: {
      count: mockTeamMembershipCount,
    },
  },
}));

const paymentsModule = await import('../lib/paymentInternals.js');
const getVeteranBillingSnapshot = paymentsModule.getVeteranBillingSnapshot as (
  userId: string,
  organizationId?: string | null
) => Promise<{ teamCount: number; billableQuantity: number }>;
const getVeteranTotalTeamAllowance = paymentsModule.getVeteranTotalTeamAllowance as (
  billableQuantity: number
) => number;
const resolveVeteranQuantityUpdate = paymentsModule.resolveVeteranQuantityUpdate as (
  actualTeamCount: number,
  requestedTeamCount: number
) => {
  minAllowedTotal: number;
  maxAllowedTotal: number;
  billableQuantity: number;
  allowed: boolean;
};

describe('Veteran billing snapshot', () => {
  beforeEach(() => {
    mockTeamCount.mockReset();
    mockTeamMembershipCount.mockReset();
  });

  it('derives veteran billing from user-owned teams', async () => {
    mockTeamMembershipCount.mockResolvedValueOnce(5);

    const snapshot = await getVeteranBillingSnapshot('user-1');

    expect(mockTeamMembershipCount).toHaveBeenCalledWith({
      where: { user_id: 'user-1', role: 'owner', status: 'active' },
    });
    expect(mockTeamCount).not.toHaveBeenCalled();
    expect(snapshot).toEqual({ teamCount: 5, billableQuantity: 1 });
  });

  it('derives veteran billing from organization teams when org-owned', async () => {
    mockTeamCount.mockResolvedValueOnce(6);

    const snapshot = await getVeteranBillingSnapshot('user-1', 'org-1');

    expect(mockTeamCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
    });
    expect(mockTeamMembershipCount).not.toHaveBeenCalled();
    expect(snapshot).toEqual({ teamCount: 6, billableQuantity: 2 });
  });

  it('converts billable quantity into total team allowance', () => {
    expect(getVeteranTotalTeamAllowance(0)).toBe(4);
    expect(getVeteranTotalTeamAllowance(2)).toBe(6);
  });

  it('only allows quantity updates for the current total or next team', () => {
    expect(resolveVeteranQuantityUpdate(5, 5)).toMatchObject({
      minAllowedTotal: 5,
      maxAllowedTotal: 6,
      billableQuantity: 1,
      allowed: true,
    });
    expect(resolveVeteranQuantityUpdate(5, 6)).toMatchObject({
      minAllowedTotal: 5,
      maxAllowedTotal: 6,
      billableQuantity: 2,
      allowed: true,
    });
    expect(resolveVeteranQuantityUpdate(5, 7)).toMatchObject({
      minAllowedTotal: 5,
      maxAllowedTotal: 6,
      billableQuantity: 3,
      allowed: false,
    });
  });
});
