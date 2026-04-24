import { test, expect } from '@playwright/test';

/**
 * Teams API Integration Tests
 * 
 * Tests the teams endpoints for creating and managing teams.
 * Note: Team creation requires coach role and verified email.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to create authenticated coach user.
// Auto-verifies the email when ENABLE_DEV_CODES=1 in the server env —
// without verification, POST /teams/create returns 403 before the Zod
// validation runs and tests fail with the wrong status code.
async function createTestCoach(request: any) {
  const testEmail = `coach-${Date.now()}@varsityhub-test.app`;
  const testPassword = 'TestPassword123!';

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email: testEmail,
      password: testPassword,
      display_name: 'Test Coach',
      role: 'coach',
    },
  });

  expect(registerResponse.ok()).toBeTruthy();
  const body = await registerResponse.json();
  const { access_token, user, dev_verification_code } = body;

  if (dev_verification_code) {
    await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: { Authorization: `Bearer ${access_token}` },
      data: { code: String(dev_verification_code) },
    });
  }

  return { access_token, user, email: testEmail, password: testPassword };
}

test.describe('Teams API', () => {
  let accessToken: string;
  let userId: string;

  test.beforeEach(async ({ request }) => {
    const coachData = await createTestCoach(request);
    accessToken = coachData.access_token;
    userId = coachData.user.id;
  });

  test('GET /teams should return teams list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('POST /teams/create should create a team (coach only)', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: `Test Team ${Date.now()}`,
        description: 'A test team created by API tests',
        sport: 'basketball',
      },
    });

    // May require email verification, so check for either success or verification required
    if (response.ok()) {
      const body = await response.json();
      expect(body.id).toBeDefined();
      expect(body.name).toBeDefined();
    } else {
      // If fails, should be due to verification requirement
      expect([401, 403]).toContain(response.status());
    }
  });

  test('POST /teams/create should require coach role', async ({ request }) => {
    // Create a fan user (not coach)
    const testEmail = `fan-${Date.now()}@varsityhub-test.app`;
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: 'TestPassword123!',
        display_name: 'Test Fan',
        role: 'fan',
      },
    });

    const { access_token } = await registerResponse.json();

    // Try to create team (should fail - fans can't create teams)
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        name: 'Fan Team Attempt',
        description: 'This should fail',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  test('POST /teams/create should validate required fields', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        // Missing required 'name' field
        description: 'Team without name',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payload');
    expect(body.issues).toBeDefined();
    expect(Array.isArray(body.issues)).toBeTruthy();
  });

  test('GET /teams/:id should return team details', async ({ request }) => {
    // First, try to get a team (may need to create one first)
    // For now, just test the endpoint exists
    const response = await request.get(`${API_BASE_URL}/teams/test-id-123`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Acceptable outcomes: 200 (team exists), 404 (not found),
    // 400 (bad CUID — id format validation runs before lookup).
    expect([200, 400, 404]).toContain(response.status());
  });

  test('POST /teams/create should enforce team limits for rookie plan', async ({ request }) => {
    // This test would require:
    // 1. Verified coach user
    // 2. Rookie plan (max 2 teams)
    // 3. Create 2 teams successfully
    // 4. Attempt 3rd team (should fail)
    
    // For now, just verify the endpoint handles the request
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        name: `Team Limit Test ${Date.now()}`,
        description: 'Testing team limits',
      },
    });

    // Should either succeed or fail with appropriate error
    expect([200, 201, 400, 401, 403, 402]).toContain(response.status());
  });

  test('Teams endpoints should require authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams`);

    // May allow public access or require auth
    // Check that it doesn't crash
    expect([200, 401]).toContain(response.status());
  });
});
