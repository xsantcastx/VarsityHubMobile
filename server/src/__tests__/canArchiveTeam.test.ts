/**
 * Unit tests for canArchiveTeam — the authority for the destructive
 * DELETE /teams/:id (archive) action.
 *
 * Regression guard for audit finding C3: archiving a team cascades
 * (memberships/invites/follows/chat unlinks), so it is deliberately STRICTER
 * than canManageTeam. A coach/assistant_coach passes canManageTeam but MUST NOT
 * be able to archive a team — only team leadership (owner/manager) or an org
 * admin may.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const teamMembershipFindFirst = jest.fn();
const teamFindUnique = jest.fn();
const orgMembershipFindFirst = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    teamMembership: { findFirst: teamMembershipFindFirst },
    team: { findUnique: teamFindUnique },
    organizationMembership: { findFirst: orgMembershipFindFirst },
  },
}));

const { canArchiveTeam } = await import('../lib/teamAuthorization.js');

beforeEach(() => {
  teamMembershipFindFirst.mockReset();
  teamFindUnique.mockReset();
  orgMembershipFindFirst.mockReset();
});

describe('canArchiveTeam', () => {
  it('fails closed for a null user', async () => {
    await expect(canArchiveTeam(null, 'team1')).resolves.toBe(false);
    expect(teamMembershipFindFirst).not.toHaveBeenCalled();
  });

  it('allows a team OWNER (direct leadership membership)', async () => {
    teamMembershipFindFirst.mockResolvedValue({ id: 'm1' });
    await expect(canArchiveTeam('owner1', 'team1')).resolves.toBe(true);
    // Short-circuits before the org lookup.
    expect(teamFindUnique).not.toHaveBeenCalled();
  });

  it('allows a team MANAGER (direct leadership membership)', async () => {
    teamMembershipFindFirst.mockResolvedValue({ id: 'm2' });
    await expect(canArchiveTeam('manager1', 'team1')).resolves.toBe(true);
  });

  it('BLOCKS a coach who is not an org admin (the over-broad-archive exploit)', async () => {
    teamMembershipFindFirst.mockResolvedValue(null); // no owner/manager row
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue(null); // not an org admin
    await expect(canArchiveTeam('coach1', 'team1')).resolves.toBe(false);
  });

  it('BLOCKS an assistant_coach who is not an org admin', async () => {
    teamMembershipFindFirst.mockResolvedValue(null);
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue(null);
    await expect(canArchiveTeam('asst1', 'team1')).resolves.toBe(false);
  });

  it('allows a coach who is ALSO an org admin (org-admin fallback)', async () => {
    teamMembershipFindFirst.mockResolvedValue(null); // no leadership team role
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue({ id: 'om1' }); // org owner/manager
    await expect(canArchiveTeam('coachOrgAdmin', 'team1')).resolves.toBe(true);
  });

  it('BLOCKS when the team has no org and the user lacks a leadership role', async () => {
    teamMembershipFindFirst.mockResolvedValue(null);
    teamFindUnique.mockResolvedValue({ organization_id: null });
    await expect(canArchiveTeam('coach1', 'team1')).resolves.toBe(false);
    expect(orgMembershipFindFirst).not.toHaveBeenCalled();
  });

  it('only counts leadership roles in the direct membership query', async () => {
    teamMembershipFindFirst.mockResolvedValue({ id: 'm1' });
    await canArchiveTeam('u1', 'team1');
    const whereArg = (teamMembershipFindFirst.mock.calls[0] as any)[0].where;
    expect(whereArg.role.in).toEqual(['owner', 'manager']);
    expect(whereArg.status).toBe('active');
  });
});
