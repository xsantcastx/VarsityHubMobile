import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Game Management E2E Tests
 *
 * These tests follow the current server contract:
 * - `/games` lists approved games as `{ games, nextCursor }`
 * - non-approved game visibility is coach/admin scoped
 * - game creation is gated by auth + verification + onboarding/team authority
 * - RSVP is tied to the linked event, not a legacy direct game RSVP surface
 */

const API_BASE_URL =
  (process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:4000')
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
  const email = `games-${role}-${nonce}@varsityhub-test.app`;
  const password = 'TestPassword123!';
  const displayName = `Games ${role} ${nonce}`;

  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
      role,
      ...(role === 'coach' ? { dob: '1990-01-15' } : {}),
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

  return { token, userId: body.user.id };
}

async function fetchGames(request: APIRequestContext, token?: string, query = 'sort=-date&limit=20') {
  const response = token
    ? await createAuthRequest(request, token).get(`${API_BASE_URL}/games?${query}`)
    : await request.get(`${API_BASE_URL}/games?${query}`);

  expect(response.status()).toBe(200);
  const body = await response.json();
  const games = Array.isArray(body?.games) ? body.games : Array.isArray(body) ? body : [];

  expect(Array.isArray(games)).toBe(true);
  return { response, body, games: games as any[] };
}

async function fetchFirstGame(request: APIRequestContext) {
  const { games } = await fetchGames(request);
  return games[0] ?? null;
}

test.describe('Game Management', () => {
  test('Games list returns the current contract shape', async ({ request }) => {
    const { body, games } = await fetchGames(request);

    expect(body).toHaveProperty('games');
    expect(Array.isArray(body.games)).toBe(true);
    expect(body).toHaveProperty('nextCursor');

    if (games.length > 0) {
      expect(games[0]).toHaveProperty('id');
      expect(games[0]).toHaveProperty('approval_status');
    }
  });

  test('Games list supports date-range filtering', async ({ request }) => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { games } = await fetchGames(
      request,
      undefined,
      `sort=date&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=20`
    );

    for (const game of games) {
      if (!game.date) continue;
      const gameTime = new Date(game.date).getTime();
      expect(Number.isNaN(gameTime)).toBe(false);
      expect(gameTime).toBeGreaterThanOrEqual(new Date(from).getTime());
      expect(gameTime).toBeLessThanOrEqual(new Date(to).getTime());
    }
  });

  test('Non-approved games are not visible to anonymous users', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/games?approval_status=pending`);

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/non-approved games/i);
  });

  test('Game creation requires authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/games`, {
      data: {
        title: 'Unauthorized Game',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: '123 Main St, Test City, 12345',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('Fresh coach accounts cannot create games before onboarding is complete', async ({ request }) => {
    const coach = await createTestUser(request, 'coach');
    const response = await createAuthRequest(request, coach.token).post(`${API_BASE_URL}/games`, {
      data: {
        title: 'Blocked Game',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: '123 Main St, Test City, 12345',
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(`${body.error ?? ''} ${body.code ?? ''}`).toMatch(/onboarding|approval|required/i);
  });

  test('Can fetch game detail and summary for an approved game', async ({ request }) => {
    const game = await fetchFirstGame(request);
    test.skip(!game, 'No approved games available in this environment');

    const [detailResponse, summaryResponse] = await Promise.all([
      request.get(`${API_BASE_URL}/games/${game.id}`),
      request.get(`${API_BASE_URL}/games/${game.id}/summary`),
    ]);

    expect(detailResponse.status()).toBe(200);
    expect(summaryResponse.status()).toBe(200);

    const detail = await detailResponse.json();
    const summary = await summaryResponse.json();

    expect(detail.id).toBe(game.id);
    expect(summary.id).toBe(game.id);
    expect(summary).toHaveProperty('eventId');
    expect(summary).toHaveProperty('can_edit_result');
  });

  test('Game posts and media endpoints return list payloads', async ({ request }) => {
    const game = await fetchFirstGame(request);
    test.skip(!game, 'No approved games available in this environment');

    const [postsResponse, mediaResponse] = await Promise.all([
      request.get(`${API_BASE_URL}/games/${game.id}/posts`),
      request.get(`${API_BASE_URL}/games/${game.id}/media`),
    ]);

    expect(postsResponse.status()).toBe(200);
    expect(mediaResponse.status()).toBe(200);

    const posts = await postsResponse.json();
    const media = await mediaResponse.json();

    expect(Array.isArray(posts) || Array.isArray(posts.items)).toBe(true);
    expect(Array.isArray(media)).toBe(true);
  });

  test('RSVP to a linked game event requires authentication', async ({ request }) => {
    const game = await fetchFirstGame(request);
    test.skip(!game, 'No approved games available in this environment');

    const summaryResponse = await request.get(`${API_BASE_URL}/games/${game.id}/summary`);
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json();

    test.skip(!summary.eventId, 'No linked event for the selected game');

    const response = await request.post(`${API_BASE_URL}/events/${summary.eventId}/rsvp`, {
      data: { going: true },
    });

    expect(response.status()).toBe(401);
  });

  test('Authenticated fans can read the approved games feed', async ({ request }) => {
    const fan = await createTestUser(request, 'fan');
    const { games } = await fetchGames(request, fan.token);

    expect(Array.isArray(games)).toBe(true);
  });
});
