/** Archive is full administration: active team owner/coach or canonical organization owner. */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
const teamMembershipFindFirst = jest.fn();
const teamFindUnique = jest.fn();
const queryRaw = jest.fn();
let directRole: string | null = null;
let directStatus = 'active';
jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    teamMembership: { findFirst: teamMembershipFindFirst },
    team: { findUnique: teamFindUnique },
    $queryRaw: queryRaw,
  },
}));
const { canArchiveTeam } = await import('../lib/teamAuthorization.js');
beforeEach(() => {
  directRole = null;
  directStatus = 'active';
  teamMembershipFindFirst
    .mockReset()
    .mockImplementation(async (args: any) =>
      args.where.role.in.includes(directRole) && args.where.status === directStatus
        ? { id: 'membership' }
        : null
    );
  teamFindUnique.mockReset().mockResolvedValue({ organization_id: 'org1' });
  queryRaw.mockReset().mockResolvedValue([]);
});
describe('canArchiveTeam', () => {
  it('fails closed for a null user without database access', async () => {
    expect(await canArchiveTeam(null, 'team1')).toBe(false);
    expect(teamMembershipFindFirst).not.toHaveBeenCalled();
  });
  it.each(['owner', 'coach'])(
    'allows an active team %s and skips organization lookup',
    async role => {
      directRole = role;
      expect(await canArchiveTeam('user1', 'team1')).toBe(true);
      expect(teamFindUnique).not.toHaveBeenCalled();
    }
  );
  it.each(['manager', 'assistant_coach'])(
    'denies team %s when they are not the organization owner',
    async role => {
      directRole = role;
      queryRaw.mockResolvedValue([{ id: 'different-owner' }]);
      expect(await canArchiveTeam('user1', 'team1')).toBe(false);
      expect(queryRaw).toHaveBeenCalled();
    }
  );
  it('denies an inactive team owner', async () => {
    directRole = 'owner';
    directStatus = 'inactive';
    expect(await canArchiveTeam('user1', 'team1')).toBe(false);
  });
  it('allows the canonical organization owner without a direct team role', async () => {
    queryRaw.mockResolvedValue([{ id: 'user1' }]);
    expect(await canArchiveTeam('user1', 'team1')).toBe(true);
  });
  it('denies a missing organization and never performs its owner query', async () => {
    teamFindUnique.mockResolvedValue({ organization_id: null });
    expect(await canArchiveTeam('user1', 'team1')).toBe(false);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
