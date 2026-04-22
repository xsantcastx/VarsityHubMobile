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

const paymentsModule = await import('../routes/payments.js');
const getVeteranBillingSnapshot = paymentsModule.__paymentsInternal.getVeteranBillingSnapshot as (
  userId: string,
  organizationId?: string | null
) => Promise<{ teamCount: number; billableQuantity: number }>;

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
    expect(snapshot).toEqual({ teamCount: 5, billableQuantity: 2 });
  });

  it('derives veteran billing from organization teams when org-owned', async () => {
    mockTeamCount.mockResolvedValueOnce(6);

    const snapshot = await getVeteranBillingSnapshot('user-1', 'org-1');

    expect(mockTeamCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
    });
    expect(mockTeamMembershipCount).not.toHaveBeenCalled();
    expect(snapshot).toEqual({ teamCount: 6, billableQuantity: 3 });
  });
});
