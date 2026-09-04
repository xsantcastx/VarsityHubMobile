import { describe, expect, it, jest } from '@jest/globals';
import { grantEventPostAccess, revokeEventPostAccess } from '../lib/eventPostAccess.js';
import { EVENT_POSTING_UNLOCK_DURATION_MS } from '../lib/geofencing.js';

function makeDb(overrides: any = {}) {
  return {
    event: {
      findUnique: jest.fn(async () => ({ id: 'evt1', title: 'Giants at Jets' })),
    },
    user: {
      findUnique: jest.fn(async () => ({ id: 'user1', username: 'superfan' })),
    },
    eventPostingUnlock: {
      upsert: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    eventDesignatedPoster: {
      upsert: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    ...overrides,
  } as any;
}

describe('grantEventPostAccess', () => {
  it('writes the unlock ledger and designated-poster rows in one transaction', async () => {
    const db = makeDb();
    const unlockedAt = new Date('2026-08-28T18:00:00.000Z');

    const outcome = await grantEventPostAccess(db, {
      eventId: 'evt1',
      userId: 'user1',
      grantedBy: 'admin1',
      unlockedAt,
    });

    expect(outcome.ok).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.eventPostingUnlock.upsert).toHaveBeenCalledWith({
      where: { user_id_event_id: { user_id: 'user1', event_id: 'evt1' } },
      create: { user_id: 'user1', event_id: 'evt1', unlocked_at: unlockedAt },
      update: { unlocked_at: unlockedAt },
    });
    expect(db.eventDesignatedPoster.upsert).toHaveBeenCalledWith({
      where: { event_id_user_id: { event_id: 'evt1', user_id: 'user1' } },
      create: { event_id: 'evt1', user_id: 'user1', created_by: 'admin1' },
      update: {},
    });
    if (outcome.ok) {
      expect(outcome.expiresAt.getTime()).toBe(
        unlockedAt.getTime() + EVENT_POSTING_UNLOCK_DURATION_MS
      );
      expect(outcome.event).toEqual({ id: 'evt1', title: 'Giants at Jets' });
    }
  });

  it('defaults the unlock anchor to now when none is given', async () => {
    const db = makeDb();
    const before = Date.now();
    const outcome = await grantEventPostAccess(db, { eventId: 'evt1', userId: 'user1' });
    const after = Date.now();
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.unlockedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(outcome.unlockedAt.getTime()).toBeLessThanOrEqual(after);
    }
    // No grantor recorded when the caller omits it.
    expect(db.eventDesignatedPoster.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ created_by: null }),
      })
    );
  });

  it('fails closed with no writes when the event does not exist', async () => {
    const db = makeDb({ event: { findUnique: jest.fn(async () => null) } });
    const outcome = await grantEventPostAccess(db, { eventId: 'missing', userId: 'user1' });
    expect(outcome).toEqual({ ok: false, reason: 'event_not_found' });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.eventPostingUnlock.upsert).not.toHaveBeenCalled();
  });

  it('fails closed with no writes when the user does not exist', async () => {
    const db = makeDb({ user: { findUnique: jest.fn(async () => null) } });
    const outcome = await grantEventPostAccess(db, { eventId: 'evt1', userId: 'missing' });
    expect(outcome).toEqual({ ok: false, reason: 'user_not_found' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe('revokeEventPostAccess', () => {
  it('deletes both access rows in one transaction', async () => {
    const db = makeDb();
    const outcome = await revokeEventPostAccess(db, { eventId: 'evt1', userId: 'user1' });
    expect(outcome.ok).toBe(true);
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(db.eventPostingUnlock.deleteMany).toHaveBeenCalledWith({
      where: { user_id: 'user1', event_id: 'evt1' },
    });
    expect(db.eventDesignatedPoster.deleteMany).toHaveBeenCalledWith({
      where: { event_id: 'evt1', user_id: 'user1' },
    });
  });

  it('fails closed when the target is missing', async () => {
    const db = makeDb({ user: { findUnique: jest.fn(async () => null) } });
    const outcome = await revokeEventPostAccess(db, { eventId: 'evt1', userId: 'missing' });
    expect(outcome).toEqual({ ok: false, reason: 'user_not_found' });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
