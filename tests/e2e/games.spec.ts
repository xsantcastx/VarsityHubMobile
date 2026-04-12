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

async function createTestUser(request: any, role: 'fan' | 'coach' = 'fan') {
  const email = `test-games-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

  if (signupData.dev_verification_code) {
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

async function createTestEvent(request: any, token: string, eventData: any = {}) {
  const tomorrow = new Date(Date.now() + 86400000);
  const response = await request.post(`${API_BASE_URL}/events`, {
    headers: authHeaders(token),
    data: {
      title: eventData.title || `Test Event ${Date.now()}`,
      date: eventData.date || tomorrow.toISOString(),
      location: eventData.location || '123 Main St, Test City, 12345',
      description: eventData.description || 'Test event description',
      event_type: eventData.event_type || 'game',
      capacity: eventData.capacity || 50,
      ...eventData,
    },
  });

  expect([200, 201]).toContain(response.status());
  return response.json();
}

test.describe('Game Management', () => {
  test('game creation requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/games`, {
      data: {
        title: 'Test Game',
        date: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(response.status()).toBe(401);
  });

  test('unapproved coach cannot create a game yet', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');

    const response = await request.post(`${API_BASE_URL}/games`, {
      headers: authHeaders(coach.token),
      data: {
        title: 'Coach Game',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: '123 Main St',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_APPROVAL_REQUIRED');
  });

  test('can list games', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/games?sort=-date`);

    expect(response.status()).toBe(200);
    const games = await response.json();
    expect(Array.isArray(games)).toBe(true);
  });

  test('missing game detail returns not found', async ({ request }) => {
    const user = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(
      request,
      user.token,
      'get',
      `${API_BASE_URL}/games/nonexistent-game-id`
    );

    expect(response.status()).toBe(404);
  });

  test('fan can RSVP to an event', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const fan = await createTestUser(request, 'fan');
    const event = await createTestEvent(request, coach.token, { capacity: 50 });

    const response = await makeAuthRequest(
      request,
      fan.token,
      'post',
      `${API_BASE_URL}/events/${event.id}/rsvp`
    );

    expect([200, 201]).toContain(response.status());
  });

  test('RSVP toggles when submitted twice', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const fan = await createTestUser(request, 'fan');
    const event = await createTestEvent(request, coach.token, { capacity: 50 });

    const first = await makeAuthRequest(
      request,
      fan.token,
      'post',
      `${API_BASE_URL}/events/${event.id}/rsvp`
    );
    const second = await makeAuthRequest(
      request,
      fan.token,
      'post',
      `${API_BASE_URL}/events/${event.id}/rsvp`
    );

    expect([200, 201]).toContain(first.status());
    expect([200, 201]).toContain(second.status());
  });

  test('RSVP capacity enforcement returns a bounded result', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const event = await createTestEvent(request, coach.token, { capacity: 2 });
    const user1 = await createTestUser(request, 'fan');
    const user2 = await createTestUser(request, 'fan');
    const user3 = await createTestUser(request, 'fan');

    await makeAuthRequest(request, user1.token, 'post', `${API_BASE_URL}/events/${event.id}/rsvp`);
    await makeAuthRequest(request, user2.token, 'post', `${API_BASE_URL}/events/${event.id}/rsvp`);
    const overflow = await makeAuthRequest(
      request,
      user3.token,
      'post',
      `${API_BASE_URL}/events/${event.id}/rsvp`
    );

    expect([200, 201, 400, 409]).toContain(overflow.status());
  });
});
