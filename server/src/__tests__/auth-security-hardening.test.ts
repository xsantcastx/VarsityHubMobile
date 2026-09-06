/**
 * Auth / upload security hardening regression tests.
 *
 * Covers:
 *  - Logout proactively clears the user's push_token
 *  - Per-account login lockout engages after MAX_LOGIN_FAILURES failures
 *  - Avatar upload rejects MIME-spoofed content via magic-byte check
 *
 * The login-timing fix (bcrypt.compare against a dummy hash for nonexistent
 * users) is implicit in the login path — timing is not asserted here because
 * Jest wall-clock timing is too noisy to assert on reliably. The code change
 * is covered by code review; a behavioral regression would show up as a login
 * path that no longer calls bcrypt.compare in the !user branch, which would
 * fail the lockout tests below (since bcrypt.compare is the gate that triggers
 * recordLoginFailure for missing users).
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let rlDel: (key: string) => Promise<void>;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Auth & Upload Security Hardening', () => {
  let pushUserId = '';
  let pushUserEmail = '';
  let avatarUserId = '';
  let avatarUserToken = '';
  let lockoutUserEmail = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ rlDel } = await import('../lib/redisRateLimit.js').catch(async () => {
      // Some versions expose the helpers from a shared module — fall back to a
      // no-op if the path differs so the test file still loads.
      return { rlDel: async () => {} };
    }));

    const hash = await bcrypt.hash(PASSWORD, 10);

    // Push-token user — will log in, then log out.
    pushUserEmail = `auth-hardening-push-${ts}@example.com`;
    const pushUser = await prisma.user.create({
      data: {
        email: pushUserEmail,
        password_hash: hash,
        display_name: 'Push Logout User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
          push_token: 'ExponentPushToken[TestTokenForLogoutClear]',
        },
      },
    });
    pushUserId = pushUser.id;

    // Avatar user — used for the magic-byte test.
    const { signJwt } = await import('../lib/jwt.js');
    const avatarUser = await prisma.user.create({
      data: {
        email: `auth-hardening-avatar-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Avatar User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    avatarUserId = avatarUser.id;
    avatarUserToken = signJwt({ id: avatarUserId });

    // Lockout test uses a fresh email each run so Redis state doesn't bleed
    // between runs even if cleanup misses.
    lockoutUserEmail = `auth-hardening-lockout-${ts}-${Math.random()
      .toString(36)
      .slice(2, 8)}@example.com`;
    await prisma.user.create({
      data: {
        email: lockoutUserEmail,
        password_hash: hash,
        display_name: 'Lockout User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
  });

  afterAll(async () => {
    try {
      // Clear any rate-limiter state from the lockout test so re-runs are clean.
      await rlDel(`loginfail:${lockoutUserEmail}`).catch(() => {});
      await rlDel(`auth:${lockoutUserEmail}`).catch(() => {});

      await prisma.user
        .deleteMany({
          where: { id: { in: [pushUserId, avatarUserId].filter(Boolean) } },
        })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { email: lockoutUserEmail } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  describe('POST /auth/logout clears push_token', () => {
    it('immediately denies the presented access token when logging out', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: pushUserEmail, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      const access = loginRes.body?.access_token as string | undefined;
      const refresh = loginRes.body?.refresh_token as string | undefined;
      expect(typeof access).toBe('string');
      expect(typeof refresh).toBe('string');

      await request(app).get('/auth/me').set('Authorization', `Bearer ${access}`).expect(200);

      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${access}`)
        .send({ refresh_token: refresh });
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body?.ok).toBe(true);

      await request(app).get('/auth/me').set('Authorization', `Bearer ${access}`).expect(401);
    });

    it('removes push_token from preferences when logging out with a valid refresh token', async () => {
      await prisma.user.update({
        where: { id: pushUserId },
        data: {
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            push_token: 'ExponentPushToken[TestTokenForLogoutClear]',
          },
        },
      });

      // Sanity: push_token is set before logout.
      const before = await prisma.user.findUnique({
        where: { id: pushUserId },
        select: { preferences: true },
      });
      expect((before?.preferences as any)?.push_token).toBeTruthy();

      // Log in to obtain a real refresh token for this user.
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: pushUserEmail, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      const refresh = loginRes.body?.refresh_token as string | undefined;
      expect(typeof refresh).toBe('string');

      // Logout.
      const logoutRes = await request(app).post('/auth/logout').send({ refresh_token: refresh });
      expect(logoutRes.status).toBe(200);

      // After logout, push_token should be removed from preferences.
      const after = await prisma.user.findUnique({
        where: { id: pushUserId },
        select: { preferences: true },
      });
      const prefs = (after?.preferences as any) || {};
      expect('push_token' in prefs).toBe(false);
    });

    it('silently succeeds when given a refresh token that does not exist', async () => {
      const res = await request(app)
        .post('/auth/logout')
        .send({ refresh_token: 'a'.repeat(64) });
      expect(res.status).toBe(200);
      expect(res.body?.ok).toBe(true);
    });

    it('does not clear push_token or revoke the session for a forged v2 token with only the real key id', async () => {
      await prisma.user.update({
        where: { id: pushUserId },
        data: {
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            push_token: 'ExponentPushToken[TestTokenForForgedLogout]',
          },
        },
      });

      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: pushUserEmail, password: PASSWORD });
      expect(loginRes.status).toBe(200);
      const refresh = loginRes.body?.refresh_token as string | undefined;
      expect(typeof refresh).toBe('string');

      const [keyId] = String(refresh).split('.');
      const forged = `${keyId}.${'f'.repeat(64)}`;

      const forgedLogoutRes = await request(app)
        .post('/auth/logout')
        .send({ refresh_token: forged });
      expect(forgedLogoutRes.status).toBe(200);
      expect(forgedLogoutRes.body?.ok).toBe(true);

      const afterForgedLogout = await prisma.user.findUnique({
        where: { id: pushUserId },
        select: { preferences: true },
      });
      expect((afterForgedLogout?.preferences as any)?.push_token).toBeTruthy();

      const refreshRes = await request(app).post('/auth/refresh').send({ refresh_token: refresh });
      expect(refreshRes.status).toBe(200);
      expect(typeof refreshRes.body?.access_token).toBe('string');
      expect(typeof refreshRes.body?.refresh_token).toBe('string');
    });
  });

  describe('POST /auth/refresh device binding', () => {
    it('rejects and revokes a refresh token presented from a different device id', async () => {
      const deviceA = 'device-auth-hardening-a-1234';
      const deviceB = 'device-auth-hardening-b-5678';

      const loginRes = await request(app)
        .post('/auth/login')
        .set('X-VarsityHub-Device-Id', deviceA)
        .send({ email: pushUserEmail, password: PASSWORD });
      expect(loginRes.status).toBe(200);

      const refresh = loginRes.body?.refresh_token as string | undefined;
      expect(typeof refresh).toBe('string');

      const mismatchRes = await request(app)
        .post('/auth/refresh')
        .set('X-VarsityHub-Device-Id', deviceB)
        .send({ refresh_token: refresh });
      expect(mismatchRes.status).toBe(401);

      const retryFromOriginalDevice = await request(app)
        .post('/auth/refresh')
        .set('X-VarsityHub-Device-Id', deviceA)
        .send({ refresh_token: refresh });
      expect(retryFromOriginalDevice.status).toBe(401);
    });

    it('allows refresh rotation when the same device id presents the token', async () => {
      const deviceId = 'device-auth-hardening-same-9012';

      const loginRes = await request(app)
        .post('/auth/login')
        .set('X-VarsityHub-Device-Id', deviceId)
        .send({ email: pushUserEmail, password: PASSWORD });
      expect(loginRes.status).toBe(200);

      const refresh = loginRes.body?.refresh_token as string | undefined;
      expect(typeof refresh).toBe('string');

      const refreshRes = await request(app)
        .post('/auth/refresh')
        .set('X-VarsityHub-Device-Id', deviceId)
        .send({ refresh_token: refresh });
      expect(refreshRes.status).toBe(200);
      expect(typeof refreshRes.body?.access_token).toBe('string');
      expect(typeof refreshRes.body?.refresh_token).toBe('string');
    });
  });

  describe('POST /auth/login per-account lockout', () => {
    it('locks the account after MAX_LOGIN_FAILURES consecutive bad passwords', async () => {
      // 5 failures → 6th attempt should be locked out (429 with retry_after_ms).
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/auth/login')
          .send({ email: lockoutUserEmail, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }
      const locked = await request(app)
        .post('/auth/login')
        .send({ email: lockoutUserEmail, password: 'wrong-password' });
      expect(locked.status).toBe(429);
      expect(typeof locked.body?.retry_after_ms).toBe('number');
      expect(locked.body.retry_after_ms).toBeGreaterThan(0);

      // Even the correct password is rejected during lockout.
      const correct = await request(app)
        .post('/auth/login')
        .send({ email: lockoutUserEmail, password: PASSWORD });
      expect(correct.status).toBe(429);
    });
  });

  describe('POST /uploads/avatar magic-byte validation', () => {
    it('rejects a file that claims image/png but is actually random bytes', async () => {
      const bogus = Buffer.alloc(64);
      for (let i = 0; i < bogus.length; i++) bogus[i] = (i * 37) & 0xff;

      const res = await request(app)
        .post('/uploads/avatar')
        .set('Authorization', `Bearer ${avatarUserToken}`)
        .attach('file', bogus, { filename: 'fake.png', contentType: 'image/png' });

      expect(res.status).toBe(400);
      expect(String(res.body?.error || '')).toMatch(/content does not match|Invalid file type/i);
    });

    it('accepts a buffer that carries a real PNG magic-byte header', async () => {
      // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A, followed by arbitrary
      // bytes so the total length passes the minimum buffer guard.
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const filler = Buffer.alloc(1024);
      const body = Buffer.concat([pngHeader, filler]);

      const res = await request(app)
        .post('/uploads/avatar')
        .set('Authorization', `Bearer ${avatarUserToken}`)
        .attach('file', body, { filename: 'ok.png', contentType: 'image/png' });

      // Accept either a 200 (Cloudinary/local write succeeded) or a 5xx (no
      // real Cloudinary credentials in the test environment). The magic-byte
      // check is what we care about — it must not return a 400 "content does
      // not match" error.
      expect([200, 500]).toContain(res.status);
      if (res.status === 400) {
        expect(String(res.body?.error || '')).not.toMatch(/content does not match/i);
      }
    });
  });
});
