/**
 * Promo code endpoints — auth, validation, and invalid code handling.
 *
 * These tests don't create real promo codes (that requires a separate admin
 * tool); they verify the auth boundary and schema validation gates fire
 * correctly, which is the most critical security surface for these routes.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

describe('POST /promos/preview', () => {
  let userId: string;
  let userToken: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `promos-preview-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    userToken = signJwt({ id: userId });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/promos/preview')
      .send({ code: 'TEST10', subtotal_cents: 1000 });
    expect(res.status).toBe(401);
  });

  it('400 when payload is invalid', async () => {
    const res = await request(app)
      .post('/promos/preview')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ subtotal_cents: -1 }); // missing code, negative amount
    expect(res.status).toBe(400);
  });

  it('returns a preview result (invalid code returns structured error, not 500)', async () => {
    const res = await request(app)
      .post('/promos/preview')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'INVALID_CODE_XYZ', subtotal_cents: 1000 });
    // Valid auth + valid schema → should get a business-logic response, not a crash
    expect([200, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('POST /promos/redeem', () => {
  let userId: string;
  let userToken: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
      data: {
        email: `promos-redeem-${Date.now()}@test.com`,
        password_hash: hash,
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
    userToken = signJwt({ id: userId });
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: userId } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/promos/redeem')
      .send({ code: 'TEST10', subtotal_cents: 1000 });
    expect(res.status).toBe(401);
  });

  it('400 when payload is invalid', async () => {
    const res = await request(app)
      .post('/promos/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({}); // empty body
    expect(res.status).toBe(400);
  });

  it('returns a structured error for an invalid code (not 500)', async () => {
    const res = await request(app)
      .post('/promos/redeem')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ code: 'INVALID_CODE_XYZ', subtotal_cents: 1000 });
    expect([200, 400]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});
