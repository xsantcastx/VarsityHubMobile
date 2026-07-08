import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

let prisma: any;
let signJwt: any;
let app: import('express').Express;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Admin abuse-report email review routes', () => {
  let savedAdminEmails = '';
  let adminId = '';
  let adminEmail = '';
  let adminToken = '';
  let reportIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await import('../testApp.js'));
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: `abuse-review-admin-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Abuse Review Admin',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });

    adminId = admin.id;
    adminEmail = admin.email;
    adminToken = signJwt({ id: admin.id });

    savedAdminEmails = process.env.ADMIN_EMAILS || '';
    process.env.ADMIN_EMAILS = [admin.email, savedAdminEmails].filter(Boolean).join(',');
    // Admin ACCESS comes from the hardcoded floor; this is the test-only seam.
    process.env.TEST_PLATFORM_ADMIN_EMAILS = admin.email;
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = savedAdminEmails;
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
    if (reportIds.length > 0) {
      await prisma.adminActivityLog
        .deleteMany({
          where: { target_type: 'abuse_report', target_id: { in: reportIds } },
        })
        .catch(() => {});
      await prisma.abuseReport
        .deleteMany({
          where: { id: { in: reportIds } },
        })
        .catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: adminId } }).catch(() => {});
  });

  async function createReport(subject = '[post:post_123] harassment') {
    const report = await prisma.abuseReport.create({
      data: {
        reporter_name: 'Reporter',
        reporter_email: `reporter-${Date.now()}@example.com`,
        subject,
        message: JSON.stringify({
          reason: 'harassment',
          details: 'Target repeatedly harassed the reporter.',
        }),
        status: 'pending',
      },
    });
    reportIds.push(report.id);
    return report;
  }

  it('renders an HTML confirmation page for tokenized GET review links', async () => {
    const report = await createReport();
    const token = signJwt({ reportId: report.id, action: 'resolve_abuse_report' }, '7d');

    const res = await request(app).get(`/admin/reports/${report.id}/resolve`).query({ token });

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain('text/html');
    expect(res.text).toMatch(/Resolve Abuse Report/i);
    expect(res.text).toContain('Resolve Report');
  });

  it('allows token-only resolution and records email-token attribution', async () => {
    const report = await createReport();
    const token = signJwt({ reportId: report.id, action: 'resolve_abuse_report' }, '7d');

    const res = await request(app)
      .post(`/admin/reports/${report.id}/resolve`)
      .query({ token })
      .send({});

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Report Resolved/i);

    const updated = await prisma.abuseReport.findUnique({ where: { id: report.id } });
    expect(updated?.status).toBe('resolved');
    expect(updated?.reviewed_by).toBe('email-token');

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        target_type: 'abuse_report',
        target_id: report.id,
        action: 'RESOLVE_ABUSE_REPORT',
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit?.admin_email).toBe('email-token');
  });

  it('burns an abuse-report review token after first successful use', async () => {
    const report = await createReport();
    const token = signJwt({ reportId: report.id, action: 'dismiss_abuse_report' }, '7d');

    const first = await request(app)
      .post(`/admin/reports/${report.id}/dismiss`)
      .query({ token })
      .send({});

    const second = await request(app)
      .post(`/admin/reports/${report.id}/dismiss`)
      .query({ token })
      .send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.text).toMatch(/Link Already Used/i);
  });

  it('records the authenticated reviewer when a valid token is used with an admin session', async () => {
    const report = await createReport('[ad:ad_123] scam');
    const token = signJwt({ reportId: report.id, action: 'dismiss_abuse_report' }, '7d');

    const res = await request(app)
      .post(`/admin/reports/${report.id}/dismiss`)
      .query({ token })
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Report Dismissed/i);

    const updated = await prisma.abuseReport.findUnique({ where: { id: report.id } });
    expect(updated?.status).toBe('dismissed');
    expect(updated?.reviewed_by).toBe(adminId);

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        target_type: 'abuse_report',
        target_id: report.id,
        action: 'DISMISS_ABUSE_REPORT',
      },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit?.admin_id).toBe(adminId);
    expect(audit?.admin_email).toBe(adminEmail);
  });

  it('resolves a report when a signed-in admin POSTs without ?token= (dashboard path)', async () => {
    const report = await createReport('[post:post_dashboard] spam');

    const res = await request(app)
      .post(`/admin/reports/${report.id}/resolve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ note: 'cleaned up' });

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] || '')).toContain('application/json');
    expect(res.body?.ok).toBe(true);

    const updated = await prisma.abuseReport.findUnique({ where: { id: report.id } });
    expect(updated?.status).toBe('resolved');
    expect(updated?.reviewed_by).toBe(adminId);
  });

  it('returns JSON 401 when a non-admin POSTs without ?token=', async () => {
    const fanHash = await bcrypt.hash(PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: `report-fan-${ts}@example.com`,
        password_hash: fanHash,
        display_name: 'Report Fan',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    const fanToken = signJwt({ id: fan.id });
    const report = await createReport('[post:post_fan] noise');

    try {
      const res = await request(app)
        .post(`/admin/reports/${report.id}/dismiss`)
        .set('Authorization', `Bearer ${fanToken}`)
        .send({});

      expect(res.status).toBe(401);
      expect(String(res.headers['content-type'] || '')).toContain('application/json');
    } finally {
      await prisma.user.delete({ where: { id: fan.id } }).catch(() => {});
    }
  });
});
