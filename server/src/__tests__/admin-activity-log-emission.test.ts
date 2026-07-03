/**
 * AdminActivityLog emission tests
 *
 * The 2026-06 security audit wired AdminActivityLog rows into ad moderation
 * (approve/reject) and org/team ownership transfers, but nothing asserted the
 * rows are actually written — the existing ads tests are pure validation.
 * These integration tests hit the real endpoints (same convention as
 * coach-approval.test.ts) and assert the audit row lands with the correct
 * actor / target / action.
 *
 * Covered emission sites:
 * - approveAd  → logAdModerationActivity('AD_APPROVE')  (src/routes/ads.ts)
 * - rejectAd   → logAdModerationActivity('AD_REJECT')   (src/routes/ads.ts)
 * - org transfer-ownership  → 'TRANSFER_ORG_OWNERSHIP'  (src/routes/organizations.ts)
 * - team transfer-ownership → 'TRANSFER_TEAM_OWNERSHIP' (src/routes/teams.ts)
 */

import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
// Platform admin access is a hardcoded floor (src/lib/adminEmails.ts) — the
// ADMIN_EMAILS env var cannot widen it, so the admin-session path must use a
// real floor mailbox.
const PLATFORM_ADMIN_EMAIL = 'customerservice@varsityhub.app';

jest.setTimeout(20_000);

