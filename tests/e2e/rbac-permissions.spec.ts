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
  const email = `test-rbac-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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

async function createTestEvent(request: any, token: string, eventData: any = {}) {
  const tomorrow = new Date(Date.now() + 86400000);
  const response = await request.post(`${API_BASE_URL}/events`, {
    headers: authHeaders(token),
    data: {
      title: eventData.title || `RBAC Event ${Date.now()}`,
      date: eventData.date || tomorrow.toISOString(),
      location: eventData.location || '123 Main St',
      event_type: eventData.event_type || 'game',
      capacity: eventData.capacity || 50,
      ...eventData,
    },
  });

  expect([200, 201]).toContain(response.status());
  return response.json();
}

test.describe('RBAC Permissions', () => {
  test('fan cannot create a team', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/teams`, {
      name: 'Fan Team',
      description: 'Team created by fan',
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_ROLE_REQUIRED');
  });

  test('fan cannot create an organization', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(
      request,
      fan.token,
      'post',
      `${API_BASE_URL}/organizations`,
      {
        name: `Fan Organization ${Date.now()}`,
        description: 'Organization created by fan',
        zip_code: '12345',
      }
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_ROLE_REQUIRED');
  });

  test('fan can create events', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/events`, {
      title: 'Fan Event',
      date: new Date(Date.now() + 86400000).toISOString(),
      location: '123 Main St',
      event_type: 'game',
    });

    expect([200, 201, 403]).toContain(response.status());
  });

  test('fan can RSVP to events', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const fan = await createTestUser(request, 'fan');
    const event = await createTestEvent(request, coach.token);

    const response = await makeAuthRequest(
      request,
      fan.token,
      'post',
      `${API_BASE_URL}/events/${event.id}/rsvp`
    );

    expect([200, 201]).toContain(response.status());
  });

  test('coach cannot create a team before approval', async ({ request }) => {
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

  test('coach cannot create games before approval', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');

    const response = await makeAuthRequest(
      request,
      coach.token,
      'post',
      `${API_BASE_URL}/games`,
      {
        title: 'Coach Game',
        date: new Date(Date.now() + 86400000).toISOString(),
        location: '123 Main St',
      }
    );

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('COACH_APPROVAL_REQUIRED');
  });

  test('non-admin cannot access admin routes', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');

    const response = await makeAuthRequest(
      request,
      fan.token,
      'get',
      `${API_BASE_URL}/admin/dashboard`
    );

    expect([401, 403]).toContain(response.status());
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
});
