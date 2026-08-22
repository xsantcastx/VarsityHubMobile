/**
 * Empty-event cleanup (cleanup-empty-events cron, 2026-08).
 *
 * Owner rule: "you don't have to keep events that don't end up getting posts on
 * them, but only remove them after the 7-day window." This is a REVERSIBLE
 * soft-archive (sets archived_at) — nothing is deleted. These tests pin the
 * selection rules so cleanup can never touch an event it shouldn't:
 *   - only events past the full ~8-day window (7-day grace + up-to-18h live)
 *   - only events with ZERO posts (posts are the only signal; RSVPs don't save)
 *   - game-linked events qualify only when the linked game also has no posts
 *   - never pro/seeded fixtures, never sample rows, never already-archived
 * and that it's bounded + idempotent (no candidates -> no write).
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockFindMany = jest.fn();
const mockUpdateMany = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: { event: { findMany: mockFindMany, updateMany: mockUpdateMany } },
}));

const { archiveEmptyExpiredEvents, EVENT_CLEANUP_MIN_AGE_MS } =
  await import('../lib/eventCleanup.js');

beforeEach(() => {
  mockFindMany.mockReset();
  mockUpdateMany.mockReset();
  mockUpdateMany.mockResolvedValue({ count: 0 });
});

describe('archiveEmptyExpiredEvents', () => {
  it('archives the selected candidates and returns the count', async () => {
    mockFindMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
    mockUpdateMany.mockResolvedValue({ count: 2 });

    const now = new Date('2026-08-22T00:00:00.000Z');
    const count = await archiveEmptyExpiredEvents(now);

    expect(count).toBe(2);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ['e1', 'e2'] } },
      data: { archived_at: now },
    });
  });

  it('does NOT write when there are no candidates (idempotent no-op)', async () => {
    mockFindMany.mockResolvedValue([]);
    const count = await archiveEmptyExpiredEvents(new Date());
    expect(count).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('selects only past-window, empty, non-pro, non-sample, unarchived events', async () => {
    mockFindMany.mockResolvedValue([]);
    const now = new Date('2026-08-22T00:00:00.000Z');
    await archiveEmptyExpiredEvents(now);

    const where = mockFindMany.mock.calls[0][0].where;
    // Reversibility guard: never re-touch an already-archived row.
    expect(where.archived_at).toBeNull();
    expect(where.status).toEqual({ not: 'cancelled' });
    // Window: date strictly older than now - 8 days.
    expect(where.date.lt.getTime()).toBe(now.getTime() - EVENT_CLEANUP_MIN_AGE_MS);
    // Posts are the only signal.
    expect(where.posts).toEqual({ none: {} });
    // Never pro/seeded.
    expect(where.pro_home_team_id).toBeNull();
    expect(where.pro_away_team_id).toBeNull();
    expect(where.pro_external_ref).toBeNull();
    // Never sample rows.
    expect(where.NOT).toEqual({ id: { startsWith: 'sample-' } });
    // Game-linked events qualify only when the linked game also has no posts.
    expect(where.OR).toEqual([{ game_id: null }, { game: { is: { posts: { none: {} } } } }]);
  });

  it('caps the batch (passes take through) so one run is bounded', async () => {
    mockFindMany.mockResolvedValue([]);
    await archiveEmptyExpiredEvents(new Date(), 250);
    expect(mockFindMany.mock.calls[0][0].take).toBe(250);
  });
});
