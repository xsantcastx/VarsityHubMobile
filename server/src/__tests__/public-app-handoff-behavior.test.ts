import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { hashRefreshToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';
import { app } from '../testApp.js';
import { describeDb } from './dbTestGuard.js';
describeDb('Public app handoff behavior', () => {
  const cleanupUserIds = new Set<string>();

  beforeAll(async () => {
    process.env.APP_SCHEME = process.env.APP_SCHEME || 'varsityhubmobile';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const ids = Array.from(cleanupUserIds);
    if (ids.length > 0) {
      await prisma.refreshToken.deleteMany({ where: { user_id: { in: ids } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
    }
  });

  it('renders the expired verification handoff state with a resend CTA', async () => {
    const code = '123456';
    const user = await prisma.user.create({
      data: {
        email: `test-handoff-expired-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Expired Verify User',
        email_verified: false,
        email_verification_code: hashRefreshToken(code),
        email_verification_expires: new Date(Date.now() - 60_000),
        preferences: { role: 'fan', onboarding_completed: false },
      },
    });
    cleanupUserIds.add(user.id);

    const res = await request(app)
      .get(`/verify?email=${encodeURIComponent(user.email)}&token=${code}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Verification Link Expired');
    expect(res.text).toContain('Request a New Code');
    expect(res.text).toContain(user.email);
  });

  it('renders the valid reset-password handoff state with the manual backup code', async () => {
    const code = '654321';
    const user = await prisma.user.create({
      data: {
        email: `test-handoff-reset-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Reset User',
        email_verified: true,
        password_reset_code: hashRefreshToken(code),
        password_reset_expires: new Date(Date.now() + 30 * 60_000),
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    cleanupUserIds.add(user.id);

    const res = await request(app)
      .get(`/reset-password?email=${encodeURIComponent(user.email)}&code=${code}`)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Reset Your Password');
    expect(res.text).toContain('Manual Backup Code');
    expect(res.text).toContain(code);
  });

  it('resends verification codes for an unverified user and updates stored state', async () => {
    const staleCode = '111111';
    const user = await prisma.user.create({
      data: {
        email: `test-handoff-resend-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Resend User',
        email_verified: false,
        email_verification_code: hashRefreshToken(staleCode),
        email_verification_expires: new Date(Date.now() - 60_000),
        preferences: { role: 'fan', onboarding_completed: false },
      },
    });
    cleanupUserIds.add(user.id);

    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email_verification_code: true, email_verification_expires: true },
    });

    const res = await request(app)
      .post('/verify/resend')
      .type('form')
      .send({ email: user.email })
      .expect(200);

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email_verification_code: true, email_verification_expires: true },
    });

    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Check Your Email');
    expect(res.text).toContain(user.email);
    expect(String(after?.email_verification_code)).not.toBe(
      String(before?.email_verification_code)
    );
    expect(after?.email_verification_expires?.getTime()).toBeGreaterThan(
      before?.email_verification_expires?.getTime() || 0
    );
  });

  it('returns a handled 500 response when verify prevalidation throws', async () => {
    const findFirstSpy = jest
      .spyOn(prisma.user, 'findFirst')
      .mockRejectedValue(new Error('db boom'));

    const res = await request(app).get('/verify?email=test@example.com&token=123456').expect(500);

    expect(findFirstSpy).toHaveBeenCalled();
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toMatchObject({ error: 'db boom' });
  });
});
