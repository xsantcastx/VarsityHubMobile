import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockSportProgramCount = jest.fn();
const mockTeamCount = jest.fn();
const mockTeamMembershipFindMany = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    sportProgram: {
      count: mockSportProgramCount,
    },
    team: {
      count: mockTeamCount,
    },
    teamMembership: {
      findMany: mockTeamMembershipFindMany,
    },
  },
}));

const paymentsModule = await import('../lib/paymentInternals.js');
const getVeteranBillingSnapshot = paymentsModule.getVeteranBillingSnapshot as (
  userId: string,
  organizationId?: string | null
) => Promise<{ programCount: number; billableQuantity: number }>;
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
    mockSportProgramCount.mockReset();
    mockTeamCount.mockReset();
    mockTeamMembershipFindMany.mockReset();
  });

  it('derives veteran billing from distinct programs owned by the user', async () => {
    mockTeamMembershipFindMany.mockResolvedValueOnce([
      { team: { program_id: 'program-1' } },
      { team: { program_id: 'program-1' } },
      { team: { program_id: 'program-2' } },
      { team: { program_id: null } },
      { team: { program_id: null } },
    ]);

    const snapshot = await getVeteranBillingSnapshot('user-1');

    expect(mockTeamMembershipFindMany).toHaveBeenCalledWith({
      where: { user_id: 'user-1', role: 'owner', status: 'active', team: { status: 'active' } },
      select: { team: { select: { program_id: true } } },
      take: 5000,
    });
    expect(mockSportProgramCount).not.toHaveBeenCalled();
    // 2 distinct programs (program-1, program-2) + 2 ungrouped teams = 4
    expect(snapshot).toEqual({ programCount: 4, billableQuantity: 0 });
  });

  it('derives veteran billing from organization programs plus ungrouped teams when org-owned', async () => {
    mockSportProgramCount.mockResolvedValueOnce(6);
    mockTeamCount.mockResolvedValueOnce(2); // 2 ungrouped (null-program) active teams

    const snapshot = await getVeteranBillingSnapshot('user-1', 'org-1');

    expect(mockSportProgramCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', teams: { some: { status: 'active' } } },
    });
    expect(mockTeamCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', status: 'active', program_id: null },
    });
    expect(mockTeamMembershipFindMany).not.toHaveBeenCalled();
    // 6 programs + 2 ungrouped teams = 8; billable = 8 - 5 = 3
    expect(snapshot).toEqual({ programCount: 8, billableQuantity: 3 });
  });

  it('converts billable quantity into total program allowance', () => {
    expect(getVeteranTotalTeamAllowance(0)).toBe(5);
    expect(getVeteranTotalTeamAllowance(2)).toBe(7);
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
