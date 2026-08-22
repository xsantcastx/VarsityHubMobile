/**
 * Map display horizon (owner rule, 2026-08): on the map (`map_view=true`), PRO
 * fixtures (pro_home/away_team linked — the auto-synced league schedules) are
 * capped to the next ~14 days so seeded pro games don't flood the map weeks out,
 * while team/org events stay UNCAPPED (a coach's full season shows). A picked
 * past day (from/to window) overrides — no cap that day.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockEventFindMany = jest.fn(async () => [] as any[]);

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    event: { findMany: mockEventFindMany, count: jest.fn(async () => 0) },
    user: { findUnique: jest.fn(async () => null) },
    teamFollow: { findMany: jest.fn(async () => []) },
  },
}));

jest.unstable_mockModule('../middleware/requireAdmin.js', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isEmailAdmin: jest.fn(() => false),
  getIsAdmin: jest.fn(async () => false),
  isVerifiedAdminUser: jest.fn(async () => false),
}));

jest.unstable_mockModule('../middleware/requireAuth.js', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
}));
jest.unstable_mockModule('../middleware/requireVerified.js', () => ({
  requireVerified: (_req: any, _res: any, next: any) => next(),
}));
jest.unstable_mockModule('../middleware/requireOnboarded.js', () => ({
  requireOnboarded: (_req: any, _res: any, next: any) => next(),
}));
jest.unstable_mockModule('../middleware/rateLimiters.js', () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return { eventCreationLimiter: pass, rsvpLimiter: pass };
});
jest.unstable_mockModule('../lib/debugLog.js', () => ({ debugLog: jest.fn() }));

const { eventsRouter } = await import('../routes/events.js');

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = undefined; // guest — public list
  next();
});
app.use('/events', eventsRouter);

const lastWhere = () => {
  const calls = mockEventFindMany.mock.calls as unknown as Array<[Record<string, any>]>;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0].where as Record<string, any>;
};

const findProHorizonClause = (where: any) =>
  (where.AND || []).find(
    (c: any) =>
      Array.isArray(c.OR) &&
      c.OR.some((b: any) => b.pro_home_team_id === null && b.pro_away_team_id === null)
  );

beforeEach(() => {
  mockEventFindMany.mockReset();
  mockEventFindMany.mockResolvedValue([]);
});

describe('GET /events — map pro horizon', () => {
  it('caps pro events to ~14 days and leaves team events uncapped when map_view=true', async () => {
    const after = Date.now();
    await request(app).get('/events?map_view=true&sort=date&show_all=true').expect(200);

    const clause = findProHorizonClause(lastWhere());
    expect(clause).toBeDefined();

    const teamBranch = clause.OR.find(
      (b: any) => b.pro_home_team_id === null && b.pro_away_team_id === null
    );
    const proBranch = clause.OR.find((b: any) => Array.isArray(b.OR));

    // Team/org events: no date cap in this branch (full season).
    expect(teamBranch.date).toBeUndefined();
    // Pro events: capped ~14 days out.
    const days = (proBranch.date.lte.getTime() - after) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(13);
    expect(days).toBeLessThan(15);
  });

  it('does NOT apply the horizon without map_view (feed/list keep full range)', async () => {
    await request(app).get('/events?sort=date&show_all=true').expect(200);
    expect(findProHorizonClause(lastWhere())).toBeUndefined();
  });

  it('does NOT apply the horizon when a past day is picked (from/to overrides)', async () => {
    const from = new Date('2026-01-10T00:00:00.000Z').toISOString();
    const to = new Date('2026-01-11T00:00:00.000Z').toISOString();
    await request(app)
      .get(`/events?map_view=true&sort=date&show_all=true&from=${from}&to=${to}`)
      .expect(200);
    expect(findProHorizonClause(lastWhere())).toBeUndefined();
  });
});
