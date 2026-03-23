import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

type RegisteredUser = {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
};

function generateTestEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@varsityhub-test.app`;
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function registerUser(request: APIRequestContext, role: 'fan' | 'coach' = 'fan'): Promise<RegisteredUser> {
  const email = generateTestEmail('runtime-boundary');
  const password = 'TestPassword123!';

  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      role,
      display_name: `${role} boundary user`,
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.access_token).toBeDefined();
  expect(body.refresh_token).toBeDefined();
  expect(body.user?.id).toBeDefined();

  return {
    email,
    password,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user.id,
  };
}

test.describe('Runtime user boundaries', () => {
  test('refresh token replay is blocked after rotation', async ({ request }) => {
    const user = await registerUser(request, 'fan');

    const firstRefresh = await request.post(`${API_BASE_URL}/auth/refresh`, {
      data: { refresh_token: user.refreshToken },
    });
    expect(firstRefresh.status()).toBe(200);
    const firstBody = await firstRefresh.json();
    expect(firstBody.access_token).toBeDefined();
    expect(firstBody.refresh_token).toBeDefined();

    const replay = await request.post(`${API_BASE_URL}/auth/refresh`, {
      data: { refresh_token: user.refreshToken },
    });
    expect(replay.status()).toBe(401);
    const replayBody = await replay.json();
    expect(String(replayBody.error || '').toLowerCase()).toContain('token');
  });

  test('private profile hides posts/teams/interactions from non-followers', async ({ request }) => {
    const owner = await registerUser(request, 'fan');
    const viewer = await registerUser(request, 'fan');

    const setPrivate = await request.patch(`${API_BASE_URL}/me/preferences`, {
      headers: authHeaders(owner.accessToken),
      data: {
        profile_private: true,
      },
    });
    expect(setPrivate.status()).toBe(200);

    const profileRes = await request.get(`${API_BASE_URL}/users/${owner.userId}`, {
      headers: authHeaders(viewer.accessToken),
    });
    expect(profileRes.status()).toBe(200);
    const profileBody = await profileRes.json();
    expect(profileBody.profile_private).toBe(true);
    expect(profileBody.id).toBe(owner.userId);
    expect(profileBody.username ?? null).toBeNull();

    const postsRes = await request.get(`${API_BASE_URL}/users/${owner.userId}/posts`, {
      headers: authHeaders(viewer.accessToken),
    });
    expect(postsRes.status()).toBe(404);

    const teamsRes = await request.get(`${API_BASE_URL}/users/${owner.userId}/teams`, {
      headers: authHeaders(viewer.accessToken),
    });
    expect(teamsRes.status()).toBe(404);

    const interactionsRes = await request.get(`${API_BASE_URL}/users/${owner.userId}/interactions`, {
      headers: authHeaders(viewer.accessToken),
    });
    expect(interactionsRes.status()).toBe(404);
  });

  test('blocked users cannot follow each other', async ({ request }) => {
    const blocker = await registerUser(request, 'fan');
    const blocked = await registerUser(request, 'fan');

    const blockRes = await request.post(`${API_BASE_URL}/users/${blocked.userId}/block`, {
      headers: authHeaders(blocker.accessToken),
    });
    expect([200, 201]).toContain(blockRes.status());

    const followAttempt = await request.post(`${API_BASE_URL}/users/${blocker.userId}/follow`, {
      headers: authHeaders(blocked.accessToken),
    });
    expect(followAttempt.status()).toBe(403);
    const followBody = await followAttempt.json();
    expect(String(followBody.error || '').toLowerCase()).toContain('cannot follow');
  });

  test('unverified coach team creation is denied with auth error, not 5xx', async ({ request }) => {
    const coach = await registerUser(request, 'coach');

    const createTeam = await request.post(`${API_BASE_URL}/teams/create`, {
      headers: authHeaders(coach.accessToken),
      data: {
        name: `Runtime Team ${Date.now()}`,
        description: 'Boundary test for unverified coach',
        onboarding: true,
      },
    });

    // Expected production behavior: unverified users are blocked by requireVerified.
    // The critical guard is "never crash" (no 5xx) for this path.
    expect(createTeam.status()).toBeGreaterThanOrEqual(400);
    expect(createTeam.status()).toBeLessThan(500);

    const body = await createTeam.json();
    expect(String(body.error || '').toLowerCase()).toContain('verification');
  });
});

