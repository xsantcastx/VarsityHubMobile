import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Team Management E2E Tests
 *
 * These tests follow the current contract:
 * - team directory and team detail are public read surfaces
 * - managed teams / invite inbox are authenticated surfaces
 * - team creation is gated behind verification + onboarding + coach/org state
 */

const API_BASE_URL = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4000')
  .replace('://localhost', '://127.0.0.1');

function createAuthRequest(request: APIRequestContext, token: string) {
  const withAuth = (options: Record<string, any> = {}) => ({
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    get: (url: string, options?: Record<string, any>) => request.get(url, withAuth(options)),
    post: (url: string, options?: Record<string, any>) => request.post(url, withAuth(options)),
  };
}

async function createTestUser(request: APIRequestContext, role: 'fan' | 'coach' = 'fan') {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email: `teams-${role}-${nonce}@varsityhub-test.app`,
      password: 'TestPassword123!',
      display_name: `Teams ${role} ${nonce}`,
      role,
      ...(role === 'coach' ? { dob: '1990-01-15' } : {}),
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  return { token: body.access_token };
}

async function fetchTeams(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/teams`);
  expect(response.status()).toBe(200);
  const teams = await response.json();
  expect(Array.isArray(teams)).toBe(true);
  return teams as any[];
}

test.describe('Team Management', () => {
  test('Public team directory returns a list', async ({ request }) => {
    const teams = await fetchTeams(request);
    expect(Array.isArray(teams)).toBe(true);
  });

  test('Can fetch team details for an existing or unknown team id', async ({ request }) => {
    const teams = await fetchTeams(request);
    const teamId = teams[0]?.id ?? 'test-id-123';

    const response = await request.get(`${API_BASE_URL}/teams/${teamId}`);
    expect([200, 400, 404]).toContain(response.status());

    if (response.status() === 200) {
      const team = await response.json();
      expect(team.id).toBe(teamId);
      expect(team.name).toBeTruthy();
    }
  });

  test('Managed teams requires authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams/managed`);
    expect(response.status()).toBe(401);
  });

  test('Invite inbox requires authentication', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/teams/invites/me`);
    expect(response.status()).toBe(401);
  });

  test('Team creation requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: 'Unauthorized Team',
        organization_name: 'Unauthorized Org',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Fresh coach accounts cannot create teams through the regular route yet', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: `Blocked Team ${Date.now()}`,
        organization_name: `Blocked Org ${Date.now()}`,
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/verification|onboarding|approval|required/i);
  });

  test('Fresh fan accounts cannot create teams', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const response = await createAuthRequest(request, fan.token).post(`${API_BASE_URL}/teams/create`, {
      data: {
        name: `Fan Team ${Date.now()}`,
        organization_name: `Fan Org ${Date.now()}`,
        onboarding: true,
      },
    });

    expect(response.status()).toBe(403);
  });

  test('Managed teams works for an authenticated user even with no owned teams', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const response = await createAuthRequest(request, fan.token).get(`${API_BASE_URL}/teams/managed`);

    expect([200, 403]).toContain(response.status());
    if (response.status() === 200) {
      const teams = await response.json();
      expect(Array.isArray(teams)).toBe(true);
    }
  });
});
