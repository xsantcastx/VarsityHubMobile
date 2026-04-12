import { expect, test } from '@playwright/test';

const API_BASE_URL =
  process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4100';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function createTestUser(request: any, role: 'fan' | 'coach' = 'fan') {
  const email = `test-discover-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test ${role} ${Date.now()}`;

  const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
      role,
    },
  });

  expect(registerResponse.status()).toBe(201);
  const registerData = await registerResponse.json();
  const token = registerData.access_token;

  if (registerData.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: authHeaders(token),
      data: {
        code: String(registerData.dev_verification_code),
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();
  }

  return {
    email,
    password,
    displayName,
    token,
    userId: registerData.user.id,
  };
}

test.describe('Discover Page', () => {
  test('discover games feed returns current list shape', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/games?sort=-date`);

    expect(response.status()).toBe(200);
    const games = await response.json();

    expect(Array.isArray(games)).toBe(true);

    if (games.length > 0) {
      expect(typeof games[0].id).toBe('string');
    }
  });

  test('discover highlights returns current payload shape', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/highlights?limit=20`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body.nationalTop)).toBe(true);
    expect(Array.isArray(body.local) || Array.isArray(body.ranked)).toBe(true);
  });

  test('discover follow flow allows following another user', async ({ request }) => {
    const follower = await createTestUser(request, 'fan');
    const target = await createTestUser(request, 'fan');

    const followResponse = await request.post(`${API_BASE_URL}/users/${target.userId}/follow`, {
      headers: authHeaders(follower.token),
    });

    expect([200, 201]).toContain(followResponse.status());
  });

  test('discover preferences flow persists zip code', async ({ request }) => {
    const user = await createTestUser(request, 'fan');

    const patchResponse = await request.patch(`${API_BASE_URL}/me/preferences`, {
      headers: authHeaders(user.token),
      data: {
        zip_code: '12345',
      },
    });

    expect(patchResponse.status()).toBe(200);

    const meResponse = await request.get(`${API_BASE_URL}/me`, {
      headers: authHeaders(user.token),
    });

    expect(meResponse.status()).toBe(200);
    const me = await meResponse.json();
    expect(me.preferences?.zip_code).toBe('12345');
  });

  test('discover quick actions reflect the current user role', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const coach = await createTestUser(request, 'coach');

    const fanMe = await request.get(`${API_BASE_URL}/me`, {
      headers: authHeaders(fan.token),
    });
    const coachMe = await request.get(`${API_BASE_URL}/me`, {
      headers: authHeaders(coach.token),
    });

    expect(fanMe.status()).toBe(200);
    expect(coachMe.status()).toBe(200);

    const fanBody = await fanMe.json();
    const coachBody = await coachMe.json();

    expect(fanBody.preferences?.role).toBe('fan');
    expect(coachBody.preferences?.role).toBe('coach');
  });

  test('discover quick add game is blocked until coach approval requirements are met', async ({
    request,
  }) => {
    const coach = await createTestUser(request, 'coach');

    const response = await request.post(`${API_BASE_URL}/games`, {
      headers: authHeaders(coach.token),
      data: {
        title: 'Quick Add Game',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: '123 Main St, City, 12345',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_APPROVAL_REQUIRED');
  });
});
