import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEventFindUnique = jest.fn();
const mockGameFindUnique = jest.fn();
const mockPostFindFirst = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    event: {
      findUnique: mockEventFindUnique,
    },
    game: {
      findUnique: mockGameFindUnique,
    },
    post: {
      findFirst: mockPostFindFirst,
    },
  },
}));

const { isStoryPostingWindowOpen, verifyEventPostingPermission, verifyStoryPostingPermission } =
  await import('../lib/geofencing.js');

const EVENT_DATE = new Date('2026-05-10T18:00:00.000Z');
const BASE_EVENT = {
  id: 'event-1',
  title: 'Championship',
  date: EVENT_DATE,
  latitude: 40.7128,
  longitude: -74.006,
  location: 'Stadium',
  game_id: 'game-1',
};

describe('regular post grace window', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockEventFindUnique.mockReset();
    mockGameFindUnique.mockReset();
    mockPostFindFirst.mockReset();
    global.fetch = jest.fn() as any;
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockGameFindUnique.mockResolvedValue(null);
    mockPostFindFirst.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('denies posting before the window opens', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() - 2 * 24 * 60 * 60 * 1000 - 1));

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('allows posting during the live window', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(true);
    expect(mockPostFindFirst).not.toHaveBeenCalled();
  });

  it('allows posting at +24h when the same user already posted while live', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 24 * 60 * 60 * 1000));
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(true);
    expect(mockPostFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          author_id: 'user-1',
          game_id: 'game-1',
          deleted_at: null,
          created_at: {
            gte: EVENT_DATE,
            lte: new Date(EVENT_DATE.getTime() + 2 * 60 * 60 * 1000),
          },
        }),
      })
    );
  });

  it('allows posting at +24h from FAR AWAY when the user already posted while live', async () => {
    // Once a user posted live (proving they were at the venue), the grace
    // window lets them post recaps/highlights from anywhere — no geofence.
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 24 * 60 * 60 * 1000));
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });

    // Los Angeles coords — ~3900 km from the NYC venue.
    const result = await verifyEventPostingPermission('event-1', 'user-1', 34.0522, -118.2437);

    expect(result.allowed).toBe(true);
  });

  it('allows posting at +24h with NO location when the user already posted while live', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 24 * 60 * 60 * 1000));
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });

    const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

    expect(result.allowed).toBe(true);
  });

  it('still enforces the 3km geofence during the LIVE window', async () => {
    // Regression guard: dropping the geofence in grace must NOT relax live posting.
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

    const result = await verifyEventPostingPermission('event-1', 'user-1', 34.0522, -118.2437);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('TOO_FAR_FROM_VENUE');
  });

  it('denies posting at +24h without a prior live post', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 24 * 60 * 60 * 1000));

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    expect(result.reason).toContain('only if you already posted to this event while it was live');
  });

  it('still allows posting long after the event when the user posted while live (open-ended)', async () => {
    // Post-event uploads have no closing cutoff. 30 days later, a user who
    // posted during the live window can still post.
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 24 * 60 * 60 * 1000));
    mockPostFindFirst.mockResolvedValue({ id: 'post-1' });

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(true);
    expect(mockPostFindFirst).toHaveBeenCalled();
  });

  it('still denies posting long after the event when the user never posted while live', async () => {
    jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 24 * 60 * 60 * 1000));

    const result = await verifyEventPostingPermission('event-1', 'user-1', 40.7128, -74.006);

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    expect(result.reason).toContain('only if you already posted to this event while it was live');
  });

  it('keeps story uploads open through +48h after the event', () => {
    jest.setSystemTime(new Date('2026-05-10T23:00:00.000Z'));
    expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(true);

    jest.setSystemTime(new Date('2026-05-11T12:00:00.000Z'));
    expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(true);

    jest.setSystemTime(new Date('2026-05-12T17:59:59.000Z'));
    expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(true);

    jest.setSystemTime(new Date('2026-05-12T18:00:01.000Z'));
    expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(false);
  });

  it('rejects stories when client coordinates conflict with network location', async () => {
    jest.setSystemTime(new Date('2026-05-10T23:00:00.000Z'));
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ latitude: 34.0522, longitude: -118.2437 }),
    });

    const result = await verifyStoryPostingPermission(
      'event-1',
      'user-1',
      40.7128,
      -74.006,
      '8.8.8.8'
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('LOCATION_SPOOF_SUSPECTED');
  });
});
