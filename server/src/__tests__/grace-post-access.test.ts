/**
 * `viewerHasPostedOnEntity` unit tests (mocked prisma, no DB needed).
 *
 * Owner rule (2026-07-14): viewing is PERMANENT — "any user can view any past
 * game at any time; it'll lock posting but viewing is always on." So a
 * contributor who posted to a game/event can view it forever (the 7-day cap
 * applies ONLY to posting, tested in geofencing-post-grace-window.test.ts).
 * This helper is a read-only access check with no time window.
 *
 * The GET /games/:id and GET /events/:id wiring (real-DB integration) lives in
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

const { viewerHasPostedOnEntity } = await import('../lib/geofencing.js');

describe('viewerHasPostedOnEntity', () => {
  beforeEach(() => {
    mockPostFindFirst.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns false when there is no viewer', async () => {
    const result = await viewerHasPostedOnEntity({ userId: null, gameId: 'game-1' });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns false when neither gameId nor eventId is provided', async () => {
    const result = await viewerHasPostedOnEntity({ userId: 'user-1' });
    expect(result).toBe(false);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('returns true when the user has a post on the game — NO time window (viewing is permanent)', async () => {
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });
    const result = await viewerHasPostedOnEntity({ userId: 'user-1', gameId: 'game-1' });
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

  it('returns false when the user never posted on the entity', async () => {
    mockPostFindFirst.mockResolvedValue(null);
    const result = await viewerHasPostedOnEntity({ userId: 'user-1', gameId: 'game-1' });
    expect(result).toBe(false);
  });

  it('checks both event_id and game_id when both are provided', async () => {
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });
    await viewerHasPostedOnEntity({ userId: 'user-1', gameId: 'game-1', eventId: 'event-1' });
    expect(mockPostFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ game_id: 'game-1' }, { event_id: 'event-1' }],
        }),
      })
    );
  });
});
