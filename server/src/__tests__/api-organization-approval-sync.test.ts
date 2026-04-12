import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const RUN_ID = Date.now();
const ADMIN_EMAIL = `admin-org-approval-${RUN_ID}@example.com`;
const PENDING_OWNER_EMAIL = `pending-org-owner-${RUN_ID}@example.com`;
const REVIEW_OWNER_EMAIL = `review-org-owner-${RUN_ID}@example.com`;
const REQUESTER_EMAIL = `org-requester-${RUN_ID}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('Organization approval sync', () => {
  let adminUserId: string;
  let adminToken: string;
  let pendingOwnerId: string;
  let pendingOrgId: string;
  let reviewOwnerId: string;
  let reviewOwnerToken: string;
  let reviewOrgId: string;
  let requesterId: string;
  let joinRequestId: string;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;

    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const admin = await prisma.user.create({
      data: {
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        display_name: 'Approval Admin',
        email_verified: true,
        preferences: { role: 'fan' },
      },
    });
    adminUserId = admin.id;
    adminToken = signJwt({ id: admin.id });

    const pendingOwner = await prisma.user.create({
      data: {
        email: PENDING_OWNER_EMAIL,
        password_hash: passwordHash,
        display_name: 'Pending Org Owner',
        email_verified: true,
        preferences: {
          role: 'coach',
          approval_status: 'PENDING',
        },
      },
    });
    pendingOwnerId = pendingOwner.id;

    const pendingOrg = await prisma.organization.create({
      data: {
        name: `Pending Approval Org ${RUN_ID}`,
        status: 'pending',
      },
    });
    pendingOrgId = pendingOrg.id;

    await prisma.organizationMembership.create({
      data: {
        organization_id: pendingOrgId,
        user_id: pendingOwnerId,
        role: 'owner',
        status: 'invited',
      },
    });

    const reviewOwner = await prisma.user.create({
      data: {
        email: REVIEW_OWNER_EMAIL,
        password_hash: passwordHash,
        display_name: 'Review Owner',
        email_verified: true,
        preferences: {
          role: 'coach',
          approval_status: 'APPROVED',
        },
      },
    });
    reviewOwnerId = reviewOwner.id;
    reviewOwnerToken = signJwt({ id: reviewOwner.id });

    const reviewOrg = await prisma.organization.create({
      data: {
        name: `Review Flow Org ${RUN_ID}`,
        status: 'active',
      },
    });
    reviewOrgId = reviewOrg.id;

    await prisma.organizationMembership.create({
      data: {
        organization_id: reviewOrgId,
        user_id: reviewOwnerId,
        role: 'owner',
        status: 'active',
      },
    });

    const requester = await prisma.user.create({
      data: {
        email: REQUESTER_EMAIL,
        password_hash: passwordHash,
        display_name: 'Requesting Coach',
        email_verified: true,
        preferences: {
          role: 'coach',
          approval_status: 'PENDING',
        },
      },
    });
    requesterId = requester.id;

    const joinRequest = await prisma.organizationJoinRequest.create({
      data: {
        organization_id: reviewOrgId,
        user_id: requesterId,
        status: 'pending',
        message: 'Please let me join.',
      },
    });
    joinRequestId = joinRequest.id;
  });

  afterAll(async () => {
    try {
      await prisma.organizationJoinRequest.deleteMany({
        where: { organization_id: { in: [pendingOrgId, reviewOrgId] } },
      });
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: { in: [pendingOrgId, reviewOrgId] } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: [pendingOrgId, reviewOrgId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [adminUserId, pendingOwnerId, reviewOwnerId, requesterId] } },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  it('admin organization approval activates the owner membership and coach approval', async () => {
    const response = await request(app)
      .patch(`/admin/organizations/${pendingOrgId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active', note: 'Approved for launch' })
      .expect(200);

    expect(response.body?.organization?.status).toBe('active');

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: pendingOrgId,
          user_id: pendingOwnerId,
        } as any,
      },
    });
    expect(membership?.status).toBe('active');

    const owner = await prisma.user.findUnique({
      where: { id: pendingOwnerId },
      select: { preferences: true },
    });
    const prefs = (owner?.preferences || {}) as any;
    expect(prefs.approval_status).toBe('APPROVED');
    expect(prefs.organization_id).toBe(pendingOrgId);
    expect(prefs.organization_name).toBe(`Pending Approval Org ${RUN_ID}`);
  });

  it('organization join request rejection works on /reject and returns rejected status', async () => {
    await request(app)
      .post(`/organizations/join-requests/${joinRequestId}/reject`)
      .set('Authorization', `Bearer ${reviewOwnerToken}`)
      .send({ reason: 'Not a fit right now' })
      .expect(200);

    const joinRequest = await prisma.organizationJoinRequest.findUnique({
      where: { id: joinRequestId },
    });
    expect(joinRequest?.status).toBe('rejected');

    const listResponse = await request(app)
      .get(`/organizations/${reviewOrgId}/join-requests?status=rejected`)
      .set('Authorization', `Bearer ${reviewOwnerToken}`)
      .expect(200);

    expect(Array.isArray(listResponse.body)).toBe(true);
    expect(listResponse.body[0]?.status).toBe('rejected');
    expect(listResponse.body[0]?.rejection_reason).toBe('Not a fit right now');
  });

  it('admin organization rejection syncs coach rejection and archives owner membership', async () => {
    const response = await request(app)
      .patch(`/admin/organizations/${pendingOrgId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', note: 'Missing verification details' })
      .expect(200);

    expect(response.body?.organization?.status).toBe('rejected');

    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: pendingOrgId,
          user_id: pendingOwnerId,
        } as any,
      },
    });
    expect(membership?.status).toBe('archived');

    const owner = await prisma.user.findUnique({
      where: { id: pendingOwnerId },
      select: { preferences: true },
    });
    const prefs = (owner?.preferences || {}) as any;
    expect(prefs.approval_status).toBe('REJECTED');
    expect(prefs.approval_reason).toBe('Missing verification details');
  });
});
