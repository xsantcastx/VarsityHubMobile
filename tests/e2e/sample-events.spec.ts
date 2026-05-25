import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_BASE_URL, createAuthRequest, registerTestUser } from './helpers/apiTestUtils';

/**
 * Sample Events / Sample Games E2E Tests
 *
 * Current contract:
 * - sample game IDs are supported on read/query surfaces without DB foreign-key rows
 * - sample IDs bypass geofencing only; they do not bypass auth/verification/role gates
 */

async function createUser(request: APIRequestContext) {
  const user = await registerTestUser({
    request,
    prefix: 'sample-events',
    password: 'E2ETestPassword123!',
    displayNamePrefix: 'Sample Events',
  });
  return { accessToken: user.token };
}

test.describe('Sample Events Posting', () => {
  test('Sample game posts can be queried by sample game id', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/posts?game_id=sample-warriors-cavaliers`);

    expect(response.status()).toBe(200);
    const body = await response.json();
    const posts = Array.isArray(body) ? body : Array.isArray(body.items) ? body.items : [];
    expect(Array.isArray(posts)).toBe(true);
  });

  test('Posting to a sample game still respects account write gates', async ({ request }) => {
    const user = await createUser(request);
    const response = await createAuthRequest(request, user.accessToken).post(`${API_BASE_URL}/posts`, {
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
      `${API_BASE_URL}/games/sample-warriors-cavaliers/stories`,
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