describe('AdminActivityLog emission', () => {
  let adminId = '';
  let adminToken = '';
  let adminCreatedByTest = false;
  let adOwnerId = '';
  let orgOwnerId = '';
  let orgOwnerToken = '';
  let newOwnerId = '';
  let orgId = '';
  let teamId = '';
  const adIds: string[] = [];

  async function createPendingAd() {
    const ad = await prisma.ad.create({
      data: {
        user_id: adOwnerId,
        contact_name: 'Audit Ad Owner',
        business_name: `Audit Test Biz ${ts}`,
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        radius: 25,
        description: 'Audit trail test ad',
        status: 'pending',
        payment_status: 'pending_approval',
      },
    });
    adIds.push(ad.id);
    return ad;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    // Platform admin (floor mailbox). Reuse an existing row if the test DB
    // already has one so this suite stays re-runnable and non-destructive.
    const existingAdmin = await prisma.user.findUnique({
      where: { email: PLATFORM_ADMIN_EMAIL },
      select: { id: true, email_verified: true },
    });
    if (existingAdmin) {
      adminId = existingAdmin.id;
      if (!existingAdmin.email_verified) {
        await prisma.user.update({
          where: { id: adminId },
          data: { email_verified: true },
        });
      }
    } else {
      const admin = await prisma.user.create({
        data: {
          email: PLATFORM_ADMIN_EMAIL,
          password_hash: hash,
          display_name: 'Platform Admin',
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
      adminId = admin.id;
      adminCreatedByTest = true;
    }
    adminToken = signJwt({ id: adminId });

    const adOwner = await prisma.user.create({
      data: {
        email: `audit-ad-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Audit Ad Owner',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    adOwnerId = adOwner.id;

    // Org/team owner — approved coach shape (mirrors team-transfer-authorization).
    const orgOwner = await prisma.user.create({
      data: {
        email: `audit-org-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Audit Org Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    orgOwnerId = orgOwner.id;
    orgOwnerToken = signJwt({ id: orgOwnerId });

    const newOwner = await prisma.user.create({
      data: {
        email: `audit-new-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Audit New Owner',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        date_of_birth: new Date('1990-01-01'),
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
      },
    });
    newOwnerId = newOwner.id;

    const org = await prisma.organization.create({
      data: {
        name: `Audit Trail Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: orgOwnerId,
        updated_at: new Date(),
      },
      select: { id: true },
    });
    orgId = org.id;

    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: orgOwnerId, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: newOwnerId, role: 'member', status: 'active' },
      ],
    });

    const team = await prisma.team.create({
      data: { name: `Audit Trail Team ${ts}`, organization_id: orgId },
      select: { id: true },
    });
    teamId = team.id;

    await prisma.teamMembership.createMany({
      data: [
        { team_id: teamId, user_id: orgOwnerId, role: 'owner', status: 'active' },
        { team_id: teamId, user_id: newOwnerId, role: 'member', status: 'active' },
      ],
    });
  });

  afterAll(async () => {
    try {
      const targetIds = [...adIds, orgId, teamId].filter(Boolean);
      await prisma.adminActivityLog
        .deleteMany({ where: { target_id: { in: targetIds } } })
        .catch(() => {});
      await prisma.notification.deleteMany({ where: { user_id: adOwnerId } }).catch(() => {});
      await prisma.ad.deleteMany({ where: { id: { in: adIds } } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
      await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
      await prisma.organizationMembership
        .deleteMany({ where: { organization_id: orgId } })
        .catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
      const userIds = [adOwnerId, orgOwnerId, newOwnerId].filter(Boolean);
      if (adminCreatedByTest) userIds.push(adminId);
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('approveAd writes an AD_APPROVE row attributed to the acting admin', async () => {
    const ad = await createPendingAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);

    const log = await prisma.adminActivityLog.findFirst({
      where: { target_type: 'ad', target_id: ad.id, action: 'AD_APPROVE' },
      orderBy: { timestamp: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log.admin_id).toBe(adminId);
    expect(log.admin_email).toBe(PLATFORM_ADMIN_EMAIL);
    expect(log.target_type).toBe('ad');
    expect(log.target_id).toBe(ad.id);
    expect(log.timestamp).toBeTruthy();
  });

  it('rejectAd via email token writes an AD_REJECT row under the email-token sentinel', async () => {
    const ad = await createPendingAd();
    const token = signJwt({ adId: ad.id, action: 'reject_ad' }, '7d');

    const res = await request(app)
      .post(`/ads/${ad.id}/reject`)
      .query({ token })
      .send({ reason: 'Audit trail test rejection' });

    expect(res.status).toBe(200);

    const log = await prisma.adminActivityLog.findFirst({
      where: { target_type: 'ad', target_id: ad.id, action: 'AD_REJECT' },
      orderBy: { timestamp: 'desc' },
    });
    expect(log).toBeTruthy();
    // Email-link moderation has no authenticated admin — the sentinel keeps
    // the trail complete instead of dropping the row.
    expect(log.admin_id).toBe('email-token');
    expect(log.admin_email).toBe('email-token');
    expect(log.target_type).toBe('ad');
    expect(log.target_id).toBe(ad.id);
    expect(log.metadata?.note).toBe('Audit trail test rejection');
  });

  it('rejectAd via admin session writes an AD_REJECT row attributed to the admin', async () => {
    const ad = await createPendingAd();

    const res = await request(app)
      .post(`/ads/${ad.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Session rejection' });

    expect(res.status).toBe(200);

    const log = await prisma.adminActivityLog.findFirst({
      where: { target_type: 'ad', target_id: ad.id, action: 'AD_REJECT' },
      orderBy: { timestamp: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log.admin_id).toBe(adminId);
    expect(log.admin_email).toBe(PLATFORM_ADMIN_EMAIL);
    expect(log.target_id).toBe(ad.id);
  });

  it('org transfer-ownership writes a TRANSFER_ORG_OWNERSHIP row with actor + new owner', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .send({ new_owner_id: newOwnerId });

    expect(res.status).toBe(200);

    const log = await prisma.adminActivityLog.findFirst({
      where: { target_type: 'organization', target_id: orgId, action: 'TRANSFER_ORG_OWNERSHIP' },
      orderBy: { timestamp: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log.admin_id).toBe(orgOwnerId);
    expect(log.admin_email).toBe(`audit-org-owner-${ts}@example.com`);
    expect(log.target_type).toBe('organization');
    expect(log.target_id).toBe(orgId);
    expect(log.metadata?.new_owner_id).toBe(newOwnerId);
  });

  it('team transfer-ownership writes a TRANSFER_TEAM_OWNERSHIP row with actor + new owner', async () => {
    const res = await request(app)
      .post(`/teams/${teamId}/transfer-ownership`)
      .set('Authorization', `Bearer ${orgOwnerToken}`)
      .send({ new_owner_id: newOwnerId });

    expect(res.status).toBe(200);

    const log = await prisma.adminActivityLog.findFirst({
      where: { target_type: 'team', target_id: teamId, action: 'TRANSFER_TEAM_OWNERSHIP' },
      orderBy: { timestamp: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log.admin_id).toBe(orgOwnerId);
    expect(log.admin_email).toBe(`audit-org-owner-${ts}@example.com`);
    expect(log.target_type).toBe('team');
    expect(log.target_id).toBe(teamId);
    expect(log.metadata?.new_owner_id).toBe(newOwnerId);
  });
});
