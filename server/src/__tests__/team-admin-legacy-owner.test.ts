import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Regression: teamAuthorization.isOrgOwner (backs canAdministerTeam — team
// settings, invites, program attach/detach, transfer) must honor a legacy org
// owner recorded only on Organization.league_owner_id (no owner membership row),
// matching organizationAuthorization.isOrganizationOwner (PR #142). Previously it
// only checked the membership row, so a legacy owner was 403'd on their own teams.

let prisma: any;
let isOrgOwner: (u?: string | null, o?: string | null) => Promise<boolean>;

const ts = Date.now();
let legacyOwnerId = '';
let modernOwnerId = '';
let strangerId = '';
let legacyOrgId = '';
let modernOrgId = '';

async function mkUser(email: string) {
  const u = await prisma.user.create({
    data: {
      email,
      password_hash: 'x',
      username: email.split('@')[0].slice(0, 20),
      onboarding_completed: true,
    },
  });
  return u.id;
}

async function mkOrg(ownerId: string, name: string, withMembershipRow: boolean) {
  const org = await prisma.organization.create({
    data: {
      name,
      description: 'legacy-owner test',
      org_type: 'club',
      admin_approved: true,
      approved_at: new Date(),
      league_owner_id: ownerId,
      updated_at: new Date(),
    },
  });
  if (withMembershipRow) {
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
    });
  }
  return org.id;
}

describe('isOrgOwner honors legacy league_owner_id (team-admin tier)', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ isOrgOwner } = await import('../lib/teamAuthorization.js'));
    legacyOwnerId = await mkUser(`legacy-${ts}@t.co`);
    modernOwnerId = await mkUser(`modern-${ts}@t.co`);
    strangerId = await mkUser(`stranger-${ts}@t.co`);
    // Legacy org: ownership only on league_owner_id, NO owner membership row.
    legacyOrgId = await mkOrg(legacyOwnerId, `Legacy Org ${ts}`, false);
    // Modern org: owner membership row present.
    modernOrgId = await mkOrg(modernOwnerId, `Modern Org ${ts}`, true);
  });

  afterAll(async () => {
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: { in: [legacyOrgId, modernOrgId] } } })
      .catch(() => {});
    await prisma.organization
      .deleteMany({ where: { id: { in: [legacyOrgId, modernOrgId] } } })
      .catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [legacyOwnerId, modernOwnerId, strangerId] } } })
      .catch(() => {});
  });

  it('legacy owner (league_owner_id only, no membership row) is recognized as owner', async () => {
    expect(await isOrgOwner(legacyOwnerId, legacyOrgId)).toBe(true);
  });

  it('modern owner (membership row) is still recognized', async () => {
    expect(await isOrgOwner(modernOwnerId, modernOrgId)).toBe(true);
  });

  it('a stranger is not an owner of either org', async () => {
    expect(await isOrgOwner(strangerId, legacyOrgId)).toBe(false);
    expect(await isOrgOwner(strangerId, modernOrgId)).toBe(false);
  });

  it('a legacy owner is NOT owner of a different org', async () => {
    expect(await isOrgOwner(legacyOwnerId, modernOrgId)).toBe(false);
  });
});
