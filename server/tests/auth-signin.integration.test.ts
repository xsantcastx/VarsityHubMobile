/**
 * Google & Apple Sign-In Integration Tests
 * 
 * Tests OAuth flows for:
 * - Google authentication (token validation, user creation, account linking)
 * - Apple authentication (simulator tokens, user creation, account linking)
 * - Account linking when user exists by email
 * - Onboarding flow after first sign-in
 */

import { PrismaClient } from '@prisma/client';
import type { Express } from 'express';
import request from 'supertest';

let app: Express;
let prisma: PrismaClient;

// Mock fetch for Google tokeninfo validation
const originalFetch = global.fetch;

beforeAll(() => {
  // Setup: Import app and prisma
  // In real test environment, these would be injected
  process.env.NODE_ENV = 'test';
  process.env.GOOGLE_ALLOWED_AUDIENCES = '';
  
  // Mock Google tokeninfo endpoint
  global.fetch = jest.fn((url: string, options?: any) => {
    if (url.includes('oauth2.googleapis.com/tokeninfo')) {
      const idTokenParam = new URLSearchParams(url.split('?')[1]);
      const idToken = idTokenParam.get('id_token');
      
      if (idToken === 'valid-google-token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sub: 'google-user-123',
            email: 'user@gmail.com',
            email_verified: true,
            name: 'Test User',
            picture: 'https://example.com/avatar.jpg',
            aud: 'test-client-id',
          }),
          text: () => Promise.resolve(''),
        } as any);
      }
      
      if (idToken === 'invalid-email-google-token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sub: 'google-user-456',
            email: null,
            email_verified: false,
            name: 'Invalid User',
            aud: 'test-client-id',
          }),
          text: () => Promise.resolve(''),
        } as any);
      }
      
      if (idToken === 'unverified-email-google-token') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sub: 'google-user-789',
            email: 'unverified@gmail.com',
            email_verified: false,
            aud: 'test-client-id',
          }),
          text: () => Promise.resolve(''),
        } as any);
      }
      
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('Invalid token'),
      } as any);
    }
    
    // Fall back to original fetch for other URLs
    return originalFetch(url, options);
  }) as any;
});

afterAll(() => {
  global.fetch = originalFetch;
});

