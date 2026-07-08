import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();

describe('admin transactions route', () => {
  let adminUserId = '';
  let adminToken = '';
  let originalAdminEmails = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    originalAdminEmails = process.env.ADMIN_EMAILS || '';
    const adminEmail = `admin-transactions-${ts}@varsityhub.app`;
    process.env.ADMIN_EMAILS = adminEmail;
    // Admin ACCESS comes from the hardcoded floor; this is the test-only seam.
    process.env.TEST_PLATFORM_ADMIN_EMAILS = adminEmail;

    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        display_name: 'Admin Transactions Test',
        email_verified: true,
        role: 'fan',
        approval_status: 'APPROVED',
      },
      select: { id: true },
    });

    adminUserId = adminUser.id;
    adminToken = signJwt({ id: adminUserId });
  });

  afterAll(async () => {
    process.env.ADMIN_EMAILS = originalAdminEmails;
    delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
    if (adminUserId) {
      await prisma.user.deleteMany({ where: { id: adminUserId } });
    }
  });

  it('rejects invalid startDate filters with 400', async () => {
    const res = await request(app)
      .get('/admin/transactions?startDate=not-a-date')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: 'Invalid date format. Use ISO date strings for startDate and endDate.',
    });
  });
});
