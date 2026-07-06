import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
const TEAM_PREFIX = `Entitlement Audit ${ts}`;

describeDb('Team entitlement enforcement', () => {
  const createdUserIds: string[] = [];
  const createdTeamIds: string[] = [];
  const createdInviteIds: string[] = [];
  const createdMembershipIds: string[] = [];
  let ownerId = '';
  let ownerToken = '';
  let orgId = '';
  let lockedTeamId = '';
  let unlockedTeamId = '';
  let lockedInviteId = '';
  let rosterInviteId = '';
  let rolePatchMembershipId = '';
  let lockedInviteeToken = '';
  let rosterInviteeToken = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `team-entitlement-owner-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Entitlement Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: owner.id });
    createdUserIds.push(owner.id);

    const lockedInvitee = await prisma.user.create({
      data: {
        email: `team-entitlement-locked-invitee-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Locked Invitee',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    lockedInviteeToken = signJwt({ id: lockedInvitee.id });
    createdUserIds.push(lockedInvitee.id);

    const rosterInvitee = await prisma.user.create({
      data: {
        email: `team-entitlement-roster-invitee-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Roster Invitee',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    rosterInviteeToken = signJwt({ id: rosterInvitee.id });
    createdUserIds.push(rosterInvitee.id);

    const org = await prisma.organization.create({
      data: {
        name: `Team Entitlement League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    orgId = org.id;

    await prisma.organizationMembership.create({
      data: {
        organization_id: org.id,
        user_id: owner.id,
        role: 'owner',
        status: 'active',
      },
    });

    const teamDates = [
      new Date('2024-01-01T00:00:00.000Z'),
      new Date('2024-01-02T00:00:00.000Z'),
      new Date('2024-01-03T00:00:00.000Z'),
      new Date('2024-01-04T00:00:00.000Z'),
      new Date('2024-01-05T00:00:00.000Z'),
    ];

    const createdTeams = [];
    for (let i = 0; i < 5; i += 1) {
      const team = await prisma.team.create({
        data: {
          name: `${TEAM_PREFIX} ${i + 1}`,
          organization_id: org.id,
          created_at: teamDates[i],
        },
      });
      createdTeams.push(team);
      createdTeamIds.push(team.id);
      const ownerMembership = await prisma.teamMembership.create({
        data: {
          team_id: team.id,
          user_id: owner.id,
          role: 'owner',
          status: 'active',
        },
      });
      createdMembershipIds.push(ownerMembership.id);
    }

    unlockedTeamId = createdTeams[0].id;
    lockedTeamId = createdTeams[4].id;

    lockedInviteId = (
      await prisma.teamInvite.create({
        data: {
          team_id: lockedTeamId,
          email: `team-entitlement-locked-invitee-${ts}@example.com`,
          role: 'member',
        },
      })
    ).id;
    createdInviteIds.push(lockedInviteId);

    rosterInviteId = (
      await prisma.teamInvite.create({
        data: {
          team_id: unlockedTeamId,
          email: `team-entitlement-roster-invitee-${ts}@example.com`,
          role: 'member',
        },
      })
    ).id;
    createdInviteIds.push(rosterInviteId);

    for (let i = 0; i < 49; i += 1) {
      const member = await prisma.user.create({
        data: {
          email: `team-entitlement-member-${ts}-${i}@example.com`,
          password_hash: passwordHash,
          display_name: `Roster Member ${i}`,
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
      createdUserIds.push(member.id);
      const membership = await prisma.teamMembership.create({
        data: {
          team_id: unlockedTeamId,
          user_id: member.id,
          role: 'member',
          status: 'active',
        },
      });
      createdMembershipIds.push(membership.id);
    }

    const staffTeamId = createdTeams[1].id;
    for (let i = 0; i < 6; i += 1) {
      const staffUser = await prisma.user.create({
        data: {
          email: `team-entitlement-staff-${ts}-${i}@example.com`,
          password_hash: passwordHash,
          display_name: `Staff ${i}`,
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie' },
        },
      });
      createdUserIds.push(staffUser.id);
      const membership = await prisma.teamMembership.create({
        data: {
          team_id: staffTeamId,
          user_id: staffUser.id,
          role: 'coach',
          status: 'active',
        },
      });
      createdMembershipIds.push(membership.id);
    }

    const rolePatchUser = await prisma.user.create({
      data: {
        email: `team-entitlement-role-patch-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Role Patch User',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    createdUserIds.push(rolePatchUser.id);
    rolePatchMembershipId = (
      await prisma.teamMembership.create({
        data: {
          team_id: staffTeamId,
          user_id: rolePatchUser.id,
          role: 'member',
          status: 'active',
        },
      })
    ).id;
    createdMembershipIds.push(rolePatchMembershipId);

    const overflowUser = await prisma.user.create({
      data: {
        email: `team-entitlement-overflow-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Overflow Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    createdUserIds.push(overflowUser.id);
  });

  afterAll(async () => {
    if (!prisma) return;

    if (createdInviteIds.length) {
      await prisma.teamInvite.deleteMany({ where: { id: { in: createdInviteIds } } }).catch(() => {});
    }

    if (createdMembershipIds.length) {
      await prisma.teamMembership.deleteMany({ where: { id: { in: createdMembershipIds } } }).catch(() => {});
    }

    if (createdTeamIds.length) {
      await prisma.team.deleteMany({ where: { id: { in: createdTeamIds } } }).catch(() => {});
    }

    if (orgId) {
      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
      await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    }

    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  });

  it('hides locked excess teams from GET /teams/managed', async () => {
    const res = await request(app)
      .get(`/teams/managed?q=${encodeURIComponent(TEAM_PREFIX)}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(4);
    expect(res.body.map((team: any) => team.id)).not.toContain(lockedTeamId);
  });

  it('keeps public team detail readable but blocks privileged access to locked teams', async () => {
    await request(app)
      .get(`/teams/${lockedTeamId}`)
      .expect(200);

    const lockedRes = await request(app)
      .get(`/teams/${lockedTeamId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(403);

    expect(lockedRes.body.error).toBe('TEAM_PLAN_LOCKED');
  });

  it('blocks team edits and invites on locked teams', async () => {
    const editRes = await request(app)
      .put(`/teams/${lockedTeamId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ description: 'Should not update' })
      .expect(403);

    expect(editRes.body.error).toBe('TEAM_PLAN_LOCKED');

    const inviteRes = await request(app)
      .post(`/teams/${lockedTeamId}/invite`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: `new-locked-invite-${ts}@example.com`, role: 'member' })
      .expect(403);

    expect(inviteRes.body.error).toBe('TEAM_PLAN_LOCKED');
  });

  it('blocks invite acceptance on locked teams', async () => {
    const res = await request(app)
      .post(`/teams/invites/${lockedInviteId}/accept`)
      .set('Authorization', `Bearer ${lockedInviteeToken}`)
      .expect(403);

    expect(res.body.error).toBe('TEAM_PLAN_LOCKED');

    const invite = await prisma.teamInvite.findUnique({ where: { id: lockedInviteId } });
    expect(invite?.status).toBe('pending');
  });

  it('blocks invite acceptance when roster is already full', async () => {
    const res = await request(app)
      .post(`/teams/invites/${rosterInviteId}/accept`)
      .set('Authorization', `Bearer ${rosterInviteeToken}`)
      .expect(403);

    expect(res.body.error).toBe('ROSTER_LIMIT_REACHED');
  });

  it('blocks direct staff adds and role escalations beyond the authorized-user cap', async () => {
    const overflowUser = await prisma.user.findUnique({
      where: { email: `team-entitlement-overflow-${ts}@example.com` },
      select: { id: true },
    });
    expect(overflowUser?.id).toBeTruthy();

    const addRes = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        team_id: createdTeamIds[1],
        user_id: overflowUser.id,
        role: 'coach',
      })
      .expect(403);

    expect(addRes.body.error).toBe('USER_LIMIT_REACHED');

    const patchRes = await request(app)
      .patch(`/team-memberships/${rolePatchMembershipId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'coach' })
      .expect(403);

    expect(patchRes.body.error).toBe('USER_LIMIT_REACHED');
  });
});
