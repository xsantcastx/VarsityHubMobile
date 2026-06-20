/**
 * Unit tests for canAssignTeamRole — the single source of truth for team
 * role-tier assignment, shared by POST /teams/:id/invite, POST /team-invites,
 * and PATCH /team-memberships/:id.
 *
 * Regression guard for the audit finding: a coach/assistant_coach passes
 * canManageTeam but must NOT be able to grant the `manager` role (privilege
 * escalation). Only a team owner or an org admin may.
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

const { canAssignTeamRole } = await import('../lib/teamAuthorization.js');

beforeEach(() => {
  teamMembershipFindFirst.mockReset();
  teamFindUnique.mockReset();
  orgMembershipFindFirst.mockReset();
});

describe('canAssignTeamRole', () => {
  it('fails closed for a null user', async () => {
    await expect(canAssignTeamRole(null, 'team1', 'manager')).resolves.toBe(false);
    expect(teamMembershipFindFirst).not.toHaveBeenCalled();
  });

  it('never allows assigning `owner` (only creation / transfer-ownership can)', async () => {
    await expect(canAssignTeamRole('u1', 'team1', 'owner')).resolves.toBe(false);
    expect(teamMembershipFindFirst).not.toHaveBeenCalled();
  });

  it('allows non-manager roles without extra lookups (caller already canManageTeam)', async () => {
    await expect(canAssignTeamRole('u1', 'team1', 'coach')).resolves.toBe(true);
    await expect(canAssignTeamRole('u1', 'team1', 'member')).resolves.toBe(true);
    expect(teamMembershipFindFirst).not.toHaveBeenCalled();
  });

  it('BLOCKS a coach from granting manager (the escalation exploit)', async () => {
    teamMembershipFindFirst.mockResolvedValue({ role: 'coach' });
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue(null); // not an org admin

    await expect(canAssignTeamRole('coachUser', 'team1', 'manager')).resolves.toBe(false);
  });

  it('allows a team OWNER to grant manager', async () => {
    teamMembershipFindFirst.mockResolvedValue({ role: 'owner' });

    await expect(canAssignTeamRole('ownerUser', 'team1', 'manager')).resolves.toBe(true);
    expect(teamFindUnique).not.toHaveBeenCalled(); // short-circuits on owner
  });

  it('allows an ORG ADMIN with no direct team membership to grant manager', async () => {
    teamMembershipFindFirst.mockResolvedValue(null);
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue({ id: 'orgmem1' }); // org admin

    await expect(canAssignTeamRole('orgAdmin', 'team1', 'manager')).resolves.toBe(true);
  });

  it('allows an org admin who ALSO holds a non-owner team role (explicit org check, not null-inference)', async () => {
    teamMembershipFindFirst.mockResolvedValue({ role: 'coach' });
    teamFindUnique.mockResolvedValue({ organization_id: 'org1' });
    orgMembershipFindFirst.mockResolvedValue({ id: 'orgmem1' }); // also org admin

    await expect(canAssignTeamRole('coachAndOrgAdmin', 'team1', 'manager')).resolves.toBe(true);
  });
});
