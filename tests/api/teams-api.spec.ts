import { expect, test } from '@playwright/test';

const API_BASE_URL =
  process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4100';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function createTestUser(
  request: any,
  options: { role?: 'fan' | 'coach'; verifyEmail?: boolean } = {}
) {
  const role = options.role ?? 'fan';
  const verifyEmail = options.verifyEmail ?? true;
  const email = `teams-api-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@varsityhub-test.app`;
  const password = 'TestPassword123!';

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: `Teams API ${role}`,
      role,
    },
  });

  expect(registerResponse.status()).toBe(201);
  const registerBody = await registerResponse.json();
  const token = registerBody.access_token;

  if (verifyEmail && registerBody.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: authHeaders(token),
      data: {
        code: String(registerBody.dev_verification_code),
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();
  }

  return {
    token,
    userId: registerBody.user.id,
    email,
  };
}

test.describe('Teams API', () => {
  test('GET /teams returns a public teams list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST /teams/create requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: `Unauthorized Team ${Date.now()}`,
        description: 'Should fail without auth',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /teams/create requires verified email', async ({ request }) => {
    const coach = await createTestUser(request, { role: 'coach', verifyEmail: false });

    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: authHeaders(coach.token),
      data: {
        name: `Unverified Coach Team ${Date.now()}`,
        description: 'Should fail before approval checks',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('Email verification required');
  });

  test('POST /teams/create rejects verified fan accounts', async ({ request }) => {
    const fan = await createTestUser(request, { role: 'fan', verifyEmail: true });

    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: authHeaders(fan.token),
      data: {
        name: `Fan Team Attempt ${Date.now()}`,
        description: 'Fans cannot create teams',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_ROLE_REQUIRED');
  });

  test('POST /teams/create rejects verified but unapproved coaches', async ({ request }) => {
    const coach = await createTestUser(request, { role: 'coach', verifyEmail: true });

    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: authHeaders(coach.token),
      data: {
        name: `Pending Coach Team ${Date.now()}`,
        description: 'Approval is still required',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_APPROVAL_REQUIRED');
  });

  test('POST /teams/create still validates payload shape before business rules', async ({
    request,
  }) => {
    const fan = await createTestUser(request, { role: 'fan', verifyEmail: true });

    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: authHeaders(fan.token),
      data: {
        description: 'Missing required name field',
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payload');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  test('GET /teams/limits returns limit metadata for authenticated users', async ({ request }) => {
    const fan = await createTestUser(request, { role: 'fan', verifyEmail: true });

    const response = await request.get(`${API_BASE_URL}/teams/limits`, {
      headers: authHeaders(fan.token),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(typeof body.owned_teams).toBe('number');
    expect(typeof body.max_teams).toBe('number');
    expect(typeof body.can_create_more).toBe('boolean');
  });

  test('GET /teams/managed returns an array for authenticated coaches', async ({ request }) => {
    const coach = await createTestUser(request, { role: 'coach', verifyEmail: true });

    const response = await request.get(`${API_BASE_URL}/teams/managed`, {
      headers: authHeaders(coach.token),
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /teams/:id returns 404 for a missing team', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams/nonexistent-team-id`);

    expect(response.status()).toBe(404);
  });
});
