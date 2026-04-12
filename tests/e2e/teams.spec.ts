import { expect, test } from '@playwright/test';

const API_BASE_URL =
  process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4100';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function makeAuthRequest(
  request: any,
  token: string,
  method: string,
  url: string,
  data?: any
) {
  return request[method.toLowerCase()](url, {
    headers: authHeaders(token),
    data,
  });
}

async function createTestUser(request: any, role: 'fan' | 'coach' = 'fan', verify = true) {
  const email = `test-teams-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test ${role} ${Date.now()}`;

  const signupResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
      role,
    },
  });

  expect(signupResponse.status()).toBe(201);
  const signupData = await signupResponse.json();
  const token = signupData.access_token;

  if (verify && signupData.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: authHeaders(token),
      data: {
        code: String(signupData.dev_verification_code),
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();
  }

  return {
    email,
    token,
    userId: signupData.user.id,
  };
}

test.describe('Team Management', () => {
  test('team creation requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams`, {
      data: {
        name: 'Test Team',
        description: 'Test description',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('fan cannot create team', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/teams`, {
      name: 'Fan Team',
      description: 'Team created by fan',
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_ROLE_REQUIRED');
  });

  test('coach cannot create team before approval', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');

    const response = await makeAuthRequest(
      request,
      coach.token,
      'post',
      `${API_BASE_URL}/teams`,
      {
        name: `Coach Team ${Date.now()}`,
        sport: 'basketball',
      }
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_APPROVAL_REQUIRED');
  });

  test('team creation requires verified email', async ({ request }) => {
    const coach = await createTestUser(request, 'coach', false);

    const response = await makeAuthRequest(
      request,
      coach.token,
      'post',
      `${API_BASE_URL}/teams`,
      {
        name: `Unverified Coach Team ${Date.now()}`,
        sport: 'basketball',
      }
    );

    expect([401, 403]).toContain(response.status());
  });

  test('can list teams', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams`);

    expect(response.status()).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
  });

  test('missing team detail returns not found', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams/nonexistent-team-id`);

    expect(response.status()).toBe(404);
  });

  test('managed teams endpoint returns an array for authenticated coach', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');

    const response = await makeAuthRequest(
      request,
      coach.token,
      'get',
      `${API_BASE_URL}/teams/managed`
    );

    expect(response.status()).toBe(200);
    const teams = await response.json();
    expect(Array.isArray(teams)).toBe(true);
  });
});
