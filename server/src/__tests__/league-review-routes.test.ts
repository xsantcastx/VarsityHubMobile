import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signJwt: any;
let app: import('express').Express;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('League review routes', () => {
  let savedAdminEmails = '';
  let adminId = '';
  let adminToken = '';
  let ownerId = '';
  let orgId = '';

  beforeAll(async () => {
    ({ app } = await import('../testApp.js'));
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

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

    savedAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [admin.email, savedAdminEmails].filter(Boolean).join(',');
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = savedAdminEmails;
    await prisma.notification.deleteMany({ where: { user_id: { in: [adminId, ownerId] } } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [adminId, ownerId] } } }).catch(() => {});
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
});
