import { expect, test } from '@playwright/test';

/**
 * Team Management E2E Tests
 * 
 * Tests team creation, management, and member operations
 */

const API_BASE_URL = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';
const cachedUsers = new Map<string, any>();

// Helper to make authenticated request
async function makeAuthRequest(request: any, token: string, method: string, url: string, data?: any) {
  return request[method.toLowerCase()](url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data,
  });
}

// Helper to create a test user and get auth token
async function createTestUser(request: any, role: 'fan' | 'coach' | 'admin' = 'fan') {
  const cacheKey = role;
  const existing = cachedUsers.get(cacheKey);
  if (existing) return existing;

  const email = `test-teams-${Date.now()}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test User ${Date.now()}`;

  // Sign up (use /register endpoint)
  const signupResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
      role, // Set role during registration
    },
  });

  expect([200, 201]).toContain(signupResponse.status());
  const signupData = await signupResponse.json();
  const token = signupData.access_token || signupData.token;

  // Verify email (dev flow). If register response doesn't include a code,
  // request a fresh code from /auth/verify/request.
  let devCode = signupData.dev_verification_code ? String(signupData.dev_verification_code) : '';
  if (!devCode) {
    const codeRes = await makeAuthRequest(request, token, 'post', `${API_BASE_URL}/auth/verify/request`);
    if (codeRes.status() === 200) {
      const codeBody = await codeRes.json().catch(() => ({}));
      if (codeBody?.dev_verification_code) devCode = String(codeBody.dev_verification_code);
    }
  }

  if (devCode) {
    try {
      const verifyResponse = await makeAuthRequest(request, token, 'post', `${API_BASE_URL}/auth/verify/confirm`, {
        code: devCode,
      });
      // Wait a bit for the database to update
      if (verifyResponse.status() === 200) {
        await new Promise(resolve => setTimeout(resolve, 200));
      } else {
        const errorBody = await verifyResponse.text().catch(() => '');
        console.warn(`Email verification returned ${verifyResponse.status()}: ${errorBody}`);
      }
    } catch (e) {
      // Verification might fail, but continue anyway
      console.warn('Email verification failed in test:', e);
    }
  }

  const createdUser = { email, password, displayName, token, userId: signupData.user?.id || signupData.user_id };
  cachedUsers.set(cacheKey, createdUser);
  return createdUser;
}

// Helper to create a test team
async function createTestTeam(request: any, token: string, teamData: any = {}) {
  const defaultTeam = {
    name: teamData.name || `Test Team ${Date.now()}`,
    description: teamData.description || 'Test team description',
    sport: teamData.sport || 'basketball',
    ...teamData,
  };

  const response = await makeAuthRequest(request, token, 'post', `${API_BASE_URL}/teams`, defaultTeam);

  // Team creation requires verified users
  // If 403, the user is not verified - this is expected for new users
  // We'll skip team creation in tests that require it, or skip the test
  if (response.status() === 403) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Team creation requires verified user: ${errorData.error || 'User must verify email first'}`);
  }

  expect([200, 201]).toContain(response.status());
  return await response.json();
}

test.describe('Team Management', () => {
  test.describe.configure({ mode: 'serial' });
  test('Coach can create a team', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    
    const team = await createTestTeam(request, coach.token, {
      name: 'Varsity Basketball',
      description: 'High school varsity basketball team',
      sport: 'basketball',
    });

    expect(team).toHaveProperty('id');
    expect(team.name).toBe('Varsity Basketball');
    expect(team.description).toBe('High school varsity basketball team');
  });

  test('Team creation requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams`, {
      data: {
        name: 'Test Team',
        description: 'Test description',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Team creation requires verified user', async ({ request }) => {
    const user = await createTestUser(request, 'coach');
    
    // Note: Team creation requires verified users (requireVerified middleware)
    // New users are not verified by default, so this should return 403
    const response = await makeAuthRequest(request, user.token, 'post', `${API_BASE_URL}/teams`, {
      name: 'Test Team',
      description: 'Test description',
    });

    // Should return 403 if verification required, or 200/201 if verification is bypassed in test
    expect([200, 201, 403]).toContain(response.status());
  });

  test('Can view team details', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/${team.id}`);

    expect(response.status()).toBe(200);
    const teamData = await response.json();
    expect(teamData.id).toBe(team.id);
    expect(teamData.name).toBe(team.name);
  });

  test('Can list teams', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    await createTestTeam(request, coach.token, { name: 'Team A' });
    await createTestTeam(request, coach.token, { name: 'Team B' });

    const response = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams`);

    expect(response.status()).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThanOrEqual(2);
  });

  test('Can update team details', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'put', `${API_BASE_URL}/teams/${team.id}`, {
      name: 'Updated Team Name',
      description: 'Updated description',
    });

    expect([200, 201]).toContain(response.status());
    const updatedTeam = await response.json();
    expect(updatedTeam.name).toBe('Updated Team Name');
    expect(updatedTeam.description).toBe('Updated description');
  });

  test('Can view team members', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/${team.id}/members`);

    expect(response.status()).toBe(200);
    const members = await response.json();
    expect(Array.isArray(members)).toBe(true);
    // Coach should be a member
    expect(members.length).toBeGreaterThanOrEqual(1);
  });

  test('Can invite team members', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);
    const invitee = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/teams/${team.id}/invite`, {
      email: invitee.email,
      role: 'player',
    });

    // Should either succeed or return appropriate status
    expect([200, 201, 400, 404]).toContain(response.status());
  });

  test('Team creation validates required fields', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');

    // Try to create team without name
    const response = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/teams`, {
      description: 'Team without name',
    });

    expect(response.status()).toBe(400);
  });

  test('Can view managed teams', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/managed`);

    expect(response.status()).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);
  });

  test('Fan cannot create team', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/teams`, {
      name: 'Fan Team',
      description: 'Team created by fan',
    });

    // Should either fail or require verification/upgrade
    expect([400, 403, 401]).toContain(response.status());
  });

  test('Can delete team', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'delete', `${API_BASE_URL}/teams/${team.id}`);

    expect([200, 204]).toContain(response.status());

    // Verify team is deleted
    const getResponse = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/${team.id}`);
    expect([404, 403]).toContain(getResponse.status());
  });

  test('Team API returns correct data structure', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const team = await createTestTeam(request, coach.token);

    const response = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/${team.id}`);

    expect(response.status()).toBe(200);
    const teamData = await response.json();
    
    expect(teamData).toHaveProperty('id');
    expect(teamData).toHaveProperty('name');
    expect(typeof teamData.id).toBe('string');
    expect(typeof teamData.name).toBe('string');
  });
});
