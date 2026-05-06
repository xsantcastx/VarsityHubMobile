import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('League review routes', () => {
  let savedAdminEmails = '';
  let adminId = '';
  let adminToken = '';
  let ownerId = '';
  let secondOwnerId = '';
  let orgId = '';

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: `league-review-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'League Review Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    adminId = admin.id;
    adminToken = signJwt({ id: admin.id });

    const owner = await prisma.user.create({
      data: {
        email: `league-review-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Pending Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    ownerId = owner.id;

    const secondOwner = await prisma.user.create({
      data: {
        email: `league-review-owner-2-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Transferred Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        preferences: { role: 'coach', onboarding_completed: true },
      },
    });
    secondOwnerId = secondOwner.id;

    const org = await prisma.organization.create({
      data: {
        name: `League Review Org ${ts}`,
        org_type: 'club',
        admin_approved: false,
        updated_at: new Date(),
        league_owner_id: owner.id,
        supporting_document_url: 'https://example.com/doc.pdf',
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: owner.id, role: 'owner', status: 'active' },
    });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: secondOwner.id, role: 'manager', status: 'active' },
    });

    savedAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [admin.email, savedAdminEmails].filter(Boolean).join(',');
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = savedAdminEmails;
    await prisma.notification.deleteMany({ where: { user_id: { in: [adminId, ownerId, secondOwnerId] } } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminId, ownerId, secondOwnerId] } } }).catch(() => {});
  });

  it('keeps organization.league_owner_id in sync when ownership is transferred', async () => {
    try {
      await prisma.user.update({
        where: { id: ownerId },
        data: {
          approval_status: 'APPROVED',
          preferences: {
            role: 'coach',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
            organization_id: orgId,
          },
        },
      });
      await prisma.user.update({
        where: { id: secondOwnerId },
        data: {
          approval_status: 'APPROVED',
          preferences: {
            role: 'coach',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
            organization_id: orgId,
          },
        },
      });
      await prisma.organization.update({
        where: { id: orgId },
        data: { admin_approved: true, status: 'active' },
      });

      const res = await request(app)
        .post(`/organizations/${orgId}/transfer-ownership`)
        .set('Authorization', `Bearer ${signJwt({ id: ownerId })}`)
        .send({ new_owner_id: secondOwnerId });

      expect(res.status).toBe(200);

      const orgAfter = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { league_owner_id: true },
      });
      expect(orgAfter?.league_owner_id).toBe(secondOwnerId);

      const memberships = await prisma.organizationMembership.findMany({
        where: { organization_id: orgId, user_id: { in: [ownerId, secondOwnerId] } },
        select: { user_id: true, role: true },
      });
      expect(memberships.find((m: any) => m.user_id === ownerId)?.role).toBe('manager');
      expect(memberships.find((m: any) => m.user_id === secondOwnerId)?.role).toBe('owner');
    } finally {
      await prisma.organizationMembership.updateMany({
        where: { organization_id: orgId, user_id: ownerId },
        data: { role: 'owner' },
      });
      await prisma.organizationMembership.updateMany({
        where: { organization_id: orgId, user_id: secondOwnerId },
        data: { role: 'manager' },
      });
      await prisma.organization.update({
        where: { id: orgId },
        data: { league_owner_id: ownerId, admin_approved: false },
      });
      await prisma.user.update({
        where: { id: ownerId },
        data: {
          approval_status: 'PENDING',
          preferences: { role: 'coach', onboarding_completed: true },
        },
      });
      await prisma.user.update({
        where: { id: secondOwnerId },
        data: {
          approval_status: 'PENDING',
          preferences: { role: 'coach', onboarding_completed: true },
        },
      });
    }
  });

  it('allows a verified admin to approve a pending league from the dashboard route', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'Looks good' });

    expect(res.status).toBe(200);
    expect(String(res.body?.message || '')).toMatch(/league approved/i);

    const orgAfter = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { admin_approved: true },
    });
    expect(orgAfter?.admin_approved).toBe(true);

    const ownerAfter = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { approval_status: true },
    });
    expect(ownerAfter?.approval_status).toBe('APPROVED');
  });

  it('allows a verified admin to reject a pending league from the dashboard route', async () => {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        admin_approved: false,
        status: 'active',
        rejected_at: null,
        rejection_reason: null,
      } as any,
    });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
    }).catch(() => {});
    await prisma.user.update({
      where: { id: ownerId },
      data: {
        approval_status: 'PENDING',
        rejected_at: null,
        rejection_reason: null,
      },
    });

    const res = await request(app)
      .post(`/organizations/${orgId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Missing documentation' });

    expect(res.status).toBe(200);
    expect(String(res.body?.message || '')).toMatch(/league rejected/i);

    const orgAfter = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { status: true, rejection_reason: true },
    });
    expect(orgAfter?.status).toBe('rejected');
    expect(orgAfter?.rejection_reason).toBe('Missing documentation');

    const ownerAfter = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { approval_status: true, rejection_reason: true },
    });
    expect(ownerAfter?.approval_status).toBe('REJECTED');
    expect(ownerAfter?.rejection_reason).toBe('Missing documentation');
  });

  it('treats repeated league rejection as already rejected instead of replaying it', async () => {
    const first = await request(app)
      .post(`/organizations/${orgId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Missing documentation' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/organizations/${orgId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Different reason' });
    expect(second.status).toBe(200);
    expect(String(second.body?.message || '')).toMatch(/already rejected/i);

    const orgAfter = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { rejection_reason: true, status: true },
    });
    expect(orgAfter?.status).toBe('rejected');
    expect(orgAfter?.rejection_reason).toBe('Missing documentation');
  });

  it('renders browser-safe HTML for invalid token review links', async () => {
    const res = await request(app)
      .get(`/organizations/${orgId}/approve?token=invalid-token`)
      .expect(401);

    expect(String(res.headers['content-type'] || '')).toContain('text/html');
    expect(res.text).toContain('Invalid Link');
  });
});
