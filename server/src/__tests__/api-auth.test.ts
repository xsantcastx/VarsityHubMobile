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
const TEST_DOB = '2000-01-01'; // COPPA: dob is required at register (adult DOB)

describe('API Authentication Endpoints', () => {
  let userId: string;
  let accessToken: string;
  let verificationCode: string;
  const cleanupUserIds = new Set<string>();
  const cleanupOrgIds = new Set<string>();

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ hashRefreshToken } = await import('../lib/jwt.js'));
  });

  afterAll(async () => {
    try {
      if (cleanupUserIds.size > 0) {
        await prisma.refreshToken
          .deleteMany({ where: { user_id: { in: Array.from(cleanupUserIds) } } })
          .catch(() => {});
        await prisma.user
          .deleteMany({ where: { id: { in: Array.from(cleanupUserIds) } } })
          .catch(() => {});
      }
      await prisma.user.deleteMany({
        where: {
          email: TEST_EMAIL,
        },
      });
      if (cleanupOrgIds.size > 0) {
        await prisma.organization
          .deleteMany({ where: { id: { in: Array.from(cleanupOrgIds) } } })
          .catch(() => {});
      }
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
          dob: TEST_DOB,
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
          dob: TEST_DOB,
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already registered');
    });

    it('should reject duplicate registration when the email casing differs', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: TEST_EMAIL.toUpperCase(),
          password: 'AnotherPassword123!',
          display_name: 'Another User',
          dob: TEST_DOB,
        })
        .expect(409);

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
      const response = await request(app).post('/auth/register').send({
        email: emailWithSpaces,
        password: TEST_PASSWORD,
        dob: TEST_DOB,
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

    it('should reject direct coach registration and require the upgrade flow', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test-direct-coach-${Date.now()}@example.com`,
          password: TEST_PASSWORD,
          role: 'coach',
          dob: TEST_DOB,
        })
        .expect(400);

      expect(response.body.code).toBe('COACH_REGISTRATION_DISABLED');
      expect(response.body.error).toMatch(/upgrade-to-coach|fan accounts/i);
    });

    it('should reject registration without a date of birth (COPPA)', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test-no-dob-${Date.now()}@example.com`,
          password: TEST_PASSWORD,
        })
        .expect(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration for an under-13 date of birth (COPPA)', async () => {
      const under13 = `${new Date().getFullYear() - 10}-01-01`; // ~10 years old
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `test-under13-${Date.now()}@example.com`,
          password: TEST_PASSWORD,
          dob: under13,
        })
        .expect(400);
      expect(JSON.stringify(response.body)).toMatch(/under 13|COPPA/i);
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

      // Refresh the shared accessToken — login bumps the user's
      // session_epoch, which invalidates the token from the earlier
      // /register call. Subsequent /auth/me tests must use this fresh token.
      accessToken = response.body.access_token;
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
      const response = await request(app).get('/auth/me').expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should return current user with valid token', async () => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          preferences: {
            role: 'fan',
            zip_code: '10001',
            location: 'New York, NY',
            header_image_url: 'https://cdn.varsityhub.test/profile-header.jpg',
            sports_interests: ['Basketball'],
          },
        },
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(TEST_EMAIL);
      expect(response.body.role).toBe('fan');
      expect(response.body.preferences).toBeDefined();
      expect(response.body.preferences.role).toBe('fan');
      expect(response.body.zip_code).toBe('10001');
      expect(response.body.location).toBe('New York, NY');
      expect(response.body.header_image_url).toBe('https://cdn.varsityhub.test/profile-header.jpg');
      expect(response.body.sports_interests).toEqual(['Basketball']);
    });

    it('should return canonical auth state in both top-level and preferences payloads', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Auth Me Contract Org ${Date.now()}`,
          org_type: 'club',
          updated_at: new Date(),
        },
      });
      cleanupOrgIds.add(org.id);

      await prisma.user.update({
        where: { id: userId },
        data: {
          role: 'coach',
          onboarding_completed: true,
          organization_id: org.id,
          approval_status: 'PENDING',
          preferences: {
            role: 'fan',
            onboarding_completed: false,
            organization_id: 'org-stale-preferences',
          },
        },
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.role).toBe('coach');
      expect(response.body.approval_status).toBe('PENDING');
      expect(response.body.onboarding_completed).toBe(true);
      expect(response.body.organization_id).toBe(org.id);
      expect(response.body.preferences.role).toBe('coach');
      expect(response.body.preferences.onboarding_completed).toBe(true);
      expect(response.body.preferences.organization_id).toBe(org.id);
    });

    it('should preserve stored preferences, send no-store headers, and hide internal auth fields', async () => {
      const now = Date.now();
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: 'fan',
          onboarding_completed: true,
          google_id: `google-auth-me-${now}`,
          apple_id: `apple-auth-me-${now}`,
          stripe_customer_id: `cus_auth_me_${now}`,
          parent_email: `parent-${now}@example.com`,
          parental_consent_status: 'pending',
          parental_consent_at: new Date('2026-01-01T00:00:00.000Z'),
          parental_consent_requested_at: new Date('2026-01-02T00:00:00.000Z'),
          parental_consent_token_hash: 'hashed-parent-token',
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            is_parent: true,
            notifications: {
              game_event_reminders: true,
              team_updates: true,
              comments_upvotes: true,
              follows_notifications: false,
              messages_notifications: false,
            },
          },
        },
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.headers['cache-control']).toBe('no-store, private');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['vary']).toContain('Authorization');

      expect(response.body.preferences.is_parent).toBe(true);
      expect(response.body.preferences.notifications).toEqual({
        game_event_reminders: true,
        team_updates: true,
        comments_upvotes: true,
        follows_notifications: false,
        messages_notifications: false,
      });

      expect(response.body.has_password).toBe(true);
      expect(response.body.linked_providers).toEqual({
        password: true,
        google: true,
        apple: true,
      });

      expect(response.body).not.toHaveProperty('password_hash');
      expect(response.body).not.toHaveProperty('google_id');
      expect(response.body).not.toHaveProperty('apple_id');
      expect(response.body).not.toHaveProperty('stripe_customer_id');
      expect(response.body).not.toHaveProperty('parent_email');
      expect(response.body).not.toHaveProperty('parental_consent_token_hash');
      expect(response.body).not.toHaveProperty('password_changed_at');
      expect(response.body).not.toHaveProperty('session_epoch');
    });

    it('should exclude soft-deleted posts from _count.posts', async () => {
      await prisma.post.deleteMany({ where: { author_id: userId } });
      await prisma.post.create({
        data: {
          author_id: userId,
          title: 'Active auth me post',
          content: 'Visible',
          type: 'post',
        },
      });
      await prisma.post.create({
        data: {
          author_id: userId,
          title: 'Deleted auth me post',
          content: 'Hidden',
          type: 'post',
          deleted_at: new Date(),
        },
      });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body._count.posts).toBe(1);
    });

    it('should return current user through the canonical /me alias', async () => {
      const response = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.email).toBe(TEST_EMAIL);
      expect(response.body).toHaveProperty('preferences');
      expect(response.headers['cache-control']).toBe('no-store, private');
    });
  });

  describe('POST /auth/revoke-all-tokens', () => {
    it('revokes refresh tokens and immediately invalidates the current access token', async () => {
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        })
        .expect(200);

      const currentAccessToken = loginResponse.body.access_token as string;
      const currentRefreshToken = loginResponse.body.refresh_token as string;
      expect(typeof currentAccessToken).toBe('string');
      expect(typeof currentRefreshToken).toBe('string');

      const revokeResponse = await request(app)
        .post('/auth/revoke-all-tokens')
        .set('Authorization', `Bearer ${currentAccessToken}`)
        .expect(200);

      expect(revokeResponse.body.ok).toBe(true);
      expect(revokeResponse.body.revoked).toBeGreaterThanOrEqual(1);

      await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${currentAccessToken}`)
        .expect(401);

      await request(app)
        .post('/auth/refresh')
        .send({ refresh_token: currentRefreshToken })
        .expect(401);

      const relogin = await request(app)
        .post('/auth/login')
        .send({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        })
        .expect(200);

      accessToken = relogin.body.access_token;
    });

    it('revokes every active session for the user, not just the caller session', async () => {
      const revokeTestEmail = `test-api-auth-revoke-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const revokeUser = await prisma.user.create({
        data: {
          email: revokeTestEmail,
          password_hash: passwordHash,
          display_name: 'API Auth Revoke User',
          email_verified: true,
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
      cleanupUserIds.add(revokeUser.id);

      const loginA = await request(app)
        .post('/auth/login')
        .send({
          email: revokeTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);

      const loginB = await request(app)
        .post('/auth/login')
        .send({
          email: revokeTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);

      const tokenA = String(loginA.body.access_token || '');
      const tokenB = String(loginB.body.access_token || '');
      const refreshA = String(loginA.body.refresh_token || '');
      const refreshB = String(loginB.body.refresh_token || '');

      const revokeResponse = await request(app)
        .post('/auth/revoke-all-tokens')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(revokeResponse.body.ok).toBe(true);
      expect(revokeResponse.body.revoked).toBeGreaterThanOrEqual(2);

      await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenA}`).expect(401);
      await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenB}`).expect(401);
      await request(app).post('/auth/refresh').send({ refresh_token: refreshA }).expect(401);
      await request(app).post('/auth/refresh').send({ refresh_token: refreshB }).expect(401);

      await request(app)
        .post('/auth/login')
        .send({
          email: revokeTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);
    });
  });

  describe('session invalidation across multiple active sessions', () => {
    it('password change immediately invalidates both active access tokens and both refresh tokens', async () => {
      const originalAccessToken = accessToken;
      const passwordTestEmail = `test-api-auth-password-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const passwordUser = await prisma.user.create({
        data: {
          email: passwordTestEmail,
          password_hash: passwordHash,
          display_name: 'API Auth Password Change User',
          email_verified: true,
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
      cleanupUserIds.add(passwordUser.id);

      const loginA = await request(app)
        .post('/auth/login')
        .send({
          email: passwordTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);
      const loginB = await request(app)
        .post('/auth/login')
        .send({
          email: passwordTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);

      const tokenA = String(loginA.body.access_token || '');
      const tokenB = String(loginB.body.access_token || '');
      const refreshA = String(loginA.body.refresh_token || '');
      const refreshB = String(loginB.body.refresh_token || '');

      await request(app)
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          current_password: TEST_PASSWORD,
          new_password: 'TestPassword456!',
        })
        .expect(200);

      await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenA}`).expect(401);
      await request(app).get('/auth/me').set('Authorization', `Bearer ${tokenB}`).expect(401);
      await request(app).post('/auth/refresh').send({ refresh_token: refreshA }).expect(401);
      await request(app).post('/auth/refresh').send({ refresh_token: refreshB }).expect(401);

      const relogin = await request(app)
        .post('/auth/login')
        .send({
          email: passwordTestEmail,
          password: 'TestPassword456!',
        })
        .expect(200);

      accessToken = relogin.body.access_token;

      await request(app)
        .post('/auth/password/change')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          current_password: 'TestPassword456!',
          new_password: TEST_PASSWORD,
        })
        .expect(200);

      const restoreLogin = await request(app)
        .post('/auth/login')
        .send({
          email: passwordTestEmail,
          password: TEST_PASSWORD,
        })
        .expect(200);

      expect(typeof restoreLogin.body.access_token).toBe('string');
      accessToken = originalAccessToken;
    });

    it('admin ban immediately invalidates both active access tokens and refresh tokens for the target user', async () => {
      const originalAccessToken = accessToken;
      const originalAdminEmails = process.env.ADMIN_EMAILS;
      const adminEmail = `test-api-auth-admin-${Date.now()}@example.com`;
      const targetEmail = `test-api-auth-target-${Date.now()}@example.com`;
      process.env.ADMIN_EMAILS = adminEmail;
      // Admin ACCESS comes from the hardcoded floor; this is the test-only seam.
      process.env.TEST_PLATFORM_ADMIN_EMAILS = adminEmail;

      try {
        const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
        const [adminUser, targetUser] = await Promise.all([
          prisma.user.create({
            data: {
              email: adminEmail,
              password_hash: passwordHash,
              display_name: 'API Auth Admin',
              email_verified: true,
              preferences: { role: 'fan', onboarding_completed: true },
            },
          }),
          prisma.user.create({
            data: {
              email: targetEmail,
              password_hash: passwordHash,
              display_name: 'API Auth Target',
              email_verified: true,
              preferences: { role: 'fan', onboarding_completed: true },
            },
          }),
        ]);
        cleanupUserIds.add(adminUser.id);
        cleanupUserIds.add(targetUser.id);

        const adminLogin = await request(app)
          .post('/auth/login')
          .send({ email: adminEmail, password: TEST_PASSWORD })
          .expect(200);
        const targetLoginA = await request(app)
          .post('/auth/login')
          .send({ email: targetEmail, password: TEST_PASSWORD })
          .expect(200);
        const targetLoginB = await request(app)
          .post('/auth/login')
          .send({ email: targetEmail, password: TEST_PASSWORD })
          .expect(200);

        const adminToken = String(adminLogin.body.access_token || '');
        const targetTokenA = String(targetLoginA.body.access_token || '');
        const targetTokenB = String(targetLoginB.body.access_token || '');
        const targetRefreshA = String(targetLoginA.body.refresh_token || '');
        const targetRefreshB = String(targetLoginB.body.refresh_token || '');

        await request(app)
          .post(`/admin/users/${targetUser.id}/ban`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'auth regression test' })
          .expect(200);

        await request(app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${targetTokenA}`)
          .expect(403);
        await request(app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${targetTokenB}`)
          .expect(403);
        await request(app)
          .post('/auth/refresh')
          .send({ refresh_token: targetRefreshA })
          .expect(401);
        await request(app)
          .post('/auth/refresh')
          .send({ refresh_token: targetRefreshB })
          .expect(401);
      } finally {
        accessToken = originalAccessToken;
        process.env.ADMIN_EMAILS = originalAdminEmails;
        delete process.env.TEST_PLATFORM_ADMIN_EMAILS;
      }
    });
  });

  describe('PATCH /me/preferences', () => {
    it('should ignore client attempts to set paid plan fields', async () => {
      const verifiedEmail = `test-api-auth-preferences-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const verifiedUser = await prisma.user.create({
        data: {
          email: verifiedEmail,
          password_hash: passwordHash,
          display_name: 'Verified Preferences User',
          email_verified: true,
          preferences: { role: 'fan', onboarding_completed: true },
        },
      });
      cleanupUserIds.add(verifiedUser.id);
      const verifiedAccessToken = signJwt({ id: verifiedUser.id });

      await request(app)
        .patch('/me/preferences')
        .set('Authorization', `Bearer ${verifiedAccessToken}`)
        .send({
          plan: 'legend',
          notifications_enabled: false,
        })
        .expect(200);

      const user = await prisma.user.findUnique({
        where: { id: verifiedUser.id },
        select: { preferences: true },
      });
      const prefs = (user?.preferences as any) || {};

      expect(prefs.plan).not.toBe('legend');
      expect(prefs.notifications_enabled).toBe(false);
    });

    it('keeps /auth/me canonical after a preferences patch when stored columns and prefs disagree', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Canonical Patch Org ${Date.now()}`,
          org_type: 'club',
          updated_at: new Date(),
        },
      });
      cleanupOrgIds.add(org.id);
      const verifiedEmail = `test-api-auth-canonical-patch-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const verifiedUser = await prisma.user.create({
        data: {
          email: verifiedEmail,
          password_hash: passwordHash,
          display_name: 'Canonical Patch User',
          email_verified: true,
          role: 'coach',
          approval_status: 'PENDING',
          onboarding_completed: false,
          organization_id: org.id,
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            organization_id: 'org-stale',
          },
        },
      });
      cleanupUserIds.add(verifiedUser.id);
      const verifiedAccessToken = signJwt({ id: verifiedUser.id });

      await request(app)
        .patch('/me/preferences')
        .set('Authorization', `Bearer ${verifiedAccessToken}`)
        .send({
          notifications_enabled: false,
        })
        .expect(200);

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${verifiedAccessToken}`)
        .expect(200);

      expect(response.body.role).toBe('coach');
      expect(response.body.approval_status).toBe('PENDING');
      expect(response.body.onboarding_completed).toBe(false);
      expect(response.body.organization_id).toBe(org.id);
      expect(response.body.preferences.role).toBe('coach');
      expect(response.body.preferences.onboarding_completed).toBe(false);
      expect(response.body.preferences.organization_id).toBe(org.id);
      expect(response.body.preferences.notifications_enabled).toBe(false);
    });

    it('keeps /auth/me canonical for coach fan-mode even when stored prefs are stale', async () => {
      const org = await prisma.organization.create({
        data: {
          name: `Canonical Fan Mode Org ${Date.now()}`,
          org_type: 'club',
          updated_at: new Date(),
        },
      });
      cleanupOrgIds.add(org.id);
      const verifiedEmail = `test-api-auth-fan-mode-${Date.now()}@example.com`;
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const verifiedUser = await prisma.user.create({
        data: {
          email: verifiedEmail,
          password_hash: passwordHash,
          display_name: 'Canonical Fan Mode User',
          email_verified: true,
          role: 'coach',
          approval_status: 'PENDING',
          onboarding_completed: false,
          organization_id: org.id,
          proceeding_as_fan: true,
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            organization_id: 'org-stale',
            proceeding_as_fan: false,
          },
        },
      });
      cleanupUserIds.add(verifiedUser.id);
      const verifiedAccessToken = signJwt({ id: verifiedUser.id });

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${verifiedAccessToken}`)
        .expect(200);

      expect(response.body.role).toBe('coach');
      expect(response.body.approval_status).toBe('PENDING');
      expect(response.body.organization_id).toBe(org.id);
      expect(response.body.proceeding_as_fan).toBe(true);
      expect(response.body.account_state).toBe('coach_pending_approval');
      expect(response.body.next_step).toBe('/(tabs)');
      expect(response.body.preferences.role).toBe('coach');
      expect(response.body.preferences.onboarding_completed).toBe(false);
      expect(response.body.preferences.organization_id).toBe(org.id);
      expect(response.body.preferences.proceeding_as_fan).toBe(true);
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
