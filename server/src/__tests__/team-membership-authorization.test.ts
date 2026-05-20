import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Team membership authorization boundaries', () => {
  let ownerId = '';
  let managerId = '';
  let memberId = '';
  let addTargetId = '';
  let ownerToken = '';
  let managerToken = '';
  let orgId = '';
  let teamId = '';
  let membershipId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `team-membership-owner-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Team Membership Owner',
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

    const manager = await prisma.user.create({
      data: {
        email: `team-membership-manager-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Org Manager',
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
    managerId = manager.id;
    managerToken = signJwt({ id: manager.id });

    const member = await prisma.user.create({
      data: {
        email: `team-membership-member-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Existing Team Member',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    memberId = member.id;

    const addTarget = await prisma.user.create({
      data: {
        email: `team-membership-add-target-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: 'Add Target',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    addTargetId = addTarget.id;

    const org = await prisma.organization.create({
      data: {
        name: `Team Membership Auth Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    orgId = org.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
        { organization_id: org.id, user_id: manager.id, role: 'manager', status: 'active' },
      ],
    });

    const team = await prisma.team.create({
      data: {
        name: `Team Membership Auth Team ${ts}`,
        organization_id: org.id,
      },
    });
    teamId = team.id;

    await prisma.teamMembership.create({
      data: {
        team_id: team.id,
        user_id: owner.id,
        role: 'owner',
        status: 'active',
      },
    });

    const membership = await prisma.teamMembership.create({
      data: {
        team_id: team.id,
        user_id: member.id,
        role: 'member',
        status: 'active',
      },
    });
    membershipId = membership.id;
  });

  afterAll(async () => {
    try {
      await prisma.notification.deleteMany({
        where: { user_id: { in: [ownerId, managerId, memberId, addTargetId].filter(Boolean) } },
      }).catch(() => {});
      await prisma.teamMembership.deleteMany({
        where: {
          OR: [
            { team_id: teamId },
            { user_id: { in: [ownerId, managerId, memberId, addTargetId].filter(Boolean) } },
          ],
        },
      }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, managerId, memberId, addTargetId].filter(Boolean) } },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('allows an org manager to add a member to a team in their organization', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        team_id: teamId,
        user_id: addTargetId,
        role: 'member',
      })
      .expect(201);

    expect(res.body.team_id).toBe(teamId);
    expect(res.body.user_id).toBe(addTargetId);
    expect(res.body.role).toBe('member');
  });

  it('allows an org manager to update team membership without direct team membership', async () => {
    const res = await request(app)
      .patch(`/team-memberships/${membershipId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'player' })
      .expect(200);

    expect(res.body.id).toBe(membershipId);
    expect(res.body.role).toBe('player');
  });

  it('allows an org manager to remove team membership without direct team membership', async () => {
    await request(app)
      .delete(`/team-memberships/${membershipId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    const membership = await prisma.teamMembership.findUnique({ where: { id: membershipId } });
    expect(membership).toBeNull();
  });
});
