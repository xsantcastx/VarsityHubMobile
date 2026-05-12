import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Highlights E2E Tests
 *
 * These tests follow the current contract:
 * - `/highlights` is a read-only feed surface backed by existing media posts
 * - unauthenticated and authenticated callers can fetch highlights
 * - creating highlight posts is gated by the current auth/verification/onboarding rules
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

async function createTestUser(request: APIRequestContext) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email: `highlights-${nonce}@varsityhub-test.app`,
      password: 'HighlightsTestPassword123!',
      display_name: `Highlights ${nonce}`,
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  const token = body.access_token;

  if (body.dev_verification_code) {
    const verifyResponse = await request.post(`${API_BASE_URL}/auth/verify/confirm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { code: String(body.dev_verification_code) },
    });
    expect([200, 204, 429]).toContain(verifyResponse.status());
  }

  return { token };
}

async function fetchHighlights(
  request: APIRequestContext,
  token?: string,
  query = 'country=US&limit=20'
) {
  const response = token
    ? await createAuthRequest(request, token).get(`${API_BASE_URL}/highlights?${query}`)
    : await request.get(`${API_BASE_URL}/highlights?${query}`);

  expect(response.status()).toBe(200);
  return response.json();
}

function assertMediaOnly(items: any[]) {
  for (const item of items) {
    expect(item.media_url).toBeTruthy();
    expect(item.media_type).toBeTruthy();
  }
}

test.describe('Highlights', () => {
  test('Legacy highlights feed returns nationalTop and local buckets', async ({ request }) => {
    const body = await fetchHighlights(request);

    expect(Array.isArray(body.nationalTop)).toBe(true);
    expect(Array.isArray(body.local)).toBe(true);
  });

  test('V2 highlights feed returns nationalTop and ranked buckets', async ({ request }) => {
    const body = await fetchHighlights(request, undefined, 'country=US&limit=20&v2=1');

    expect(Array.isArray(body.nationalTop)).toBe(true);
    expect(Array.isArray(body.ranked)).toBe(true);
  });

  test('Highlights feed only contains media posts', async ({ request }) => {
    const legacy = await fetchHighlights(request);
    const v2 = await fetchHighlights(request, undefined, 'country=US&limit=20&v2=1');

    assertMediaOnly(legacy.nationalTop ?? []);
    assertMediaOnly(legacy.local ?? []);
    assertMediaOnly(v2.nationalTop ?? []);
    assertMediaOnly(v2.ranked ?? []);
  });

  test('Authenticated users can fetch the same highlights contract', async ({ request }) => {
    const user = await createTestUser(request);
    const body = await fetchHighlights(request, user.token, 'country=US&limit=20&v2=1');

    expect(Array.isArray(body.nationalTop)).toBe(true);
    expect(Array.isArray(body.ranked)).toBe(true);
  });

  test('Fresh users cannot create highlight posts until account gates are satisfied', async ({ request }) => {
    const user = await createTestUser(request);
    const response = await createAuthRequest(request, user.token).post(`${API_BASE_URL}/posts`, {
      data: {
        title: 'Blocked Highlight',
        content: 'Blocked highlight attempt',
        media_url: 'https://via.placeholder.com/800x600.jpg',
        type: 'highlight',
      },
    });

    expect([403, 429]).toContain(response.status());

    if (response.status() === 403) {
      const body = await response.json();
      expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/verification|onboarding|coach|required/i);
    }
  });
});
