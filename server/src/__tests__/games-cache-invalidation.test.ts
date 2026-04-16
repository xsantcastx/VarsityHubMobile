import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockCacheDelPattern = jest.fn(async () => undefined);
const mockGameFindMany = jest.fn(async () => []);
const mockGameCreate = jest.fn();
const mockGameFindUnique = jest.fn();
const mockGameUpdate = jest.fn();
const mockEventCreate = jest.fn();
const mockEventUpdateMany = jest.fn(async () => ({ count: 1 }));
const mockUserFindUnique = jest.fn();

jest.unstable_mockModule('../lib/cache.js', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
  cacheDel: jest.fn(async () => undefined),
  cacheDelPattern: mockCacheDelPattern,
}));

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    game: {
      findMany: mockGameFindMany,
      create: mockGameCreate,
      findUnique: mockGameFindUnique,
      update: mockGameUpdate,
      count: jest.fn(async () => 0),
      delete: jest.fn(),
    },
    event: {
      create: mockEventCreate,
      updateMany: mockEventUpdateMany,
      findFirst: jest.fn(async () => null),
      update: jest.fn(),
    },
    teamMembership: {
      findFirst: jest.fn(async () => null),
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    notification: {
      create: jest.fn(async () => ({ id: 'notif-1' })),
    },
    post: {
      findMany: jest.fn(async () => []),
    },
    story: {
      findUnique: jest.fn(async () => null),
      delete: jest.fn(),
    },
  },
}));

jest.unstable_mockModule('../middleware/requireVerified.js', () => ({
  requireVerified: (_req: any, _res: any, next: any) => next(),
}));

jest.unstable_mockModule('../middleware/requireOnboarded.js', () => ({
  requireOnboarded: (_req: any, _res: any, next: any) => next(),
}));

jest.unstable_mockModule('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));

jest.unstable_mockModule('../middleware/requireAdmin.js', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isEmailAdmin: jest.fn(() => true),
  getIsAdmin: jest.fn(async () => true),
}));

jest.unstable_mockModule('../middleware/rateLimiters.js', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    gameCreationLimiter: pass,
    voteLimiter: pass,
  };
});

jest.unstable_mockModule('../routes/gameStories.js', () => ({
  makeCreateStoryHandler: () => (_req: any, res: any) => res.status(501).json({ error: 'unused' }),
  makeListMediaHandler: () => (_req: any, res: any) => res.json([]),
  serializeMedia: jest.fn(),
}));

jest.unstable_mockModule('../lib/privacyUtils.js', () => ({
  getExcludedPrivateAuthorIds: jest.fn(async () => []),
}));

jest.unstable_mockModule('../lib/notifications.js', () => ({
  sendPushNotification: jest.fn(async () => []),
}));

jest.unstable_mockModule('../lib/debugLog.js', () => ({
  debugLog: jest.fn(),
}));

const { gamesRouter } = await import('../routes/games.js');
const VALID_GAME_ID = 'c123456789012345678901234';

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'admin-1' };
  next();
});
app.use('/games', gamesRouter);

describe('games list cache invalidation', () => {
  beforeEach(() => {
    mockCacheDelPattern.mockClear();
    mockGameCreate.mockReset();
    mockGameFindUnique.mockReset();
    mockGameUpdate.mockReset();
    mockEventCreate.mockReset();
    mockEventUpdateMany.mockClear();
    mockUserFindUnique.mockReset();
    mockUserFindUnique.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('clears cached games list after creating a game', async () => {
    mockGameCreate.mockResolvedValue({
      id: 'game-1',
      title: 'Cache Games Test Create',
      date: new Date(Date.now() + 60_000),
      location: 'Cache Arena',
      latitude: 41.1,
      longitude: -73.5,
      banner_url: null,
      homeTeam: null,
      awayTeam: null,
    });
    mockEventCreate.mockResolvedValue({ id: 'event-1' });

    await request(app)
      .post('/games')
      .send({
        title: 'Cache Games Test Create',
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: 'Cache Arena',
        latitude: 41.1,
        longitude: -73.5,
        event_type: 'game',
      })
      .expect(201);

    expect(mockCacheDelPattern).toHaveBeenCalledWith('games:*');
  });

  it('clears cached games list after approving a game', async () => {
    mockGameFindUnique.mockResolvedValue({
      id: VALID_GAME_ID,
      home_team_id: null,
      away_team_id: null,
      approval_status: 'pending',
    });
    mockGameUpdate.mockResolvedValue({
      id: VALID_GAME_ID,
      created_by_id: 'admin-1',
      title: 'Cache Games Test Approve',
    });

    const response = await request(app)
      .put(`/games/${VALID_GAME_ID}/approve`)
      .send({ approval_status: 'approved' });
    expect(response.status).toBe(200);

    expect(mockCacheDelPattern).toHaveBeenCalledWith('games:*');
  });
});
