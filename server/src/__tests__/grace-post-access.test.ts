/**
 * `viewerHasGracePostAccess` unit tests (mocked prisma, no DB needed).
 *
 * Product rule (2026-07-14, owner decision, verbatim): "When a user posts to
 * an event while they are there, they can continue to post to the event for
 * up to a week. After that week they no longer can." That same contributor
 * must also be able to VIEW the game/event detail page during that week —
 * previously a contributor who posted got a 404 the moment the entity
 * stopped being publicly visible (e.g. an opponent-consent re-flip on a
 * game, or a fan-created event pending approval).
 *
 * The GET /games/:id and GET /events/:id wiring (real-DB integration, since
 * this file mocks '../lib/prisma.js' for the whole module registry) lives in
 * `grace-view-access.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockPostFindFirst = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    post: {
      findFirst: mockPostFindFirst,
    },
  },
}));

const { viewerHasGracePostAccess } = await import('../lib/geofencing.js');

const RECENT_DATE = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago -> grace
const STALE_DATE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago -> closed

describe('viewerHasGracePostAccess', () => {
  beforeEach(() => {
    mockPostFindFirst.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when there is no viewer', async () => {
    const result = await viewerHasGracePostAccess({
      userId: null,
      gameId: 'game-1',
      entityDate: RECENT_DATE,
    });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns false when neither gameId nor eventId is provided', async () => {
    const result = await viewerHasGracePostAccess({
      userId: 'user-1',
      entityDate: RECENT_DATE,
    });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns false when entityDate is missing', async () => {
    const result = await viewerHasGracePostAccess({
      userId: 'user-1',
      gameId: 'game-1',
      entityDate: null,
    });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns false without querying posts once the window is closed (past the 7-day cap)', async () => {
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });
    const result = await viewerHasGracePostAccess({
      userId: 'user-1',
      gameId: 'game-1',
      entityDate: STALE_DATE,
    });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns true when the window is still open (grace) and the user has a post on the game', async () => {
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });
    const result = await viewerHasGracePostAccess({
      userId: 'user-1',
      gameId: 'game-1',
      entityDate: RECENT_DATE,
    });
    expect(result).toBe(true);
    expect(mockPostFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          author_id: 'user-1',
          deleted_at: null,
          OR: [{ game_id: 'game-1' }],
        }),
      })
    );
  });

  it('returns false when the window is open but the user never posted on the entity', async () => {
    mockPostFindFirst.mockResolvedValue(null);
    const result = await viewerHasGracePostAccess({
      userId: 'user-1',
      gameId: 'game-1',
      entityDate: RECENT_DATE,
    });
    expect(result).toBe(false);
  });

  it('checks both event_id and game_id when both are provided', async () => {
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });
    await viewerHasGracePostAccess({
      userId: 'user-1',
      gameId: 'game-1',
      eventId: 'event-1',
      entityDate: RECENT_DATE,
    });
    expect(mockPostFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ game_id: 'game-1' }, { event_id: 'event-1' }],
        }),
      })
    );
  });
});