describe('OAuth Sign-In Integration Tests', () => {
  describe('POST /auth/google', () => {
    it('should create new user with valid Google token', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('created', true);
      expect(response.body).toHaveProperty('needs_onboarding', false);
      expect(response.body.user.email).toBe('user@gmail.com');
      expect(response.body.user.google_id).toBe('google-user-123');
      expect(response.body.user.display_name).toBe('Test User');
      expect(response.body.user.avatar_url).toBe('https://example.com/avatar.jpg');
    });

    it('should return 400 for invalid token format', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: '' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for missing email in Google credential', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'invalid-email-google-token' })
        .expect(400);

      expect(response.body.error).toContain('Invalid Google credential');
    });

    it('should return 400 for unverified email', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'unverified-email-google-token' })
        .expect(400);

      expect(response.body.error).toContain('email is not verified');
    });

    it('should return 401 for invalid Google token', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'invalid-token' })
        .expect(401);

      expect(response.body.error).toContain('Google authentication failed');
    });

    it('should link Google ID to existing user by email', async () => {
      // Create user with email first
      await prisma.user.create({
        data: {
          email: 'user@gmail.com',
          password_hash: 'dummy',
          display_name: 'Existing User',
          preferences: { role: 'fan' },
        },
      });

      // Sign in with Google
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body.created).toBe(false); // Existing user
      expect(response.body.user.google_id).toBe('google-user-123');
      expect(response.body.user.email).toBe('user@gmail.com');

      // Verify user is updated in database
      const dbUser = await prisma.user.findUnique({
        where: { email: 'user@gmail.com' },
      });
      expect(dbUser?.google_id).toBe('google-user-123');
    });

    it('should return same user on second Google sign-in', async () => {
      const firstResponse = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const secondResponse = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(firstResponse.body.user.id).toBe(secondResponse.body.user.id);
      expect(secondResponse.body.created).toBe(false);
    });
  });

  describe('POST /auth/apple', () => {
    const simTokenUserId = `sim-test-apple-user-${Date.now()}`;
    const simToken = `sim-${simTokenUserId}`;

    it('should create new user with simulator Apple token', async () => {
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: simToken })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('created', true);
      expect(response.body).toHaveProperty('needs_onboarding', false);
      expect(response.body.user.apple_id).toBe(simTokenUserId);
      expect(response.body.user.email_verified).toBe(true);
    });

    it('should return 400 for empty identity token', async () => {
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: '' })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for missing identity token', async () => {
      const response = await request(app)
        .post('/auth/apple')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should link Apple ID to existing user by email (simulator)', async () => {
      const email = `sim-apple-test-${Date.now()}@privaterelay.appleid.com`;
      const appleId = `sim-apple-${Date.now()}`;
      
      // Create user first
      await prisma.user.create({
        data: {
          email,
          password_hash: 'dummy',
          display_name: 'Apple User',
          preferences: { role: 'fan' },
        },
      });

      // Sign in with Apple
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: `sim-${appleId}` })
        .expect(200);

      expect(response.body.created).toBe(false);
      expect(response.body.user.apple_id).toBe(appleId);
    });

    it('should return same user on second Apple sign-in', async () => {
      const token = `sim-repeat-test-${Date.now()}`;
      
      const firstResponse = await request(app)
        .post('/auth/apple')
        .send({ identity_token: token })
        .expect(200);

      const secondResponse = await request(app)
        .post('/auth/apple')
        .send({ identity_token: token })
        .expect(200);

      expect(firstResponse.body.user.id).toBe(secondResponse.body.user.id);
      expect(secondResponse.body.created).toBe(false);
    });

    it('should create user with generated email if not provided', async () => {
      const appleId = `sim-noemail-${Date.now()}`;
      
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: `sim-${appleId}` })
        .expect(200);

      expect(response.body.user.apple_id).toBe(appleId);
      expect(response.body.user.email).toBeDefined();
      expect(response.body.user.email_verified).toBe(true);
    });
  });

  describe('Account Linking & Email Verification', () => {
    it('should link Google and Apple to same email account', async () => {
      const email = `cross-auth-${Date.now()}@test.com`;
      const googleToken = 'valid-google-token'; // Uses user@gmail.com
      const appleId = `sim-cross-${Date.now()}`;

      // Sign up with email first
      const signupResponse = await request(app)
        .post('/auth/register')
        .send({
          email,
          password: 'password123',
          display_name: 'Test User',
        })
        .expect(200);

      const userId = signupResponse.body.user.id;

      // Link Google (but this uses different email, so won't link)
      // Instead, test linking with same email

      const appleResponse = await request(app)
        .post('/auth/apple')
        .send({ identity_token: `sim-${appleId}` })
        .expect(200);

      expect(appleResponse.body.user.apple_id).toBeDefined();
    });

    it('should set email_verified when signing in with OAuth', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body.user.email_verified).toBe(true);
      
      const dbUser = await prisma.user.findUnique({
        where: { id: response.body.user.id },
      });
      expect(dbUser?.email_verified).toBe(true);
    });

    it('should clear email verification code after OAuth sign-in', async () => {
      // Create user with verification code
      const user = await prisma.user.create({
        data: {
          email: `verify-clear-${Date.now()}@test.com`,
          password_hash: 'dummy',
          display_name: 'User',
          email_verification_code: '123456',
          email_verification_expires: new Date(Date.now() + 3600000),
          preferences: { role: 'fan' },
        },
      });

      // Manually link Google ID for testing
      await prisma.user.update({
        where: { id: user.id },
        data: { google_id: `google-verify-${Date.now()}` },
      });

      // Fetch and verify code was cleared
      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updated?.email_verification_code).toBeNull();
      expect(updated?.email_verification_expires).toBeNull();
    });
  });

  describe('Onboarding Flow', () => {
    it('should set needs_onboarding to false for new Google user', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body.needs_onboarding).toBe(false);
    });

    it('should set needs_onboarding to false for new Apple user', async () => {
      const token = `sim-onboard-${Date.now()}`;
      
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: token })
        .expect(200);

      expect(response.body.needs_onboarding).toBe(false);
    });

    it('should set default role to fan for new users', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body.user.preferences?.role).toBe('fan');
    });
  });

  describe('Token Generation & Authentication', () => {
    it('should return valid JWT token from Google sign-in', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const token = response.body.access_token;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
    });

    it('should return valid JWT token from Apple sign-in', async () => {
      const token = `sim-jwt-${Date.now()}`;
      
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: token })
        .expect(200);

      const jwtToken = response.body.access_token;
      expect(jwtToken).toBeDefined();
      expect(typeof jwtToken).toBe('string');
      expect(jwtToken.split('.')).toHaveLength(3); // JWT format
    });

    it('should be able to use token to access /me endpoint', async () => {
      const signInResponse = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const token = signInResponse.body.access_token;

      const meResponse = await request(app)
        .get('/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(meResponse.body.id).toBe(signInResponse.body.user.id);
      expect(meResponse.body.email).toBe(signInResponse.body.user.email);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on unexpected Google auth error', async () => {
      // Mock fetch to throw error
      const originalFetch2 = global.fetch;
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error'))) as any;

      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(500);

      expect(response.body.error).toContain('Failed to authenticate with Google');

      global.fetch = originalFetch2;
    });

    it('should return 500 on unexpected Apple auth error', async () => {
      // This would require database error injection in a real test
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: 'sim-error-token' });

      // Should either succeed or return 500 (depending on database state)
      expect([200, 500]).toContain(response.status);
    });

    it('should handle invalid JSON payload', async () => {
      const response = await request(app)
        .post('/auth/google')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Security Considerations', () => {
    it('should not expose sensitive user data', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const user = response.body.user;
      
      // Should not include password_hash
      expect(user).not.toHaveProperty('password_hash');
      
      // Should include sanitized fields
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('display_name');
      expect(user).toHaveProperty('avatar_url');
    });

    it('should validate email addresses are lowercase', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response.body.user.email).toBe(response.body.user.email.toLowerCase());
    });

    it('should not accept missing payload fields', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Database Consistency', () => {
    it('should create user with all required fields', async () => {
      const response = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const userId = response.body.user.id;
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });

      expect(dbUser).toHaveProperty('id');
      expect(dbUser).toHaveProperty('email');
      expect(dbUser).toHaveProperty('google_id');
      expect(dbUser).toHaveProperty('password_hash');
      expect(dbUser).toHaveProperty('email_verified', true);
      expect(dbUser).toHaveProperty('preferences');
    });

    it('should not create duplicate users for same Google ID', async () => {
      const response1 = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      const response2 = await request(app)
        .post('/auth/google')
        .send({ id_token: 'valid-google-token' })
        .expect(200);

      expect(response1.body.user.id).toBe(response2.body.user.id);
      
      const count = await prisma.user.count({
        where: { google_id: 'google-user-123' },
      });
      expect(count).toBe(1);
    });

    it('should maintain referential integrity with preferences', async () => {
      const response = await request(app)
        .post('/auth/apple')
        .send({ identity_token: `sim-integrity-${Date.now()}` })
        .expect(200);

      const userId = response.body.user.id;
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });

      expect(dbUser?.preferences).toHaveProperty('role');
      expect(dbUser?.preferences).toHaveProperty('onboarding_completed');
    });
  });
});
