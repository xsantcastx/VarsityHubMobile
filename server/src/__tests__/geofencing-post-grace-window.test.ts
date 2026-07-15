import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEventFindUnique = jest.fn();
const mockGameFindUnique = jest.fn();
const mockPostFindFirst = jest.fn();
const mockStoryFindFirst = jest.fn();
const mockUnlockFindUnique = jest.fn();
const mockUnlockCreateMany = jest.fn();

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
    story: {
      findFirst: mockStoryFindFirst,
    },
    eventPostingUnlock: {
      findUnique: mockUnlockFindUnique,
      createMany: mockUnlockCreateMany,
    },
  },
}));

const { isStoryPostingWindowOpen, verifyEventPostingPermission, verifyStoryPostingPermission } =
  await import('../lib/geofencing.js');

const EVENT_DATE = new Date('2026-05-10T18:00:00.000Z');
// Default live window: -1h → +3h around event start (owner rule 2026-07-15).
const LIVE_CUTOFF = new Date(EVENT_DATE.getTime() + 3 * 60 * 60 * 1000);
const GRACE_END = new Date(LIVE_CUTOFF.getTime() + 7 * 24 * 60 * 60 * 1000);
const BASE_EVENT = {
  id: 'event-1',
  title: 'Championship',
  date: EVENT_DATE,
  latitude: 40.7128,
  longitude: -74.006,
  location: 'Stadium',
  game_id: 'game-1',
  exclusive_poster_id: null,
  live_window_hours_after_start: null as number | null,
};
// All-day festival override (Fanatics Fest day events set 18).
const FEST_EVENT = { ...BASE_EVENT, live_window_hours_after_start: 18 };

// Venue is NYC; LA is ~3900 km away.
const VENUE = { lat: 40.7128, lon: -74.006 };
const FAR_AWAY = { lat: 34.0522, lon: -118.2437 };

