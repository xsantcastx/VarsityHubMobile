import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

describe('API Organization Endpoints', () => {
  const coachAgreementAcceptedAt = new Date().toISOString();

  let userId: string;
  let token: string;
  let ownerId: string;
  let ownerToken: string;
  let managerId: string;
  let managerToken: string;
  let approvedOrgId: string;
  let pendingOrgId: string;
  let ownedOrgId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const user = await prisma.user.create({
      data: {
        email: `test-org-list-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Org Contract Tester',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    token = signJwt({ id: userId });

    const owner = await prisma.user.create({
      data: {
        email: `test-org-owner-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Org Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        coach_agreement_accepted_at: coachAgreementAcceptedAt,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: coachAgreementAcceptedAt,
        },
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: ownerId });

    const manager = await prisma.user.create({
      data: {
        email: `test-org-manager-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Org Manager',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        coach_agreement_accepted_at: coachAgreementAcceptedAt,
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: coachAgreementAcceptedAt,
        },
      },
    });
    managerId = manager.id;
    managerToken = signJwt({ id: managerId });

    const approved = await prisma.organization.create({
      data: {
        name: `Approved Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
      select: { id: true },
    });
    approvedOrgId = approved.id;

    const pending = await prisma.organization.create({
      data: {
        name: `Pending Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: false,
        updated_at: new Date(),
      },
      select: { id: true },
    });
    pendingOrgId = pending.id;

    const ownedOrg = await prisma.organization.create({
      data: {
        name: `Owned Org ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: ownerId,
        updated_at: new Date(),
      },
      select: { id: true },
    });
    ownedOrgId = ownedOrg.id;

    await prisma.organizationMembership.createMany({
      data: [
        {
          organization_id: ownedOrgId,
          user_id: ownerId,
          role: 'owner',
          status: 'active',
        },
        {
          organization_id: ownedOrgId,
          user_id: managerId,
          role: 'manager',
          status: 'active',
        },
      ],
    });

    await prisma.organizationJoinRequest.createMany({
      data: [
        {
          organization_id: pendingOrgId,
          user_id: userId,
          status: 'pending',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organizationJoinRequest.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({
        where: { user_id: { in: [userId, ownerId, managerId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.organization
      .deleteMany({
        where: { id: { in: [approvedOrgId, pendingOrgId, ownedOrgId].filter(Boolean) } },
      })
      .catch(() => {});
    await prisma.user
      .deleteMany({
        where: { id: { in: [userId, ownerId, managerId].filter(Boolean) } },
      })
      .catch(() => {});
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

  describe('owner-only organization management', () => {
    it('GET /organizations/:id returns approved organization details without a decode error', async () => {
      const response = await request(app)
        .get(`/organizations/${ownedOrgId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.id).toBe(ownedOrgId);
      expect(response.body.name).toContain('Owned Org');
      expect(response.body.viewer_role).toBe('owner');
      expect(response.body.is_member).toBe(true);
      expect(response.body.is_owner).toBe(true);
      expect(response.body.can_edit).toBe(true);
      expect(response.body.can_manage).toBe(true);
      expect(response.body.can_review_coaches).toBe(true);
    });

    it('GET /organizations/mine returns owner organizations but excludes manager-only memberships', async () => {
      const [ownerResponse, managerResponse] = await Promise.all([
        request(app).get('/organizations/mine').set('Authorization', `Bearer ${ownerToken}`),
        request(app).get('/organizations/mine').set('Authorization', `Bearer ${managerToken}`),
      ]);

      expect(ownerResponse.status).toBe(200);
      expect(managerResponse.status).toBe(200);
      expect(ownerResponse.body.some((org: any) => org.id === ownedOrgId)).toBe(true);
      expect(managerResponse.body.some((org: any) => org.id === ownedOrgId)).toBe(false);
    });

    it('PATCH /organizations/:id allows the owner and rejects a manager', async () => {
      const ownerRes = await request(app)
        .patch(`/organizations/${ownedOrgId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ description: 'Owner updated description' });

      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.description).toBe('Owner updated description');

      const managerRes = await request(app)
        .patch(`/organizations/${ownedOrgId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ description: 'Manager should not update' });

      expect(managerRes.status).toBe(403);
      expect(managerRes.body.error).toBe('Only the organization owner can edit this organization.');
    });

    it('GET /organizations/:id exposes manager membership without owner privileges', async () => {
      const response = await request(app)
        .get(`/organizations/${ownedOrgId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.viewer_role).toBe('manager');
      expect(response.body.is_member).toBe(true);
      expect(response.body.is_owner).toBe(false);
      expect(response.body.can_edit).toBe(false);
      expect(response.body.can_manage).toBe(true);
      expect(response.body.can_review_coaches).toBe(false);
    });

    it('GET /organizations/:id/admin-summary keeps manager admin access without edit privileges', async () => {
      const response = await request(app)
        .get(`/organizations/${ownedOrgId}/admin-summary`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(response.body.permissions?.can_manage).toBe(true);
      expect(response.body.permissions?.membership_role).toBe('manager');
      expect(response.body.organization?.viewer_role).toBe('manager');
      expect(response.body.organization?.can_manage).toBe(true);
      expect(response.body.organization?.can_edit).toBe(false);
      expect(response.body.organization?.can_review_coaches).toBe(false);
    });

    it('POST /organizations/:id/transfer-ownership updates both membership roles and league_owner_id', async () => {
      // Accept-based transfer (2026-07-16): initiate sends a pending offer;
      // ownership moves only after the recipient accepts.
      const transferRes = await request(app)
        .post(`/organizations/${ownedOrgId}/transfer-ownership`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ new_owner_id: managerId });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.pending).toBe(true);

      const acceptRes = await request(app)
        .post(`/organizations/${ownedOrgId}/transfer-ownership/accept`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(acceptRes.status).toBe(200);

      const [org, membershipRows] = await Promise.all([
        prisma.organization.findUnique({
          where: { id: ownedOrgId },
          select: { league_owner_id: true },
        }),
        prisma.$queryRaw<Array<{ user_id: string; role: string }>>`
          SELECT user_id, role::text AS role
          FROM "OrganizationMembership"
          WHERE organization_id = ${ownedOrgId}
            AND user_id IN (${ownerId}, ${managerId})
        `,
      ]);
      const ownerMembership = membershipRows.find(row => row.user_id === ownerId);
      const managerMembership = membershipRows.find(row => row.user_id === managerId);

      expect(org?.league_owner_id).toBe(managerId);
      expect(ownerMembership?.role).toBe('manager');
      expect(managerMembership?.role).toBe('owner');
    });
  });
});
