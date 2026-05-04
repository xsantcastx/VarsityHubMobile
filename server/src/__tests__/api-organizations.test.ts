import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

describe('API Organization Endpoints', () => {
  let userId: string;
  let token: string;
  let approvedOrgId: string;
  let pendingOrgId: string;
  let managedOrgId: string;
  let managedTeamId: string;
  let managedInviteId: string;
  let userEmail: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const user = await prisma.user.create({
      data: {
        email: `test-org-list-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Org Contract Tester',
        email_verified: true,
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    userEmail = user.email;
    token = signJwt({ id: userId });

    const approved = await prisma.organization.create({
      data: {
        name: `Approved Org ${Date.now()}`,
        admin_approved: true,
      },
    });
    approvedOrgId = approved.id;

    const pending = await prisma.organization.create({
      data: {
        name: `Pending Org ${Date.now()}`,
        admin_approved: false,
      },
    });
    pendingOrgId = pending.id;

    await prisma.organizationJoinRequest.create({
      data: {
        organization_id: pendingOrgId,
        user_id: userId,
        status: 'pending',
      },
    });

    const managedOrg = await prisma.organization.create({
      data: {
        name: `Managed Review Org ${Date.now()}`,
        admin_approved: true,
      },
    });
    managedOrgId = managedOrg.id;

    await prisma.organizationMembership.create({
      data: {
        organization_id: managedOrgId,
        user_id: userId,
        role: 'owner',
        status: 'active',
      },
    });

    const managedInvite = await prisma.organizationInvite.create({
      data: {
        organization_id: managedOrgId,
        email: `managed-org-invite-${Date.now()}@example.com`,
        role: 'manager',
        status: 'pending',
      },
    });
    managedInviteId = managedInvite.id;

    const managedTeam = await prisma.team.create({
      data: {
        name: `Managed Review Team ${Date.now()}`,
        organization_id: managedOrgId,
      },
    });
    managedTeamId = managedTeam.id;

    await prisma.organizationJoinRequest.create({
      data: {
        organization_id: managedOrgId,
        user_id: userId,
        status: 'pending',
      },
    });

    await prisma.game.create({
      data: {
        title: 'Pending Review Game',
        date: new Date(Date.now() + 86_400_000),
        home_team_id: managedTeamId,
        home_team: managedTeam.name,
        approval_status: 'pending',
        created_by_id: userId,
      },
    });

    await prisma.event.create({
      data: {
        title: 'Pending Review Event',
        date: new Date(Date.now() + 86_400_000),
        team_id: managedTeamId,
        creator_id: userId,
        creator_role: 'coach',
        approval_status: 'pending',
        status: 'approved',
      },
    });
  });

  afterAll(async () => {
    await prisma.organizationInvite.deleteMany({ where: { id: managedInviteId } }).catch(() => {});
    await prisma.event.deleteMany({ where: { team_id: managedTeamId } }).catch(() => {});
    await prisma.game.deleteMany({
      where: {
        OR: [{ home_team_id: managedTeamId }, { away_team_id: managedTeamId }],
      },
    }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: managedTeamId } }).catch(() => {});
    await prisma.organizationJoinRequest.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.organization.deleteMany({
      where: { id: { in: [approvedOrgId, pendingOrgId, managedOrgId].filter(Boolean) } },
    }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  describe('GET /organizations', () => {
    it('includes admin_approved for approved orgs and pending join-request orgs', async () => {
      const response = await request(app)
        .get('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      const approvedOrg = response.body.find((org: any) => org.id === approvedOrgId);
      const pendingOrg = response.body.find((org: any) => org.id === pendingOrgId);

      expect(approvedOrg).toBeTruthy();
      expect(approvedOrg.admin_approved).toBe(true);
      expect(pendingOrg).toBeTruthy();
      expect(pendingOrg.admin_approved).toBe(false);
    });
  });

  describe('GET /organizations/mine/review-summaries', () => {
    it('returns the compact review summary list for managed organizations', async () => {
      const response = await request(app)
        .get('/organizations/mine/review-summaries')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      const managedOrg = response.body.find(
        (entry: any) => entry.organization?.id === managedOrgId
      );

      expect(managedOrg).toBeTruthy();
      expect(managedOrg.organization?.name).toContain('Managed Review Org');
      expect(managedOrg.permissions?.can_manage).toBe(true);
      expect(managedOrg.permissions?.can_review_coach_requests).toBe(true);
      expect(managedOrg.permissions?.membership_role).toBe('owner');
      expect(managedOrg.counts?.pending_coach_requests).toBe(1);
      expect(managedOrg.counts?.pending_game_reviews).toBe(1);
      expect(managedOrg.counts?.pending_event_reviews).toBe(1);
    });
  });

  describe('GET /organizations/:id/admin-summary', () => {
    it('includes pending authorized-user invites for managed organizations', async () => {
      const response = await request(app)
        .get(`/organizations/${managedOrgId}/admin-summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.permissions?.can_manage).toBe(true);
      expect(response.body.counts?.pending_authorized_invites).toBe(1);
      expect(Array.isArray(response.body.requests?.authorized_invites)).toBe(true);
      expect(response.body.requests.authorized_invites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: managedInviteId,
            role: 'manager',
            status: 'pending',
          }),
        ])
      );
      expect(response.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user: expect.objectContaining({
              email: userEmail,
            }),
          }),
        ])
      );
    });
  });

  describe('POST /organizations/:id/invites/:inviteId/cancel', () => {
    it('allows organization admins to revoke pending authorized-user invites', async () => {
      const invite = await prisma.organizationInvite.create({
        data: {
          organization_id: managedOrgId,
          email: `org-cancel-${Date.now()}@example.com`,
          role: 'member',
          status: 'pending',
        },
      });

      const response = await request(app)
        .post(`/organizations/${managedOrgId}/invites/${invite.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.message).toBe('Invite cancelled');
      expect(response.body.invite?.id).toBe(invite.id);
      expect(response.body.invite?.status).toBe('revoked');

      const updated = await prisma.organizationInvite.findUnique({
        where: { id: invite.id },
        select: { status: true },
      });
      expect(updated?.status).toBe('revoked');
    });
  });
});
