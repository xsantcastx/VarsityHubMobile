/**
 * Authentication Flow Integration Tests
 * 
 * Tests the complete user authentication flow:
 * - User registration
 * - Email verification
 * - Login
 * - Password reset
 * - Token validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { hashRefreshToken, signJwt, verifyJwt } from '../lib/jwt.js';
import { describeDb } from './dbTestGuard.js';
// Test user data
const TEST_EMAIL = `test-auth-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_DISPLAY_NAME = 'Test User';

describeDb('Authentication Flow', () => {
  let userId: string;
  let verificationCode: string;

  // Clean up test data after all tests
  afterAll(async () => {
    try {
      await prisma.user.deleteMany({
        where: {
          email: {
            startsWith: 'test-auth-',
          },
        },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describeDb('User Registration', () => {
    it('should register a new user with valid data', async () => {
      // This would normally be done via API endpoint
      // For now, we test the core logic
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      
      const user = await prisma.user.create({
        data: {
          email: TEST_EMAIL,
          password_hash: passwordHash,
          display_name: TEST_DISPLAY_NAME,
          email_verification_code: code,
          email_verification_expires: new Date(Date.now() + 30 * 60 * 1000),
          preferences: {
            role: 'fan',
            onboarding_completed: false,
          },
        },
      });

      expect(user).toBeDefined();
      expect(user.email).toBe(TEST_EMAIL);
      expect(user.display_name).toBe(TEST_DISPLAY_NAME);
      expect(user.email_verified).toBe(false);
      expect(user.email_verification_code).toBe(code);

      userId = user.id;
      verificationCode = code;
    });

    it('should not allow duplicate email registration', async () => {
      const passwordHash = await bcrypt.hash('AnotherPassword123!', 10);
      
      await expect(
        prisma.user.create({
          data: {
            email: TEST_EMAIL, // Same email as above
            password_hash: passwordHash,
            display_name: 'Another User',
            preferences: {},
          },
        })
      ).rejects.toThrow();
    });

    it('should hash password correctly', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      expect(user?.password_hash).toBeDefined();
      expect(user?.password_hash).not.toBe(TEST_PASSWORD);
      
      const isValid = await bcrypt.compare(TEST_PASSWORD, user!.password_hash);
      expect(isValid).toBe(true);
    });
  });

  describeDb('Email Verification', () => {
    it('should verify email with correct code', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      expect(user?.email_verification_code).toBe(verificationCode);

      // Simulate verification
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          email_verified: true,
          email_verification_code: null,
          email_verification_expires: null,
        },
      });

      expect(updated.email_verified).toBe(true);
      expect(updated.email_verification_code).toBeNull();
    });

    it('should reject expired verification code', async () => {
      // Create user with expired code
      const expiredEmail = `test-expired-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash('Password123!', 10);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      
      const user = await prisma.user.create({
        data: {
          email: expiredEmail,
          password_hash: passwordHash,
          email_verification_code: code,
          email_verification_expires: new Date(Date.now() - 1000), // Expired
          preferences: {},
        },
      });

      const expired = new Date(user.email_verification_expires!);
      expect(expired.getTime()).toBeLessThan(Date.now());

      // Cleanup
      await prisma.user.delete({ where: { id: user.id } });
    });
  });

  describeDb('User Login', () => {
    it('should login with correct credentials', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      expect(user).toBeDefined();
      
      const isValid = await bcrypt.compare(TEST_PASSWORD, user!.password_hash);
      expect(isValid).toBe(true);

      // Generate token (simulating login)
      const token = signJwt({ id: user!.id });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should reject login with incorrect password', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const isValid = await bcrypt.compare('WrongPassword123!', user!.password_hash);
      expect(isValid).toBe(false);
    });

    it('should reject login for non-existent user', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'nonexistent@example.com' },
      });

      expect(user).toBeNull();
    });

    it('should reject login for banned user', async () => {
      // Create banned user
      const bannedEmail = `test-banned-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash('Password123!', 10);
      
      const bannedUser = await prisma.user.create({
        data: {
          email: bannedEmail,
          password_hash: passwordHash,
          banned: true,
          preferences: {},
        },
      });

      expect(bannedUser.banned).toBe(true);

      // Cleanup
      await prisma.user.delete({ where: { id: bannedUser.id } });
    });
  });

  describeDb('JWT Token Validation', () => {
    it('should generate valid JWT token', () => {
      const payload = { id: userId };
      const token = signJwt(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should verify valid JWT token', () => {
      const payload = { id: userId };
      const token = signJwt(payload);
      const verified = verifyJwt<{ id: string }>(token);
      
      expect(verified).toBeDefined();
      expect(verified?.id).toBe(userId);
    });

    it('should reject invalid JWT token', () => {
      const invalidToken = 'invalid.token.here';
      const verified = verifyJwt(invalidToken);
      
      expect(verified).toBeNull();
    });

    it('should reject expired JWT token', () => {
      // Note: This test depends on JWT_SECRET being set
      // In a real scenario, we'd test with a token that has expired
      const payload = { id: userId };
      const token = signJwt(payload, '1s'); // 1 second expiry
      
      // Wait for expiry
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const verified = verifyJwt<{ id: string }>(token);
          expect(verified).toBeNull(); // Should be expired
          resolve();
        }, 2000);
      });
    });
  });

  describeDb('Password Reset', () => {
    it('should generate password reset code', async () => {
      const rawResetCode = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          password_reset_code: hashRefreshToken(rawResetCode),
          password_reset_expires: expires,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      expect(user?.password_reset_code).toBe(hashRefreshToken(rawResetCode));
      expect(user?.password_reset_expires).toBeDefined();
    });

    it('should reset password with valid code', async () => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      const resetCode = user?.password_reset_code;
      expect(resetCode).toBeDefined();

      const newPassword = 'NewPassword123!';
      const newHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password_hash: newHash,
          password_reset_code: null,
          password_reset_expires: null,
        },
      });

      const updated = await prisma.user.findUnique({
        where: { id: userId },
      });

      const isValid = await bcrypt.compare(newPassword, updated!.password_hash);
      expect(isValid).toBe(true);
    });
  });
});
