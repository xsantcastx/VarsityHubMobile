import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEventFindUnique = jest.fn();
const mockGameFindUnique = jest.fn();
const mockPostFindFirst = jest.fn();
const mockStoryFindFirst = jest.fn();
const mockUnlockFindUnique = jest.fn();
const mockUnlockCreateMany = jest.fn();
const mockDesignatedFindUnique = jest.fn();

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
    eventDesignatedPoster: {
      findUnique: mockDesignatedFindUnique,
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
  exclusive_poster_id: null,
  live_window_hours_after_start: null as number | null,
};
const ALL_DAY_EVENT = { ...BASE_EVENT, live_window_hours_after_start: 12 };

// Venue is NYC; LA is ~3900 km away.
const VENUE = { lat: 40.7128, lon: -74.006 };
const FAR_AWAY = { lat: 34.0522, lon: -118.2437 };

describe('strict event posting window and geofence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockEventFindUnique.mockReset();
    mockGameFindUnique.mockReset();
    mockPostFindFirst.mockReset();
    mockStoryFindFirst.mockReset();
    mockUnlockFindUnique.mockReset();
    mockUnlockCreateMany.mockReset();
    mockDesignatedFindUnique.mockReset();
    global.fetch = jest.fn() as any;
    mockEventFindUnique.mockResolvedValue(BASE_EVENT);
    mockGameFindUnique.mockResolvedValue(null);
    mockPostFindFirst.mockResolvedValue(null);
    mockStoryFindFirst.mockResolvedValue(null);
    mockUnlockFindUnique.mockResolvedValue(null);
    mockUnlockCreateMany.mockResolvedValue({ count: 1 });
    mockDesignatedFindUnique.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('regular posts', () => {
    it('denies posting before the window opens more than 2 hours before start', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 2 * 60 * 60 * 1000 - 1));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('allows a geofenced upload exactly 2 hours before start', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 2 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('allows any geofenced upload during the standard window', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('closes the standard window 4 hours after start when there is no unlock', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 4 * 60 * 60 * 1000 + 1));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id_event_id: { user_id: 'user-1', event_id: 'event-1' } },
        })
      );
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('keeps uploads open through 12 hours when a coach chooses all-day', async () => {
      mockEventFindUnique.mockResolvedValue(ALL_DAY_EVENT);
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 11 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(true);
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('closes all-day uploads after the 12-hour window', async () => {
      mockEventFindUnique.mockResolvedValue(ALL_DAY_EVENT);
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 12 * 60 * 60 * 1000 + 1));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
    });

    it('still enforces the 3km geofence during the live window', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('still requires current device location during the live window', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('LOCATION_REQUIRED');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });

    it('keeps the live-window geofence strict even when the user has an unlock row', async () => {
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));
      const result = await verifyEventPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });

    it('allows regular posts after close when the user has a fresh 7-day unlock', async () => {
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 4 * 60 * 60 * 1000 + 1));

      const result = await verifyEventPostingPermission('event-1', 'user-1', null, null);

      expect(result.allowed).toBe(true);
      expect(mockUnlockFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id_event_id: { user_id: 'user-1', event_id: 'event-1' } },
        })
      );
    });

    it('denies regular posts after close when the 7-day unlock has expired', async () => {
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 8 * 24 * 60 * 60 * 1000));

      const result = await verifyEventPostingPermission('event-1', 'user-1', VENUE.lat, VENUE.lon);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).toHaveBeenCalled();
    });
  });

  describe('stories', () => {
    const STORY_TIME = new Date(EVENT_DATE.getTime() + 30 * 60 * 1000);

    it('uses the same standard window as posts', () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 2 * 60 * 60 * 1000 - 1));
      expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(false);

      jest.setSystemTime(new Date(EVENT_DATE.getTime() - 2 * 60 * 60 * 1000));
      expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(true);

      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 4 * 60 * 60 * 1000));
      expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(true);

      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 4 * 60 * 60 * 1000 + 1));
      expect(isStoryPostingWindowOpen(EVENT_DATE)).toBe(false);
    });

    it('honors the all-day 12-hour window', () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 11 * 60 * 60 * 1000));
      expect(isStoryPostingWindowOpen(EVENT_DATE, 12)).toBe(true);

      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 12 * 60 * 60 * 1000 + 1));
      expect(isStoryPostingWindowOpen(EVENT_DATE, 12)).toBe(false);
    });

    it('allows a story only when the user is at the venue during the window', async () => {
      jest.setSystemTime(STORY_TIME);

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        VENUE.lat,
        VENUE.lon,
        null
      );

      expect(result.allowed).toBe(true);
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
      expect(mockUnlockCreateMany).not.toHaveBeenCalled();
    });

    it('blocks stories from too far away', async () => {
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

    it('requires location for stories', async () => {
      jest.setSystemTime(STORY_TIME);

      const result = await verifyStoryPostingPermission('event-1', 'user-1', null, null, null);

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('LOCATION_REQUIRED');
    });

    it('does not let old unlock rows bypass the story geofence', async () => {
      jest.setSystemTime(STORY_TIME);
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        FAR_AWAY.lat,
        FAR_AWAY.lon,
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('TOO_FAR_FROM_VENUE');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });

    it('rejects stories when client coordinates conflict with network location', async () => {
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

    it('denies stories after the standard window closes even with an old unlock', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 4 * 60 * 60 * 1000 + 1));
      mockUnlockFindUnique.mockResolvedValue({ unlocked_at: new Date(EVENT_DATE) });

      const result = await verifyStoryPostingPermission(
        'event-1',
        'user-1',
        VENUE.lat,
        VENUE.lon,
        null
      );

      expect(result.allowed).toBe(false);
      expect(result.code).toBe('POSTING_WINDOW_CLOSED');
      expect(mockUnlockFindUnique).not.toHaveBeenCalled();
    });
  });

  describe('additive designated-poster grant', () => {
    it('keeps the explicit designated-poster admin grant independent from attendee access', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 2 * 60 * 60 * 1000));
      mockDesignatedFindUnique.mockResolvedValue({ user_id: 'nicon' });

      const result = await verifyEventPostingPermission('event-1', 'nicon', null, null);

      expect(result.allowed).toBe(true);
    });

    it('does not block other attendees during the live window', async () => {
      jest.setSystemTime(new Date(EVENT_DATE.getTime() + 30 * 60 * 1000));
      mockDesignatedFindUnique.mockResolvedValue(null);

      const result = await verifyEventPostingPermission(
        'event-1',
        'someone-else',
        VENUE.lat,
        VENUE.lon
      );

      expect(result.allowed).toBe(true);
    });
  });
});
