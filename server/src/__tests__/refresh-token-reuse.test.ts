/**
 * Refresh token reuse detection tests.
 *
 * Covers the token family detection logic added in commit ba17afa7:
 * - When a P2025 occurs during token rotation (token already deleted),
 *   all sessions for the affected user must be revoked.
 * - Returns { code: 'TOKEN_REUSED' } so callers can distinguish reuse
 *   from other 401s.
 * - A legitimately expired or invalid token still returns a plain 401.
 * - v1 → v2 lazy upgrade: refreshing a legacy v1 token issues a v2 token.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

const ts = randomUUID();
const PASSWORD = 'TestPassword123!';

describeDb('Refresh token reuse detection', () => {
  let prisma: any;
  let signJwt: any;
  let generateRefreshTokenV2: any;
  let hashRefreshTokenSecret: any;
  let generateRefreshToken: any;
  let hashRefreshToken: any;
  let REFRESH_TOKEN_HASH_VERSION_V2: number;

  let userId = '';
  let email = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({
      signJwt,
      generateRefreshTokenV2,
      hashRefreshTokenSecret,
      generateRefreshToken,
      hashRefreshToken,
      REFRESH_TOKEN_HASH_VERSION_V2,
    } = await import('../lib/jwt.js'));

    email = `refresh-reuse-${ts}@example.com`;
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hash,
        display_name: 'Reuse Test User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  it('returns TOKEN_REUSED and revokes all sessions when a rotated token is replayed', async () => {
    // 1. Login to get a real refresh token
    const login = await request(app).post('/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);
    const refreshToken: string = login.body.refresh_token;
    expect(refreshToken).toBeTruthy();

    // 2. First refresh — succeeds, old token is deleted, new one issued
    const refresh1 = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(refresh1.status).toBe(200);
    expect(refresh1.body.access_token).toBeTruthy();

    // 3. Replay the ORIGINAL token — it was deleted during step 2
    const refresh2 = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(refresh2.status).toBe(401);
    expect(refresh2.body.code).toBe('TOKEN_REUSED');

    // 4. The new token from step 2 should also be revoked (all sessions killed)
    const newRefreshToken: string = refresh1.body.refresh_token;
    const refresh3 = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: newRefreshToken });
    expect(refresh3.status).toBe(401);

    // 5. All DB refresh tokens for the user should be gone
    const remaining = await prisma.refreshToken.findMany({ where: { user_id: userId } });
    expect(remaining).toHaveLength(0);
  });

  it('returns plain 401 (no TOKEN_REUSED code) for a completely unknown token', async () => {
    const { raw } = generateRefreshTokenV2();
    const res = await request(app).post('/auth/refresh').send({ refresh_token: raw });
    expect(res.status).toBe(401);
    expect(res.body.code).toBeUndefined();
  });

  it('returns 401 for an expired refresh token and cleans it up', async () => {
    // Insert an already-expired v2 token directly into the DB
    const { raw, keyId, secret } = generateRefreshTokenV2();
    const tokenHash = await hashRefreshTokenSecret(secret);
    await prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        key_id: keyId,
        hash_version: REFRESH_TOKEN_HASH_VERSION_V2,
        user_id: userId,
        expires_at: new Date(Date.now() - 1000), // already expired
        device_info: null,
      },
    });

    const res = await request(app).post('/auth/refresh').send({ refresh_token: raw });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/expired/i);

    // Cleanup: expired token should be deleted
    const row = await prisma.refreshToken.findUnique({ where: { key_id: keyId } });
    expect(row).toBeNull();
  });

  it('v1 → v2 lazy upgrade: refreshing a legacy v1 token issues a v2 token back', async () => {
    // Insert a legacy v1 token (SHA-256 hash, no key_id, hash_version null/1)
    const rawV1 = generateRefreshToken(); // 64-char hex
    const tokenHashV1 = hashRefreshToken(rawV1);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        token_hash: tokenHashV1,
        hash_version: 1,
        user_id: userId,
        expires_at: expiresAt,
        device_info: null,
      },
    });

    const res = await request(app).post('/auth/refresh').send({ refresh_token: rawV1 });
    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();

    // New token is v2 shape: <16-hex-char>.<secret>
    const newRaw: string = res.body.refresh_token;
    const dotIdx = newRaw.indexOf('.');
    expect(dotIdx).toBe(16);
    expect(/^[a-f0-9]{16}$/.test(newRaw.slice(0, 16))).toBe(true);

    // Cleanup
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
  });
});
