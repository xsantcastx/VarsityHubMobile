import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Sample Events / Sample Games E2E Tests
 *
 * Current contract:
 * - sample game IDs are supported on read/query surfaces without DB foreign-key rows
 * - sample IDs bypass geofencing only; they do not bypass auth/verification/role gates
 */

const API_URL = (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4000')
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

async function createUser(request: APIRequestContext) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: `sample-events-${nonce}@varsityhub-test.app`,
      password: 'E2ETestPassword123!',
      display_name: `Sample Events ${nonce}`,
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  return { accessToken: body.access_token };
}

test.describe('Sample Events Posting', () => {
  test('Sample game posts can be queried by sample game id', async ({ request }) => {
    const response = await request.get(`${API_URL}/posts?game_id=sample-warriors-cavaliers`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    const posts = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [];
    expect(Array.isArray(posts)).toBe(true);
  });

  test('Posting to a sample game still respects account write gates', async ({ request }) => {
    const user = await createUser(request);
    const response = await createAuthRequest(request, user.accessToken).post(`${API_URL}/posts`, {
      data: {
        content: 'Sample game post attempt',
        media_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
        type: 'post',
        game_id: 'sample-warriors-cavaliers',
      },
    });

    expect([403, 429]).toContain(response.status());
    if (response.status() === 403) {
      const body = await response.json();
      expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/verification|onboarding|coach|required/i);
    }
  });

  test('Posting a story to a sample game still requires an eligible account', async ({ request }) => {
    const user = await createUser(request);
    const response = await createAuthRequest(request, user.accessToken).post(
      `${API_URL}/games/sample-warriors-cavaliers/stories`,
      {
        data: {
          media_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
          caption: 'Sample game story attempt',
        },
      }
    );

    expect([400, 403, 429]).toContain(response.status());
  });
});
