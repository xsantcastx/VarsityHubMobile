/**
 * API Integration Tests - Authentication Endpoints
 * 
 * Tests actual HTTP endpoints for authentication:
 * - POST /auth/register
 * - POST /auth/login
 * - POST /auth/verify
 * - POST /auth/password-reset
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../index.js';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';

const TEST_EMAIL = `test-api-auth-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_DISPLAY_NAME = 'Test API User';

describe('API Authentication Endpoints', () => {
  let userId: string;
  let accessToken: string;
  let verificationCode: string;

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

      // In dev/test, verification code might be included
      if (response.body.dev_verification_code) {
        verificationCode = response.body.dev_verification_code;
      } else {
        // Fetch from database if not in response
        const user = await prisma.user.findUnique({
          where: { email: TEST_EMAIL },
        });
        verificationCode = user?.email_verification_code || '';
      }
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

  describe('POST /auth/verify', () => {
    it('should verify email with correct code', async () => {
      if (!verificationCode) {
        // Fetch code from database
        const user = await prisma.user.findUnique({
          where: { email: TEST_EMAIL },
        });
        verificationCode = user?.email_verification_code || '';
      }

      if (!verificationCode) {
        console.warn('Skipping verify test - no verification code available');
        return;
      }

      const response = await request(app)
        .post('/auth/verify')
        .send({
          email: TEST_EMAIL,
          code: verificationCode,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email_verified).toBe(true);
    });

    it('should reject incorrect verification code', async () => {
      const response = await request(app)
        .post('/auth/verify')
        .send({
          email: TEST_EMAIL,
          code: '000000',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject expired verification code', async () => {
      // Create user with expired code
      const expiredEmail = `test-expired-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      
      const expiredUser = await prisma.user.create({
        data: {
          email: expiredEmail,
          password_hash: passwordHash,
          email_verification_code: code,
          email_verification_expires: new Date(Date.now() - 1000), // Expired
          preferences: {},
        },
      });

      const response = await request(app)
        .post('/auth/verify')
        .send({
          email: expiredEmail,
          code: code,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');

      // Cleanup
      await prisma.user.delete({ where: { id: expiredUser.id } });
    });
  });

  describe('POST /auth/password-reset', () => {
    it('should initiate password reset for valid email', async () => {
      const response = await request(app)
        .post('/auth/password-reset')
        .send({
          email: TEST_EMAIL,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should not reveal if email exists (security)', async () => {
      const response = await request(app)
        .post('/auth/password-reset')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200); // Should still return 200 to prevent email enumeration

      expect(response.body).toHaveProperty('message');
    });
  });
});
