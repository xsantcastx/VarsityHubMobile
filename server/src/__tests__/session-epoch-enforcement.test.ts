/**
 * Session epoch enforcement tests.
 *
 * Covers:
 * - Tokens with a stale `se` claim are rejected (session_epoch mismatch)
 * - `password_changed_at` invalidates tokens issued before the change
 * - Banned users get 403 ACCOUNT_BANNED on any authed request
 * - Tokens without `se` (legacy) are accepted until they expire naturally
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { app } from '../testApp.js';
import { describeDb } from './helpers/dbTestSuite.js';

const ts = randomUUID();
const PASSWORD = 'TestPassword123!';

describeDb('Session epoch enforcement', () => {
  let prisma: any;
  let signJwt: any;
  let signAccessTokenForSession: any;
  let verifyJwt: any;

  let userId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt, signAccessTokenForSession, verifyJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `epoch-enforcement-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Epoch Test User',
        email_verified: true,
        approval_status: 'APPROVED',
        onboarding_completed: true,
        session_epoch: 1,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  });

  it('accepts a token with the correct session epoch', async () => {
    const token = signAccessTokenForSession(userId, 1);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('signs new access tokens with a revocable jti claim', async () => {
    const token = signAccessTokenForSession(userId, 1);
    const payload = verifyJwt<{ id: string; se: number; jti?: string }>(token);
    expect(payload?.id).toBe(userId);
    expect(payload?.se).toBe(1);
    expect(typeof payload?.jti).toBe('string');
    expect(payload?.jti).toHaveLength(32);
  });

  it('rejects a token with a stale session epoch', async () => {
    // Token has se=0, user has session_epoch=1 — should be rejected
    const staleToken = signAccessTokenForSession(userId, 0);
    const res = await request(app).get('/me').set('Authorization', `Bearer ${staleToken}`);
    // Auth middleware returns anonymous (next() without req.user) on epoch mismatch,
    // so /me should return 401 (not authed)
    expect(res.status).toBe(401);
  });

  it('rejects a token after session_epoch is bumped (e.g. password change)', async () => {
    const tokenBeforeBump = signAccessTokenForSession(userId, 1);

    // Simulate password change by bumping session_epoch
    await prisma.user.update({
      where: { id: userId },
      data: { session_epoch: { increment: 1 } },
    });

    const res = await request(app).get('/me').set('Authorization', `Bearer ${tokenBeforeBump}`);
    expect(res.status).toBe(401);

    // Restore for subsequent tests
    await prisma.user.update({ where: { id: userId }, data: { session_epoch: 1 } });
  });

  it('accepts a legacy token (no se claim) — backwards compat during migration', async () => {
    // Legacy token has no `se` — auth middleware treats it as valid until expiry
    const legacyToken = signJwt({ id: userId }); // no se
    const res = await request(app).get('/me').set('Authorization', `Bearer ${legacyToken}`);
    expect(res.status).toBe(200);
  });

  it('rejects a token issued before password_changed_at', async () => {
    const pastDate = new Date(Date.now() - 60_000); // 60s ago
    // Sign a token whose iat will be < password_changed_at
    const oldToken = signJwt({ id: userId, se: 1 }, '1s');

    // Wait 1s so token is definitively older than "now"
    await new Promise(r => setTimeout(r, 1100));

    // Set password_changed_at to "now" — token is now pre-change
    await prisma.user.update({
      where: { id: userId },
      data: { password_changed_at: new Date() },
    });

    const res = await request(app).get('/me').set('Authorization', `Bearer ${oldToken}`);
    expect(res.status).toBe(401);

    // Clean up
    await prisma.user.update({ where: { id: userId }, data: { password_changed_at: null } });
  });

  it('banned user gets 403 ACCOUNT_BANNED on any authed request', async () => {
    const token = signAccessTokenForSession(userId, 1);

    // Ban the user mid-session
    await prisma.user.update({
      where: { id: userId },
      data: { banned: true, ban_reason: 'Test ban' },
    });

    const res = await request(app).get('/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BANNED');

    // Unban for cleanup
    await prisma.user.update({ where: { id: userId }, data: { banned: false, ban_reason: null } });
  });
});
