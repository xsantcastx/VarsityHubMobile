/**
 * Refresh-token rotation grace window.
 *
 * Root cause (prod logs 2026-07-19): /auth/refresh rotated by delete-old +
 * create-new. When the endpoint was slow (~5.6s: bcrypt verify + cross-region
 * DB latency) the client aborted before saving the new token, then retried with
 * the now-deleted old token → the delete/create P2025 path treated it as reuse
 * and called revokeAllSessions(), nuking every session → forced sign-out loop.
 *
 * Fix: rotation supersedes (marks rotated_at) instead of deleting. A
 * re-presented, already-rotated token is served a fresh pair — WITHOUT
 * revoking — when it is within the grace window AND from the same device.
 * Outside the window, or from a different device, the theft path
 * (revokeAllSessions + TOKEN_REUSED) still fires.
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

const ts = randomUUID();
const PASSWORD = 'TestPassword123!';
const DEVICE_A = 'vh1:aaaaaaaaaaaaaaaaaaaaaaaa';
const DEVICE_B = 'vh1:bbbbbbbbbbbbbbbbbbbbbbbb';
// Header the client sends for the device fingerprint (raw id, no vh1: prefix).
const DEVICE_A_HEADER = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const DEVICE_B_HEADER = 'bbbbbbbbbbbbbbbbbbbbbbbb';

describeDb('Refresh-token rotation grace window', () => {
  let prisma: any;
  let generateRefreshTokenV2: any;
  let hashRefreshTokenSecret: any;
  let REFRESH_TOKEN_HASH_VERSION_V2: number;
  let REFRESH_ROTATION_GRACE_MS: number;
  let REFRESH_TOKEN_EXPIRY_DAYS: number;

  let userId = '';
  let email = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({
      generateRefreshTokenV2,
      hashRefreshTokenSecret,
      REFRESH_TOKEN_HASH_VERSION_V2,
      REFRESH_ROTATION_GRACE_MS,
      REFRESH_TOKEN_EXPIRY_DAYS,
    } = await import('../lib/jwt.js'));

    email = `rotation-grace-${ts}@example.com`;
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: hash,
        display_name: 'Rotation Grace User',
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

  // Insert a token row directly so we can control rotated_at / device_info.
  async function insertToken(opts: {
    rotatedAt?: Date | null;
    deviceInfo?: string | null;
    expiresAt?: Date;
  }): Promise<{ raw: string; keyId: string }> {
    const { raw, keyId, secret } = generateRefreshTokenV2();
    const tokenHash = await hashRefreshTokenSecret(secret);
    await prisma.refreshToken.create({
      data: {
        token_hash: tokenHash,
        key_id: keyId,
        hash_version: REFRESH_TOKEN_HASH_VERSION_V2,
        user_id: userId,
        expires_at:
          opts.expiresAt ?? new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        device_info: opts.deviceInfo ?? null,
        rotated_at: opts.rotatedAt ?? null,
        replaced_by_key_id: opts.rotatedAt ? 'somereplacementkey' : null,
      },
    });
    return { raw, keyId };
  }

  async function sessionEpoch(): Promise<number> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { session_epoch: true },
    });
    return (u?.session_epoch as number) ?? 0;
  }

  it('re-presented rotated token within grace + same device → fresh pair, no revoke, original row preserved', async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    const epochBefore = await sessionEpoch();

    // A sibling active session that must survive (proves no revoke-all).
    const sibling = await insertToken({ deviceInfo: DEVICE_A, expiresAt: undefined });

    // A token that was just rotated (superseded) on device A.
    const rotated = await insertToken({
      rotatedAt: new Date(),
      deviceInfo: DEVICE_A,
      // Rotation shrinks the old token's expiry to the grace window.
      expiresAt: new Date(Date.now() + REFRESH_ROTATION_GRACE_MS),
    });

    // Re-present it from the SAME device, within grace.
    const res = await request(app)
      .post('/auth/refresh')
      .set('x-varsityhub-device-id', DEVICE_A_HEADER)
      .send({ refresh_token: rotated.raw });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBeTruthy();
    expect(res.body.refresh_token).toBeTruthy();
    expect(res.body.code).toBeUndefined();

    // The grace serve must NOT destroy the rotated row — repeated retries inside
    // the window keep working. (Old delete-based rotation would have removed it.)
    const originalRow = await prisma.refreshToken.findUnique({ where: { key_id: rotated.keyId } });
    expect(originalRow).not.toBeNull();

    // No revoke: sibling session survives and the epoch is unchanged.
    const siblingRow = await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } });
    expect(siblingRow).not.toBeNull();
    expect(await sessionEpoch()).toBe(epochBefore);
  });

  it('re-presented rotated token PAST grace → 401 TOKEN_REUSED and revokes all sessions', async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    const epochBefore = await sessionEpoch();

    const sibling = await insertToken({ deviceInfo: DEVICE_A });

    // Rotated well outside the grace window (old row also naturally expired).
    const rotated = await insertToken({
      rotatedAt: new Date(Date.now() - REFRESH_ROTATION_GRACE_MS - 120_000),
      deviceInfo: DEVICE_A,
      expiresAt: new Date(Date.now() - 120_000),
    });

    const res = await request(app)
      .post('/auth/refresh')
      .set('x-varsityhub-device-id', DEVICE_A_HEADER)
      .send({ refresh_token: rotated.raw });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSED');

    // Theft path revoked everything.
    const siblingRow = await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } });
    expect(siblingRow).toBeNull();
    expect(await sessionEpoch()).toBe(epochBefore + 1);
  });

  it('re-presented rotated token within grace but from a DIFFERENT device → 401 TOKEN_REUSED and revokes', async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    const epochBefore = await sessionEpoch();

    const sibling = await insertToken({ deviceInfo: DEVICE_A });

    // Rotated on device A, within grace...
    const rotated = await insertToken({
      rotatedAt: new Date(),
      deviceInfo: DEVICE_A,
      expiresAt: new Date(Date.now() + REFRESH_ROTATION_GRACE_MS),
    });

    // ...but replayed from device B → real reuse/theft signal.
    const res = await request(app)
      .post('/auth/refresh')
      .set('x-varsityhub-device-id', DEVICE_B_HEADER)
      .send({ refresh_token: rotated.raw });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REUSED');

    const siblingRow = await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } });
    expect(siblingRow).toBeNull();
    expect(await sessionEpoch()).toBe(epochBefore + 1);
  });

  it('concurrent double-refresh of one token → both succeed via grace, neither revokes', async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } });
    const epochBefore = await sessionEpoch();

    const sibling = await insertToken({ deviceInfo: DEVICE_A });

    // A fresh, not-yet-rotated token (rotated_at = null).
    const fresh = await insertToken({ deviceInfo: DEVICE_A });

    // Fire two refreshes for the SAME token in parallel: one wins the rotation,
    // the other must be served from the grace window — neither may revoke.
    const [r1, r2] = await Promise.all([
      request(app)
        .post('/auth/refresh')
        .set('x-varsityhub-device-id', DEVICE_A_HEADER)
        .send({ refresh_token: fresh.raw }),
      request(app)
        .post('/auth/refresh')
        .set('x-varsityhub-device-id', DEVICE_A_HEADER)
        .send({ refresh_token: fresh.raw }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.refresh_token).toBeTruthy();
    expect(r2.body.refresh_token).toBeTruthy();

    // Sibling survives, epoch unchanged → no revoke-all fired.
    const siblingRow = await prisma.refreshToken.findUnique({ where: { key_id: sibling.keyId } });
    expect(siblingRow).not.toBeNull();
    expect(await sessionEpoch()).toBe(epochBefore);
  });
});
