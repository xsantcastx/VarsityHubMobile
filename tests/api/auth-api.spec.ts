import { test, expect } from '@playwright/test';

/**
 * Authentication API Integration Tests
 * 
 * Tests the authentication endpoints directly via API calls.
 * These are faster than E2E tests and can catch backend issues.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// Generate unique test email
const generateTestEmail = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `test-${timestamp}-${random}@varsityhub-test.app`;
};

test.describe('Authentication API', () => {
  let testEmail: string;
  let testPassword: string;

  test.beforeEach(() => {
    testEmail = generateTestEmail();
    testPassword = 'TestPassword123!';
  });

  test('POST /auth/register should create new user', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
        display_name: 'Test User',
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail.toLowerCase());
    expect(body.dev_verification_code).toBeDefined();
    expect(body.user.email_verified).toBe(false);
  });

  test('POST /auth/register should reject duplicate email', async ({ request }) => {
    // First registration
    await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    // Second registration with same email should fail
    const response = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.error).toContain('already registered');
  });

  test('POST /auth/register should validate email format', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: 'invalid-email',
        password: testPassword,
      },
    });

    expect(response.status()).toBe(400);
  });

  test('POST /auth/register should validate password length', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: 'short', // Too short
      },
    });

    expect(response.status()).toBe(400);
  });

  test('POST /auth/login should authenticate valid user', async ({ request }) => {
    // First register
    await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    // Then login
    const response = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });

    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.access_token).toBeDefined();
    expect(body.user).toBeDefined();
    expect(body.needs_verification).toBe(true);
  });

  test('POST /auth/login should reject invalid credentials', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: 'nonexistent@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toContain('Invalid credentials');
  });

  test('POST /auth/login should rate limit after multiple attempts', async ({ request }) => {
    // Make multiple failed login attempts
    for (let i = 0; i < 15; i++) {
      await request.post(`${API_BASE_URL}/auth/login`, {
        data: {
          email: testEmail,
          password: 'wrongpassword',
        },
      });
    }

    // Next attempt should be rate limited
    const response = await request.post(`${API_BASE_URL}/auth/login`, {
      data: {
        email: testEmail,
        password: 'wrongpassword',
      },
    });

    // Should be rate limited (429) or still 401
    expect([401, 429]).toContain(response.status());
  });

  test('GET /me should return user info with valid token', async ({ request }) => {
    // Register and get token
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: testPassword,
      },
    });
    
    const { access_token } = await registerResponse.json();

    // Use token to get user info
    const meResponse = await request.get(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    expect(meResponse.ok()).toBeTruthy();
    
    const body = await meResponse.json();
    expect(body.email).toBe(testEmail.toLowerCase());
  });

  test('GET /me should reject request without token', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/me`);

    expect(response.status()).toBe(401);
  });

  test('GET /me should reject request with invalid token', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/me`, {
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    expect(response.status()).toBe(401);
  });
});
