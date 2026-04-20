import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Ad Report Flow', () => {
  let originalAdminEmails = '';
  let ownerId = '';
  let ownerToken = '';
  let reporterId = '';
  let reporterToken = '';
  let adminId = '';
  let adminToken = '';
  let adId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const owner = await prisma.user.create({
      data: {
        email: `ad-report-owner-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Owner',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    ownerId = owner.id;
    ownerToken = signJwt({ id: owner.id });

    const reporter = await prisma.user.create({
      data: {
        email: `ad-report-reporter-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Reporter',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    reporterId = reporter.id;
    reporterToken = signJwt({ id: reporter.id });

    const admin = await prisma.user.create({
      data: {
        email: `ad-report-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Ad Admin',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    adminId = admin.id;
    adminToken = signJwt({ id: admin.id });

    originalAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [admin.email, originalAdminEmails].filter(Boolean).join(',');

    const ad = await prisma.ad.create({
      data: {
        user_id: owner.id,
        contact_name: 'Ad Owner',
        contact_email: owner.email,
        business_name: `Reported Biz ${ts}`,
        banner_url: 'https://example.com/banner.jpg',
        target_url: 'https://example.com',
        target_zip_code: '10001',
        radius: 25,
        description: 'Reported ad copy',
        status: 'active',
        payment_status: 'paid',
      },
    });
    adId = ad.id;
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = originalAdminEmails;

    try {
      await prisma.notification.deleteMany({
        where: { user_id: { in: [ownerId, reporterId, adminId].filter(Boolean) } },
      }).catch(() => {});
      await prisma.abuseReport.deleteMany({
        where: {
          OR: [
            { reporter_id: { in: [ownerId, reporterId].filter(Boolean) } },
            { subject: { contains: `[ad:${adId}]` } },
          ],
        },
      }).catch(() => {});
      await prisma.ad.deleteMany({ where: { id: adId } }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, reporterId, adminId].filter(Boolean) } },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('blocks users from reporting their own ad', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        target_type: 'ad',
        target_id: adId,
        reason: 'spam',
      });

    expect(res.status).toBe(400);
    expect(String(res.body?.error || '')).toMatch(/own ad/i);
  });

  it('creates an abuse report for ads', async () => {
    const res = await request(app)
      .post('/reports')
      .set('Authorization', `Bearer ${reporterToken}`)
      .send({
        target_type: 'ad',
        target_id: adId,
        reason: 'false_information',
        details: 'The ad claims something misleading.',
      });

    expect(res.status).toBe(201);
    expect(res.body?.ok).toBe(true);

    const report = await prisma.abuseReport.findUnique({ where: { id: res.body.reportId } });
    expect(report).toBeTruthy();
    expect(String(report.subject)).toContain(`[ad:${adId}]`);
  });

  it('lets admins take down a reported ad and resolves the report', async () => {
    const report = await prisma.abuseReport.create({
      data: {
        reporter_id: reporterId,
        reporter_name: 'Ad Reporter',
        reporter_email: `ad-report-reporter-${ts}@example.com`,
        subject: `[ad:${adId}] spam`,
        message: JSON.stringify({
          target_type: 'ad',
          target_id: adId,
          reason: 'spam',
          details: 'Manual test report',
        }),
        status: 'pending',
      },
    });

    const res = await request(app)
      .post(`/admin/reports/${report.id}/take-down-ad`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ resolution_note: 'Taken down after review.' });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.ad?.status).toBe('pending');
    expect(res.body?.report?.status).toBe('resolved');
  });
});
