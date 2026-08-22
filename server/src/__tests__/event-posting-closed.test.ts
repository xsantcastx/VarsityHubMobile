/**
 * Moderation kill switch (posting_closed, 2026-08): a frozen event admits NO
 * non-admin upload — post OR story — regardless of the geofence, the 7-day
 * grace window, or any exclusive/designated-poster grant. Platform admins
 * bypass at the route level and never reach these functions, so the freeze
 * never blocks them. Reversible: clearing the flag restores normal logic.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockEventFindUnique = jest.fn();
const mockGameFindUnique = jest.fn();
const mockDesignatedFindUnique = jest.fn();
const mockUnlockFindFirst = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    event: { findUnique: mockEventFindUnique },
    game: { findUnique: mockGameFindUnique },
    eventDesignatedPoster: { findUnique: mockDesignatedFindUnique },
    eventPostingUnlock: { findFirst: mockUnlockFindFirst },
  },
}));

const { verifyEventPostingPermission, verifyStoryPostingPermission } =
  await import('../lib/geofencing.js');

const baseEvent = (over: Record<string, unknown>) => ({
  id: 'ev1',
  title: 'Match',
  date: new Date(), // live now by default
  latitude: 40,
  longitude: -74,
  location: 'Stadium',
  game_id: null,
  exclusive_poster_id: null,
  live_window_hours_after_start: null,
  posting_closed: false,
  ...over,
});

describe('posting_closed kill switch', () => {
  beforeEach(() => {
    mockEventFindUnique.mockReset();
    mockGameFindUnique.mockReset();
    mockDesignatedFindUnique.mockReset();
    mockUnlockFindFirst.mockReset();
    mockDesignatedFindUnique.mockResolvedValue(null);
    mockUnlockFindFirst.mockResolvedValue(null);
  });
  afterEach(() => jest.restoreAllMocks());

  it('blocks a POST at the venue during the live window when frozen', async () => {
    mockEventFindUnique.mockResolvedValue(baseEvent({ posting_closed: true }));
    const res = await verifyEventPostingPermission('ev1', 'fan', 40, -74);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('POSTING_CLOSED');
  });

  it('blocks a STORY at the venue during the live window when frozen', async () => {
    mockEventFindUnique.mockResolvedValue(baseEvent({ posting_closed: true }));
    const res = await verifyStoryPostingPermission('ev1', 'fan', 40, -74);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('POSTING_CLOSED');
  });

  it('beats a designated-poster grant (the freeze is absolute)', async () => {
    mockDesignatedFindUnique.mockResolvedValue({ id: 'grant', user_id: 'vip' });
    mockEventFindUnique.mockResolvedValue(baseEvent({ posting_closed: true }));
    const res = await verifyEventPostingPermission('ev1', 'vip', null, null);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('POSTING_CLOSED');
  });

  it('beats an exclusive-poster grant (the freeze is absolute)', async () => {
    mockEventFindUnique.mockResolvedValue(
      baseEvent({ posting_closed: true, exclusive_poster_id: 'vip' })
    );
    const res = await verifyEventPostingPermission('ev1', 'vip', 40, -74);
    expect(res.allowed).toBe(false);
    expect(res.code).toBe('POSTING_CLOSED');
  });

  it('reopening (posting_closed=false) restores normal live-window posting', async () => {
    mockEventFindUnique.mockResolvedValue(baseEvent({ posting_closed: false }));
    const res = await verifyEventPostingPermission('ev1', 'fan', 40, -74);
    expect(res.allowed).toBe(true);
  });
});
