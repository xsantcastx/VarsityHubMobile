#!/usr/bin/env tsx
import bcrypt from 'bcrypt';
import request from 'supertest';
import { prisma } from '../src/lib/prisma.js';

const PASSWORD = 'TestPassword123!';
const NEW_PASSWORD = 'NewPassword456!';
const ts = Date.now();

function assertStatus(actual: number, expected: number, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_PROVIDER = 'test';
  const { app } = await import('../src/testApp.js');

  const email = `session-enforcement-${ts}@example.com`;
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

  try {
    const loginA = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    assertStatus(loginA.status, 200, 'login A');
    const tokenA = String(loginA.body?.access_token || '');
    if (!tokenA) throw new Error('login A did not return an access token');

    const loginB = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    assertStatus(loginB.status, 200, 'login B');
    const tokenB = String(loginB.body?.access_token || '');
    if (!tokenB) throw new Error('login B did not return an access token');

    const meWithOldToken = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    assertStatus(meWithOldToken.status, 200, 'prior token remains valid after relogin');

    const meWithNewToken = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    assertStatus(meWithNewToken.status, 200, 'current token after relogin');

    const passwordChange = await request(app)
      .post('/auth/password/change')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        current_password: PASSWORD,
        new_password: NEW_PASSWORD,
      });
    assertStatus(passwordChange.status, 200, 'password change');

    const meAfterPasswordChange = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    assertStatus(meAfterPasswordChange.status, 401, 'stale token after password change');

    const meWithFirstTokenAfterPasswordChange = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    assertStatus(
      meWithFirstTokenAfterPasswordChange.status,
      401,
      'all prior tokens invalidated after password change'
    );

    const loginC = await request(app).post('/auth/login').send({ email, password: NEW_PASSWORD });
    assertStatus(loginC.status, 200, 'login C');
    const tokenC = String(loginC.body?.access_token || '');
    if (!tokenC) throw new Error('login C did not return an access token');

    const meAfterRelogin = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokenC}`);
    assertStatus(meAfterRelogin.status, 200, 'current token after password reset relogin');

    console.log(JSON.stringify({ ok: true, userId: user.id }, null, 2));
  } finally {
    await prisma.refreshToken.deleteMany({ where: { user_id: user.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
  }
}

void main()
  .then(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
