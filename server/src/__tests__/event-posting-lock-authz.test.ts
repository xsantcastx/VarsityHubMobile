/**
 * Authorization boundary for the posting kill switch — POST /events/:id/posting.
 *
 * "Correct users can only edit their OWN teams." This pins, at runtime:
 *   - a platform admin can freeze/reopen any event
 *   - a staff member of the event's OWN team can freeze/reopen it
 *   - a coach who manages a DIFFERENT team gets 403 (cannot touch it)
 *   - a bad body is a 400, not an accidental write
 * and that a successful write persists posting_closed and logs an audit row.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockEventFindUnique = jest.fn();
const mockEventUpdate = jest.fn();
const mockGetIsAdmin = jest.fn(async () => false);
const mockCanManageTeam = jest.fn(async () => false);
const mockCanManageAnyTeam = jest.fn(async () => false);
const mockLogAdmin = jest.fn(async () => undefined);

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique, update: mockEventUpdate },
  },
}));

jest.unstable_mockModule('../lib/teamAuthorization.js', () => ({
  TEAM_STAFF_ROLES: ['owner', 'manager', 'coach', 'assistant_coach'],
  ORG_ADMIN_ROLES: ['owner', 'manager'],
  TEAM_ADMIN_ROLES: ['owner', 'coach'],
  canManageTeam: mockCanManageTeam,
  canManageAnyTeam: mockCanManageAnyTeam,
  canArchiveTeam: jest.fn(async () => false),
  isOrgAdmin: jest.fn(async () => false),
  isOrgOwner: jest.fn(async () => false),
  canAdministerTeam: jest.fn(async () => false),
  canApproveTeamGame: jest.fn(async () => false),
  canAssignTeamRole: jest.fn(async () => false),
  canViewTeam: jest.fn(async () => true),
  isAdminOfAnyOrg: jest.fn(async () => false),
}));

jest.unstable_mockModule('../middleware/requireAdmin.js', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  isEmailAdmin: jest.fn(() => false),
  getIsAdmin: mockGetIsAdmin,
  isVerifiedAdminUser: jest.fn(async () => false),
}));

jest.unstable_mockModule('../lib/adminActivityLogger.js', () => ({
  logAdminActivity: jest.fn(async () => undefined),
  logAdminActivityFromReq: mockLogAdmin,
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

let currentUserId = 'coach-outsider';
const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: currentUserId };
  next();
});
app.use('/events', eventsRouter);

// A game-linked event: teams live on the linked game, its own team_id is null
// (the common case reached from a game page's "+" post button).
const EVENT = {
  id: 'caaaaaaaaaaaaaaaaaaaaaaaa',
  title: 'Rival Game',
  team_id: null as string | null,
  posting_closed: false,
  game: { home_team_id: 'home-1', away_team_id: 'away-1' },
};

beforeEach(() => {
  mockEventFindUnique.mockReset();
  mockEventUpdate.mockReset();
  mockGetIsAdmin.mockReset();
  mockCanManageTeam.mockReset();
  mockCanManageAnyTeam.mockReset();
  mockLogAdmin.mockReset();

  mockEventFindUnique.mockResolvedValue({ ...EVENT });
  mockGetIsAdmin.mockResolvedValue(false);
  mockCanManageTeam.mockResolvedValue(false);
  mockCanManageAnyTeam.mockResolvedValue(false);
  mockEventUpdate.mockImplementation(async ({ data }: any) => ({
    id: 'caaaaaaaaaaaaaaaaaaaaaaaa',
    posting_closed: data.posting_closed,
  }));
  mockLogAdmin.mockResolvedValue(undefined);
  currentUserId = 'coach-outsider';
});

describe('POST /events/:id/posting authorization', () => {
  it('lets a platform admin freeze the event and writes an audit row', async () => {
    mockGetIsAdmin.mockResolvedValue(true);

    const res = await request(app)
      .post('/events/caaaaaaaaaaaaaaaaaaaaaaaa/posting')
      .send({ closed: true })
      .expect(200);

    expect(res.body.posting_closed).toBe(true);
    expect(mockEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { posting_closed: true } })
    );
    expect(mockLogAdmin).toHaveBeenCalledWith(
      expect.anything(),
      'EVENT_POSTING_CLOSED',
      'event',
      'caaaaaaaaaaaaaaaaaaaaaaaa',
      expect.any(String)
    );
  });

  it("lets staff of the event's OWN team freeze it", async () => {
    currentUserId = 'home-coach';
    // Manages one of the event's game teams.
    mockCanManageAnyTeam.mockImplementation(async (_uid: any, teamIds: any) =>
      (teamIds as string[]).includes('home-1')
    );

    const res = await request(app)
      .post('/events/caaaaaaaaaaaaaaaaaaaaaaaa/posting')
      .send({ closed: true })
      .expect(200);
    expect(res.body.posting_closed).toBe(true);
    // Authorization was scoped to THIS event's teams, not a global grant.
    expect(mockCanManageAnyTeam).toHaveBeenCalledWith(
      'home-coach',
      expect.arrayContaining(['home-1', 'away-1'])
    );
  });

  it('rejects a coach who manages a DIFFERENT team (403, no write)', async () => {
    currentUserId = 'other-coach';
    // Not admin, manages neither of this event's teams.
    mockCanManageAnyTeam.mockResolvedValue(false);
    mockCanManageTeam.mockResolvedValue(false);

    await request(app)
      .post('/events/caaaaaaaaaaaaaaaaaaaaaaaa/posting')
      .send({ closed: true })
      .expect(403);

    expect(mockEventUpdate).not.toHaveBeenCalled();
    expect(mockLogAdmin).not.toHaveBeenCalled();
  });

  it('rejects a malformed body with 400 and no write', async () => {
    mockGetIsAdmin.mockResolvedValue(true);
    await request(app)
      .post('/events/caaaaaaaaaaaaaaaaaaaaaaaa/posting')
      .send({ closed: 'yes' })
      .expect(400);
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing event without checking teams', async () => {
    mockGetIsAdmin.mockResolvedValue(true);
    mockEventFindUnique.mockResolvedValue(null);
    await request(app)
      .post('/events/cbbbbbbbbbbbbbbbbbbbbbbbb/posting')
      .send({ closed: true })
      .expect(404);
    expect(mockEventUpdate).not.toHaveBeenCalled();
  });
});
