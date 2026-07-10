/**
 * Role-barrier model (2026-07-06, user-directed): full team/org
 * administration — settings, invites, ownership transfer — is reserved for
 * the team owner, head coach, and organization owner. Team managers /
 * assistant_coaches are "authorized users": they keep roster and event
 * approve/deny (canManageTeam) but must NOT reach admin-tier mutations.
 * Organization managers keep no admin power at all — only the org owner
 * manages the organization.
 *
 * This suite locks in the new `canAdministerTeam` / `isOrgOwner` boundary
 * across every endpoint moved off the old undifferentiated `canManageTeam`.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Role-barrier authorization boundaries', () => {
  let ownerId = '';
  let coachId = '';
  let managerId = '';
  let orgOwnerId = '';
  let orgManagerId = '';
  let ownerToken = '';
  let coachToken = '';
  let managerToken = '';
  let orgOwnerToken = '';
  let orgManagerToken = '';
  let orgId = '';
  let teamId = '';

  const makeUser = async (label: string) => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `role-barrier-${label}-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: `Role Barrier ${label}`,
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
    return { id: user.id, token: signJwt({ id: user.id }) };
  };

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const owner = await makeUser('owner');
    ownerId = owner.id;
    ownerToken = owner.token;
    const coach = await makeUser('coach');
    coachId = coach.id;
    coachToken = coach.token;
    const manager = await makeUser('manager');
    managerId = manager.id;
    managerToken = manager.token;
    const orgOwner = await makeUser('org-owner');
    orgOwnerId = orgOwner.id;
    orgOwnerToken = orgOwner.token;
    const orgManager = await makeUser('org-manager');
    orgManagerId = orgManager.id;
    orgManagerToken = orgManager.token;

    const org = await prisma.organization.create({
      data: {
        name: `Role Barrier Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: orgOwnerId,
      },
    });
    orgId = org.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: orgOwnerId, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: orgManagerId, role: 'manager', status: 'active' },
      ],
    });

    const team = await prisma.team.create({
      data: { name: `Role Barrier Team ${ts}`, organization_id: orgId },
    });
    teamId = team.id;

    await prisma.teamMembership.createMany({
      data: [
        { team_id: teamId, user_id: ownerId, role: 'owner', status: 'active' },
        { team_id: teamId, user_id: coachId, role: 'coach', status: 'active' },
        { team_id: teamId, user_id: managerId, role: 'manager', status: 'active' },
      ],
    });
  });

  afterAll(async () => {
    const userIds = [ownerId, coachId, managerId, orgOwnerId, orgManagerId].filter(Boolean);
    try {
      await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
      await prisma.teamInvite.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.organizationInvite
        .deleteMany({ where: { organization_id: orgId } })
        .catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
      await prisma.organizationMembership
        .deleteMany({ where: { organization_id: orgId } })
        .catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  describe('team settings edit (PUT /teams/:id)', () => {
    it('blocks a team manager from editing team settings', async () => {
      await request(app)
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Manager Should Not Land This' })
        .expect(403);
    });

    it('allows the team coach to edit team settings', async () => {
      const res = await request(app)
        .put(`/teams/${teamId}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ name: `Coach Edited ${ts}` });
      expect(res.status).toBe(200);
    });
  });

  describe('team invite creation (POST /teams/:id/invite)', () => {
    it('blocks a team manager from creating an invite', async () => {
      await request(app)
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ email: `invitee-blocked-${ts}@example.com`, role: 'assistant_coach' })
        .expect(403);
    });

    it('allows the team owner to create an invite', async () => {
      const res = await request(app)
        .post(`/teams/${teamId}/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ email: `invitee-allowed-${ts}@example.com`, role: 'assistant_coach' });
      expect(res.status).toBe(201);
    });
  });

  describe('team ownership transfer (POST /teams/:id/transfer-ownership)', () => {
    it('blocks an org manager from transferring team ownership', async () => {
      await request(app)
        .post(`/teams/${teamId}/transfer-ownership`)
        .set('Authorization', `Bearer ${orgManagerToken}`)
        .send({ new_owner_id: coachId })
        .expect(403);
    });

    it('allows the organization owner to transfer team ownership', async () => {
      const res = await request(app)
        .post(`/teams/${teamId}/transfer-ownership`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({ new_owner_id: coachId });
      expect(res.status).toBe(200);

      // Restore original owner so later assertions in this file aren't order-sensitive.
      await prisma.teamMembership.update({
        where: { team_id_user_id: { team_id: teamId, user_id: coachId } },
        data: { role: 'coach' },
      });
      await prisma.teamMembership.update({
        where: { team_id_user_id: { team_id: teamId, user_id: ownerId } },
        data: { role: 'owner' },
      });
    });
  });

  describe('organization invite creation (POST /organizations/:id/invite)', () => {
    it('blocks an org manager from creating an org invite', async () => {
      await request(app)
        .post(`/organizations/${orgId}/invite`)
        .set('Authorization', `Bearer ${orgManagerToken}`)
        .send({ email: `org-invitee-blocked-${ts}@example.com`, role: 'member' })
        .expect(403);
    });

    it('allows the organization owner to create an org invite', async () => {
      const res = await request(app)
        .post(`/organizations/${orgId}/invite`)
        .set('Authorization', `Bearer ${orgOwnerToken}`)
        .send({ email: `org-invitee-allowed-${ts}@example.com`, role: 'member' });
      expect(res.status).toBe(201);
    });
  });
});