describe('first-post-unlocks-7-days posting rule', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockEventFindUnique.mockReset();
    mockGameFindUnique.mockReset();
    mockPostFindFirst.mockReset();
    mockStoryFindFirst.mockReset();
    mockUnlockFindUnique.mockReset();
    mockUnlockCreateMany.mockReset();
    global.fetch = jest.fn() as any;
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockGameFindUnique.mockResolvedValue(null);
    mockPostFindFirst.mockResolvedValue(null);
    mockStoryFindFirst.mockResolvedValue(null);
    mockUnlockFindUnique.mockResolvedValue(null);
    mockUnlockCreateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('regular posts — live window (geofenced first posts)', () => {
    it('denies posting before the window opens (more than 1h before start)', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 60 * 60 * 1000 - 1));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });

    it('allows a geofenced post 30 minutes BEFORE start (window opens -1h)', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 30 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
    });

    it('allows a geofenced first post during the event and grants the unlock', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
      expect(mockUnlockCreateMany).toHaveBeenCalledWith({
        data: [{ user_id: 'user-1', event_id: 'event-1' }],
        skipDuplicates: true,
      });
    });

    it('closes the default live window 3h after start for first-time posters, even at the venue', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 5 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    });

    it('the live_window_hours_after_start override keeps geofenced first posts open all day (Fanatics Fest)', async () => {
      // Fest day events set 18h: a first-time poster standing at the Javits
      // Center at +17h can still post (and earns their unlock).
      mockEventFindUnique.mockResolvedValue(FEST_EVENT);
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 17 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
      expect(mockUnlockCreateMany).toHaveBeenCalled();
    });

    it('the override still enforces the geofence for first posts', async () => {
      mockEventFindUnique.mockResolvedValue(FEST_EVENT);
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 17 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
    });

    it('still enforces the 3km geofence for a FIRST post during the event', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('still requires location for a FIRST post during the event', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('LOCATION_REQUIRED');
    });

    it('allows an unlocked user to post from FAR AWAY during the live window (no re-geofence)', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 2 * 60 * 60 * 1000));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(true);
    });

    it('allows an unlocked user to post with NO location during the live window', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 2 * 60 * 60 * 1000));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
    });

    it('allows an unlocked fest attendee to keep posting mid-day without location (flaky indoor GPS)', async () => {
      mockEventFindUnique.mockResolvedValue(FEST_EVENT);
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 6 * 60 * 60 * 1000));
      mockUnlockFindUnique.mockResolvedValue({
        unlocked_at: new Date(EVENT_DATE.getTime() + 30 * 60 * 1000),
      });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
    });
  });

  describe('regular posts — post-event grace window (unlock only)', () => {
    const GRACE_TIME = new Date(LIVE_CUTOFF.getTime() + 24 * 60 * 60 * 1000);

    it('allows an unlocked user to post from anywhere during grace', async () => {
      jest.setSystemTime(GRACE_TIME);
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(true);
    });

    it('denies grace posting without an unlock or any prior contribution, even from the venue', async () => {
      jest.setSystemTime(GRACE_TIME);

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(result.reason).toContain('only if you already posted to this event');
    });

    it('falls back to a prior surviving post (pre-ledger uploads) and persists the anchor', async () => {
      jest.setSystemTime(GRACE_TIME);
      const priorCreatedAt = new Date(EVENT_DATE.getTime() + 60 * 60 * 1000);
      mockPostFindFirst.mockResolvedValue({ created_at: priorCreatedAt });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
      expect(mockPostFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            author_id: 'user-1',
            deleted_at: null,
            OR: [{ event_id: 'event-1' }, { game_id: 'game-1' }],
          }),
          orderBy: { created_at: 'asc' },
        })
      );
      // The fallback anchor is persisted with the ORIGINAL created_at so the
      // 7-day window never slides forward.
      expect(mockUnlockCreateMany).toHaveBeenCalledWith({
        data: [{ user_id: 'user-1', event_id: 'event-1', unlocked_at: priorCreatedAt }],
        skipDuplicates: true,
      });
    });

    it('a prior STORY also unlocks post uploads (stories and posts share the unlock)', async () => {
      jest.setSystemTime(GRACE_TIME);
      mockStoryFindFirst.mockResolvedValue({
        created_at: new Date(EVENT_DATE.getTime() + 60 * 60 * 1000),
      });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
      expect(mockStoryFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 'user-1', game_id: 'game-1' }),
        })
      );
    });

    it('event-only pages (no game) match prior posts by event_id only and never query stories', async () => {
      jest.setSystemTime(GRACE_TIME);
      mockEventFindUnique.mockResolvedValue({ ...BASE_EVENT, game_id: null });
      mockPostFindFirst.mockResolvedValue({ created_at: new Date(EVENT_DATE) });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
      expect(mockPostFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: [{ event_id: 'event-1' }] }),
        })
      );
      expect(mockStoryFindFirst).not.toHaveBeenCalled();
    });

    it('denies once the unlock is older than 7 days, even inside the grace window', async () => {
      // Unlock earned 1h before start (window opens -1h); exactly 7 days after
      // event start the personal week is up (anchor + 7d passed 1h ago), while
      // the event-level grace window (LIVE_CUTOFF + 7d) is still open.
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 7 * 24 * 60 * 60 * 1000));
      mockUnlockFindUnique.mockResolvedValue({
        unlocked_at: new Date(EVENT_DATE.getTime() - 60 * 60 * 1000),
      });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    });

    it('allows just before the grace window closes for a late unlock', async () => {
      jest.setSystemTime(new Date(GRACE_END.getTime() - 60 * 1000));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: LIVE_CUTOFF });

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
    });

    it('denies past the grace window boundary (+1ms) for everyone, without querying the ledger', async () => {
      jest.setSystemTime(new Date(GRACE_END.getTime() + 1));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: LIVE_CUTOFF });

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('stories', () => {
    const STORY_TIME = new Date('2026-05-10T23:00:00.000Z');

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

    it('a geofenced first story is allowed and grants the unlock', async () => {
      jest.setSystemTime(STORY_TIME);

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        VENUE.lat,
        VENUE.lon,
        null
      );

      expect(result.allowed).toBe(true);
      expect(mockUnlockCreateMany).toHaveBeenCalledWith({
        data: [{ user_id: 'user-1', event_id: 'event-1' }],
        skipDuplicates: true,
      });
    });

    it('still blocks a FIRST story from too far away', async () => {
      jest.setSystemTime(STORY_TIME);

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon,
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
    });

    it('still requires location for a FIRST story', async () => {
      jest.setSystemTime(STORY_TIME);

      const result = await verifyStoryPostingPermission('event-1', 'user-1', null, null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('LOCATION_REQUIRED');
    });

    it('allows an unlocked user to post a story with NO location (no re-geofence)', async () => {
      jest.setSystemTime(STORY_TIME);
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission('event-1', 'user-1', null, null, null);

      expect(result.allowed).toBe(true);
    });

    it('allows an unlocked user to post a story from far away', async () => {
      jest.setSystemTime(STORY_TIME);
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon,
        null
      );

      expect(result.allowed).toBe(true);
    });

    it('rejects stories when client coordinates conflict with network location (no unlock)', async () => {
      jest.setSystemTime(STORY_TIME);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ latitude: 34.0522, longitude: -118.2437 }),
      });

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        VENUE.lat,
        VENUE.lon,
        '8.8.8.8'
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('LOCATION_SPOOF_SUSPECTED');
    });

    it('the unlock overrides an IP mismatch — presence was already proven', async () => {
      jest.setSystemTime(STORY_TIME);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ latitude: 34.0522, longitude: -118.2437 }),
      });
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        VENUE.lat,
        VENUE.lon,
        '8.8.8.8'
      );

      expect(result.allowed).toBe(true);
    });

    it('the story window still bounds unlocked users — no stories after +48h', async () => {
      jest.setSystemTime(new Date('2026-05-12T18:00:01.000Z'));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission('event-1', 'user-1', null, null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    });
  });
});
