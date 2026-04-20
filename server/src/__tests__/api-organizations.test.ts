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

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const user = await prisma.user.create({
      data: {
        email: `test-org-list-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Org Contract Tester',
        email_verified: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
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
  });

  afterAll(async () => {
    await prisma.organizationJoinRequest.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.organization.deleteMany({
      where: { id: { in: [approvedOrgId, pendingOrgId].filter(Boolean) } },
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
});
