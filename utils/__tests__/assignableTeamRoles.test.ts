import { describe, expect, it } from '@jest/globals';

import { getAssignableTeamRoles } from '@/utils/roleChecks';

const ALL_ROLES = [
  'owner',
  'manager',
  'coach',
  'assistant_coach',
  'player',
  'parent',
  'member',
] as const;

/**
 * getAssignableTeamRoles is the client mirror of the server's canAssignTeamRole.
 * It must never offer a role the server will 403 on:
 *   - `owner`   is never assignable via a role picker
 *   - `manager` only for a team owner or an org admin
 */
describe('getAssignableTeamRoles', () => {
  it('never offers the owner role, regardless of actor', () => {
    for (const actor of [
      { teamRole: 'owner', isOrgAdmin: true },
      { teamRole: 'manager', isOrgAdmin: false },
      { teamRole: 'coach', isOrgAdmin: false },
      null,
    ]) {
      expect(getAssignableTeamRoles(actor, ALL_ROLES)).not.toContain('owner');
    }
  });

  it('lets a team OWNER assign manager', () => {
    const roles = getAssignableTeamRoles({ teamRole: 'owner', isOrgAdmin: false }, ALL_ROLES);
    expect(roles).toContain('manager');
    expect(roles).toContain('coach');
  });

  it('lets an ORG ADMIN assign manager even without a team-owner role', () => {
    const roles = getAssignableTeamRoles({ teamRole: 'coach', isOrgAdmin: true }, ALL_ROLES);
    expect(roles).toContain('manager');
  });

  it('BLOCKS a coach from being offered manager (the dead-end the picker created)', () => {
    const roles = getAssignableTeamRoles({ teamRole: 'coach', isOrgAdmin: false }, ALL_ROLES);
    expect(roles).not.toContain('manager');
    expect(roles).not.toContain('owner');
    // still offers the roles a coach CAN assign
    expect(roles).toEqual(['coach', 'assistant_coach', 'player', 'parent', 'member']);
  });

  it('BLOCKS an assistant_coach from being offered manager', () => {
    const roles = getAssignableTeamRoles(
      { teamRole: 'assistant_coach', isOrgAdmin: false },
      ALL_ROLES
    );
    expect(roles).not.toContain('manager');
  });

  it('fails closed for a null/undefined actor (no manager)', () => {
    expect(getAssignableTeamRoles(null, ALL_ROLES)).not.toContain('manager');
    expect(getAssignableTeamRoles(undefined, ALL_ROLES)).not.toContain('manager');
  });

  it('is case-insensitive on the actor team role', () => {
    const roles = getAssignableTeamRoles({ teamRole: 'OWNER', isOrgAdmin: false }, ALL_ROLES);
    expect(roles).toContain('manager');
  });
});
