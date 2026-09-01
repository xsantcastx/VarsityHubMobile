import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client/index.js';
import { API_BASE_URL, createAuthRequest, registerTestUser } from './helpers/apiTestUtils';

/**
 * Game Management E2E Tests
 *
 * These tests follow the current server contract:
 * - `/games` lists approved games as `{ games, nextCursor }`
 * - non-approved game visibility is coach/admin scoped
 * - game creation is gated by auth + verification + onboarding/team authority
 * - RSVP is tied to the linked event, not a legacy direct game RSVP surface
 */

const prisma = new PrismaClient();
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const fixtureIds = {
  userId: '',
  organizationId: '',
  teamId: '',
  gameId: '',
  eventId: '',
};

async function createTestUser(request: APIRequestContext, role: 'fan' | 'coach' = 'fan') {
  const user = await registerTestUser({
    request,
    prefix: 'games',
    password: 'TestPassword123!',
    displayNamePrefix: 'Games',
    role,
    verifyIfPossible: true,
  });
  return { token: user.token, userId: user.userId };
}

async function fetchGames(
  request: APIRequestContext,
  token?: string,
  query = 'sort=-date&limit=20'
) {
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
  const { games } = await fetchGames(request, undefined, 'sort=date&limit=100');
  return games.find(game => game.id === fixtureIds.gameId) ?? null;
}

function getFixtureGame() {
  expect(fixtureIds.gameId).toBeTruthy();
  return { id: fixtureIds.gameId };
}

test.describe('Game Management', () => {
  test.beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `games-fixture-${runId}@varsityhub-test.app`,
        display_name: 'Games Fixture Coach',
        username: `games${runId.replace(/[^a-z0-9]/gi, '')}`.slice(0, 20).toLowerCase(),
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
        },
      },
    });
    fixtureIds.userId = user.id;

    const organization = await prisma.organization.create({
      data: {
        name: `Games Fixture Org ${runId}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    fixtureIds.organizationId = organization.id;

    const team = await prisma.team.create({
      data: {
        name: `Games Fixture Team ${runId}`,
        organization_id: organization.id,
        sport: 'basketball',
      },
    });
    fixtureIds.teamId = team.id;

    const game = await (prisma.game.create as any)({
      data: {
        title: `Games Fixture Match ${runId}`,
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        location: '123 Main St, Test City, 12345',
        home_team_id: team.id,
        created_by_id: user.id,
        approval_status: 'approved',
        opponent_approval_status: 'not_required',
      },
    });
    fixtureIds.gameId = game.id;

    const event = await prisma.event.create({
      data: {
        title: `Games Fixture Match ${runId}`,
        date: game.date,
        location: game.location,
        team_id: team.id,
        game_id: game.id,
        creator_id: user.id,
        creator_role: 'coach',
        status: 'approved',
        approval_status: 'approved',
        approved_at: new Date(),
        event_type: 'game',
      } as any,
    });
    fixtureIds.eventId = event.id;
  });

  test.afterAll(async () => {
    await prisma.event.deleteMany({ where: { id: { in: [fixtureIds.eventId].filter(Boolean) } } });
    await prisma.game.deleteMany({ where: { id: { in: [fixtureIds.gameId].filter(Boolean) } } });
    await prisma.team.deleteMany({ where: { id: { in: [fixtureIds.teamId].filter(Boolean) } } });
    await prisma.organization.deleteMany({
      where: { id: { in: [fixtureIds.organizationId].filter(Boolean) } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [fixtureIds.userId].filter(Boolean) } } });
    await prisma.$disconnect();
  });

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

  test('Fresh coach accounts cannot create games before onboarding is complete', async ({
    request,
  }) => {
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
    const game = getFixtureGame();

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
    const game = getFixtureGame();

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
    const game = getFixtureGame();

    const summaryResponse = await request.get(`${API_BASE_URL}/games/${game.id}/summary`);
    expect(summaryResponse.status()).toBe(200);
    const summary = await summaryResponse.json();

    expect(summary.eventId).toBeTruthy();

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
