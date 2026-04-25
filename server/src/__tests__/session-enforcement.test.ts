import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { prisma } from '../lib/prisma.js';
import { app } from '../testApp.js';

// randomUUID over Date.now() — two parallel runs at the same millisecond
// would otherwise collide on User.email unique constraint (audit Phase 7).
const ts = randomUUID();
const PASSWORD = 'TestPassword123!';
const NEW_PASSWORD = 'NewPassword456!';

describe('Session enforcement', () => {
  let userId = '';
  let email = '';

  beforeAll(async () => {
    email = `session-enforcement-${ts}@example.com`;
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        display_name: 'Session Test User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  it('invalidates the prior token after relogin and password change', async () => {
    const loginA = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    expect(loginA.status).toBe(200);
    const tokenA = loginA.body?.access_token as string | undefined;
    expect(tokenA).toBeTruthy();

    const loginB = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    expect(loginB.status).toBe(200);
    const tokenB = loginB.body?.access_token as string | undefined;
    expect(tokenB).toBeTruthy();

    const meWithOldToken = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(meWithOldToken.status).toBe(401);

    const meWithNewToken = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(meWithNewToken.status).toBe(200);

    const passwordChange = await request(app)
      .post('/auth/password/change')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
      });
    expect(passwordChange.status).toBe(200);

    const meAfterPasswordChange = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(meAfterPasswordChange.status).toBe(401);

    const loginC = await request(app).post('/auth/login').send({ email, password: NEW_PASSWORD });
    expect(loginC.status).toBe(200);
    const tokenC = loginC.body?.access_token as string | undefined;
    expect(tokenC).toBeTruthy();

    const meAfterRelogin = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenC}`);
    expect(meAfterRelogin.status).toBe(200);
  });
});
