import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

/**
 * Regression test for the map's date lens (2026-08).
 *
 * The map's single-day date picker lets a user browse a PAST day to find an
 * event they attended and post a recap while it is still inside its 7-day
 * upload window. That query carries an explicit from/to window AND map_view=true
 * (the client keeps map_view for the live case).
 *
 * `map_view=true` normally forces "this week only" (date >= now). This test
 * pins that an explicit from/to window WINS over that clause — otherwise a
 * deliberately-selected past day would be re-hidden and the whole feature would
 * silently return nothing. It also pins that map_view WITHOUT a date window is
 * unchanged (still current-week-only).
 */

const mockGameFindMany = jest.fn(async () => [] as any[]);

jest.unstable_mockModule('../lib/cache.js', () => ({
  cacheGet: jest.fn(async () => null),
  cacheSet: jest.fn(async () => undefined),
  cacheDel: jest.fn(async () => undefined),
  cacheDelPattern: jest.fn(async () => undefined),
}));

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    game: {
      findMany: mockGameFindMany,
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 0),
      delete: jest.fn(),
    },
    event: {
      create: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
      findFirst: jest.fn(async () => null),
      update: jest.fn(),
    },
    eventRsvp: { groupBy: jest.fn(async () => []) },
    teamMembership: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    organizationMembership: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    team: { findMany: jest.fn(async () => []) },
    teamFollow: { findMany: jest.fn(async () => []) },
    user: { findUnique: jest.fn(async () => null) },
    post: { findMany: jest.fn(async () => []) },
  },
}));

jest.unstable_mockModule('../lib/geoUtils.js', () => ({
  getZipCoordinates: jest.fn(() => null),
  haversineDistance: jest.fn(() => 0),
}));

jest.unstable_mockModule('../lib/geocoding.js', () => ({
  geocodeLocation: jest.fn(async () => null),
  geocodeGame: jest.fn(async () => null),
  geocodeEvent: jest.fn(async () => null),
  geocodeAllGames: jest.fn(async () => ({})),
  geocodeAllEvents: jest.fn(async () => 0),
  clearGeocodeCache: jest.fn(),
  getCacheStats: jest.fn(() => ({})),
  bulkGeocodeLocations: jest.fn(async () => new Map()),
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
  isEmailAdmin: jest.fn(() => false),
  getIsAdmin: jest.fn(async () => false),
  isVerifiedAdminUser: jest.fn(async () => false),
}));

jest.unstable_mockModule('../middleware/rateLimiters.js', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { gameCreationLimiter: pass, storyCreationLimiter: pass, voteLimiter: pass };
});

jest.unstable_mockModule('../lib/privacyUtils.js', () => ({
  getExcludedPrivateAuthorIds: jest.fn(async () => []),
  getBlockedUserIds: jest.fn(async () => []),
  getRequestBlockedCache: jest.fn(() => new Map()),
}));

jest.unstable_mockModule('../lib/notifications.js', () => ({
  sendPushNotification: jest.fn(async () => []),
}));

jest.unstable_mockModule('../lib/debugLog.js', () => ({ debugLog: jest.fn() }));

const { gamesRouter } = await import('../routes/games.js');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'viewer-1' };
  next();
});
app.use('/games', gamesRouter);

const lastWhere = () => {
  const calls = mockGameFindMany.mock.calls as unknown as Array<[Record<string, any>]>;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0].where as Record<string, any>;
};

// Collect every `date` constraint anywhere in the where tree (top-level and
// inside any AND/OR branch) so we can prove no clause forces date >= now.
const collectDateConstraints = (node: any, out: any[] = []): any[] => {
  if (!node || typeof node !== 'object') return out;
  if (node.date && typeof node.date === 'object') out.push(node.date);
  for (const key of ['AND', 'OR']) {
    if (Array.isArray(node[key]))
      node[key].forEach((child: any) => collectDateConstraints(child, out));
  }
  return out;
};

beforeEach(() => {
  mockGameFindMany.mockReset();
  mockGameFindMany.mockResolvedValue([]);
});

describe('GET /games — map_view + explicit date window', () => {
  it('lets a past from/to window win over map_view (past day is not re-hidden)', async () => {
    const from = new Date('2026-01-10T00:00:00.000Z');
    const to = new Date('2026-01-11T00:00:00.000Z');

    await request(app)
      .get(`/games?sort=date&map_view=true&from=${from.toISOString()}&to=${to.toISOString()}`)
      .expect(200);

    const where = lastWhere();
    // The explicit window is applied verbatim...
    expect(where.date).toBeDefined();
    expect(new Date(where.date.gte).toISOString()).toBe(from.toISOString());
    expect(new Date(where.date.lte).toISOString()).toBe(to.toISOString());

    // ...and NO clause anywhere forces date >= now (which would exclude the
    // deliberately-selected past day). Every date constraint must stay within
    // the requested window — none may start at/after "now".
    const now = Date.now();
    for (const d of collectDateConstraints(where)) {
      if (d.gte != null) {
        expect(new Date(d.gte).getTime()).toBeLessThan(now);
      }
    }
  });

  it('still forces current-week-only when map_view has NO date window', async () => {
    const before = Date.now();
    await request(app).get('/games?sort=date&map_view=true').expect(200);
    const after = Date.now();

    const where = lastWhere();
    // No top-level explicit window...
    expect(where.date).toBeUndefined();
    // ...instead a clause forces date >= now (the this-week map behavior).
    const constraints = collectDateConstraints(where);
    const forcesNow = constraints.some(
      d =>
        d.gte != null && new Date(d.gte).getTime() >= before && new Date(d.gte).getTime() <= after
    );
    expect(forcesNow).toBe(true);
  });
});
