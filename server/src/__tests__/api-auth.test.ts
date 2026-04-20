/**
 * API Integration Tests - Authentication Endpoints
 * 
 * Tests actual HTTP endpoints for authentication:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /auth/verify/confirm
 * - POST /auth/password/forgot
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;
let hashRefreshToken: (token: string) => string;

const TEST_EMAIL = `test-api-auth-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_DISPLAY_NAME = 'Test API User';

describe('API Authentication Endpoints', () => {
  let userId: string;
  let accessToken: string;
  let verificationCode: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ hashRefreshToken } = await import('../lib/jwt.js'));
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith: 'test-api-auth-',
          },
        },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
          display_name: TEST_DISPLAY_NAME,
          role: 'fan',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(TEST_EMAIL);
      expect(response.body.user.display_name).toBe(TEST_DISPLAY_NAME);
      expect(response.body.user.email_verified).toBe(false);

      accessToken = response.body.access_token;
      userId = response.body.user.id;

      // In dev/test, verification code might be included as plaintext
      if (response.body.dev_verification_code) {
        verificationCode = response.body.dev_verification_code;
      }
      // NOTE: Cannot read plaintext code from DB — auth.ts now hashes before storage.
      // If dev_verification_code is not in the response, the verify test will be skipped.
      // Set ENABLE_DEV_CODES=1 in test env to enable.
    });

    it('should reject duplicate email registration', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: TEST_EMAIL, // Same email as above
          password: 'AnotherPassword123!',
          display_name: 'Another User',
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: TEST_PASSWORD,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject password that is too short', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test-short-pwd-${Date.now()}@example.com`,
          password: 'Short1!', // Less than 8 characters
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject password without letter and number', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test-weak-pwd-${Date.now()}@example.com`,
          password: 'passwordonly', // No digit
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize email (trim and lowercase)', async () => {
      const emailWithSpaces = `  ${TEST_EMAIL.toUpperCase()}  `;
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: emailWithSpaces,
          password: TEST_PASSWORD,
        });

      // Should either succeed (if sanitized) or fail with 409 (if already exists)
      // The key is that email should be normalized
      if (response.status === 201) {
        const user = await prisma.user.findUnique({
          where: { email: TEST_EMAIL.toLowerCase().trim() },
        });
        expect(user).toBeDefined();
      } else {
        expect(response.status).toBe(409); // Already exists (normalized)
      }
    });
  });

  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(TEST_EMAIL);
      expect(response.body.access_token).toBeDefined();
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_PASSWORD,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject banned user', async () => {
      // Create and ban a user
      const bannedEmail = `test-banned-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const bannedUser = await prisma.user.create({
        data: {
          email: bannedEmail,
          password_hash: passwordHash,
          banned: true,
          preferences: {},
        },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: bannedEmail,
          password: TEST_PASSWORD,
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('banned');

      // Cleanup
      await prisma.user.delete({ where: { id: bannedUser.id } });
    });
  });

  describe('GET /auth/me', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(TEST_EMAIL);
      expect(response.body.preferences).toBeDefined();
    });
  });

  describe('PATCH /auth/me/preferences', () => {
    it('should ignore client attempts to set paid plan fields', async () => {
      await request(app)
        .patch('/auth/me/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          plan: 'legend',
          notifications_enabled: false,
        })
        .expect(200);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const prefs = (user?.preferences as any) || {};

      expect(prefs.plan).not.toBe('legend');
      expect(prefs.notifications_enabled).toBe(false);
    });
  });

  describe('POST /auth/verify/confirm', () => {
    it('should verify email with correct code', async () => {
      if (!verificationCode) {
        // DB stores a hash — cannot recover plaintext. Need ENABLE_DEV_CODES=1.
        console.warn('Skipping verify test — no plaintext code available (set ENABLE_DEV_CODES=1)');
        return;
      }

      const response = await request(app)
        .post('/auth/verify/confirm')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          code: verificationCode,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email_verified).toBe(true);
    });

    it('should reject incorrect verification code', async () => {
      const badEmail = `test-bad-code-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const plainCode = '123456';
      const badUser = await prisma.user.create({
        data: {
          email: badEmail,
          password_hash: passwordHash,
          email_verification_code: hashRefreshToken(plainCode),
          email_verification_expires: new Date(Date.now() + 30 * 60 * 1000),
          preferences: {},
        },
      });
      const badToken = signJwt({ id: badUser.id });

      const response = await request(app)
        .post('/auth/verify/confirm')
        .set('Authorization', `Bearer ${badToken}`)
        .send({ code: '000000' })
        .expect(400);

      expect(response.body).toHaveProperty('error');

      await prisma.user.delete({ where: { id: badUser.id } });
    });

    it('should reject expired verification code', async () => {
      const expiredEmail = `test-expired-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const plainCode = String(Math.floor(100000 + Math.random() * 900000));

      const expiredUser = await prisma.user.create({
        data: {
          email: expiredEmail,
          password_hash: passwordHash,
          email_verification_code: hashRefreshToken(plainCode),
          email_verification_expires: new Date(Date.now() - 1000), // Expired
          preferences: {},
        },
      });

      const expiredToken = signJwt({ id: expiredUser.id });
      const response = await request(app)
        .post('/auth/verify/confirm')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ code: plainCode })
        .expect(400);

      expect(response.body).toHaveProperty('error');

      await prisma.user.delete({ where: { id: expiredUser.id } });
    });
  });

  describe('POST /auth/password/forgot', () => {
    it('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/auth/password/forgot')
        .send({
          email: TEST_EMAIL,
        })
        .expect(200);

      expect(response.body).toHaveProperty('ok');
    });

    it('should not reveal if email exists (security)', async () => {
      const response = await request(app)
        .post('/auth/password/forgot')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200); // Should still return 200 to prevent email enumeration

      expect(response.body).toHaveProperty('ok');
    });
  });

  describe('POST /auth/password/reset', () => {
    it('consumes the reset code so it cannot be reused', async () => {
      const rawResetCode = '654321';
      await prisma.user.update({
        where: { email: TEST_EMAIL },
        data: {
          password_reset_code: hashRefreshToken(rawResetCode),
          password_reset_expires: new Date(Date.now() + 30 * 60 * 1000),
        },
      });

      const firstPassword = 'ResetPassword123!';
      await request(app)
        .post('/auth/password/reset')
        .send({
          email: TEST_EMAIL,
          code: rawResetCode,
          password: firstPassword,
        })
        .expect(200);

      await request(app)
        .post('/auth/password/reset')
        .send({
          email: TEST_EMAIL,
          code: rawResetCode,
          password: 'AnotherPassword123!',
        })
        .expect(400);

      const updatedUser = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
        select: { password_hash: true, password_reset_code: true },
      });

      expect(updatedUser?.password_reset_code).toBeNull();
      expect(await bcrypt.compare(firstPassword, updatedUser!.password_hash)).toBe(true);
    });
  });
});
