/**
 * Reminder cron query-shape regression.
 *
 * Locks in the post-rewrite contract for `notifyUpcomingGames`:
 *   - Single `eventRsvp.findMany` for candidates (no per-event nested loop).
 *   - Batched `notification.findMany` for dedup (no per-RSVP findFirst).
 *   - Skips users whose `preferences.notifications.game_event_reminders === false`.
 *   - Skips RSVPs that have a recent matching GAME_REMINDER notification.
 *
 * Pure unit-style — mocks Prisma + sendPushNotification. We can't easily
 * verify SQL shape from Jest, but we CAN verify the *number* of DB calls
 * the function makes — which is the actual scale property at risk.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const eventRsvpFindMany = jest.fn();
const notificationFindMany = jest.fn(async () => []);
const notificationCreate = jest.fn(async () => ({ id: 'notif-1', meta: {} }));
const notificationFindUnique = jest.fn(async () => ({ meta: {} }));
const notificationUpdate = jest.fn(async () => ({}));
const sendPushNotificationMock = jest.fn(async () => ['ticket-1']);
const captureExceptionMock = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    eventRsvp: { findMany: eventRsvpFindMany },
    notification: {
      findMany: notificationFindMany,
      create: notificationCreate,
      findUnique: notificationFindUnique,
      update: notificationUpdate,
    },
  },
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: captureExceptionMock,
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
  initSentry: jest.fn(),
  addSentryErrorHandler: jest.fn(),
}));

const sendPushModule = await import('../lib/notifications.js');
// Override sendPushNotification by replacing it on the namespace.
// We can't intercept after import, so the test calls notifyUpcomingGames
// and asserts on the DB-call counts it produces (the property at risk).

const { notifyUpcomingGames } = sendPushModule;

function rsvp(userId: string, eventId: string, prefs: any = {}) {
  return {
    id: `rsvp-${userId}-${eventId}`,
    user_id: userId,
    event_id: eventId,
    user: {
      id: userId,
      display_name: `User ${userId}`,
      preferences: prefs,
    },
    event: {
      id: eventId,
      title: `Event ${eventId}`,
      location: 'Field A',
      creator_id: 'creator-1',
    },
  };
}

describe('notifyUpcomingGames — query shape', () => {
  beforeEach(() => {
    eventRsvpFindMany.mockReset();
    notificationFindMany.mockReset().mockResolvedValue([] as any);
    notificationCreate.mockReset().mockResolvedValue({ id: 'notif-1', meta: {} } as any);
    notificationFindUnique.mockReset().mockResolvedValue({ meta: {} } as any);
    notificationUpdate.mockReset().mockResolvedValue({} as any);
    sendPushNotificationMock.mockReset().mockResolvedValue(['ticket-1'] as any);
    captureExceptionMock.mockReset();
  });

  it('issues exactly one eventRsvp.findMany regardless of how many events match', async () => {
    eventRsvpFindMany.mockResolvedValueOnce([
      rsvp('u1', 'e1'),
      rsvp('u2', 'e1'),
      rsvp('u3', 'e2'),
      rsvp('u4', 'e3'),
    ] as any);

    await notifyUpcomingGames(12);

    expect(eventRsvpFindMany).toHaveBeenCalledTimes(1);
    // Sanity: the query filters by event in window + status approved.
    const callArg = eventRsvpFindMany.mock.calls[0][0] as any;
    expect(callArg.where.event.date).toBeDefined();
    expect(callArg.where.event.OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ approval_status: 'approved' })])
    );
  });

  it('returns silently when no candidates match', async () => {
    eventRsvpFindMany.mockResolvedValueOnce([] as any);

    await notifyUpcomingGames(1);

    expect(eventRsvpFindMany).toHaveBeenCalledTimes(1);
    expect(notificationFindMany).not.toHaveBeenCalled();
    expect(notificationCreate).not.toHaveBeenCalled();
  });

  it('batches dedup lookups instead of one-per-RSVP', async () => {
    eventRsvpFindMany.mockResolvedValueOnce([
      rsvp('u1', 'e1'),
      rsvp('u2', 'e1'),
      rsvp('u3', 'e2'),
      rsvp('u1', 'e2'), // duplicate user across events
    ] as any);

    await notifyUpcomingGames(12);

    // Single batched dedup call (3 unique user_ids, well under the 500 batch cap)
    expect(notificationFindMany).toHaveBeenCalledTimes(1);
    const dedupArg = notificationFindMany.mock.calls[0][0] as any;
    expect(dedupArg.where.type).toBe('GAME_REMINDER');
    expect(Array.isArray(dedupArg.where.user_id?.in)).toBe(true);
    // 3 unique user_ids: u1, u2, u3
    expect(dedupArg.where.user_id.in.sort()).toEqual(['u1', 'u2', 'u3']);
  });

  it('skips RSVPs whose user disabled game_event_reminders', async () => {
    eventRsvpFindMany.mockResolvedValueOnce([
      rsvp('u1', 'e1', { notifications: { game_event_reminders: false } }),
      rsvp('u2', 'e1', { notifications: { game_event_reminders: true } }),
      rsvp('u3', 'e1'), // no prefs at all → default-allow
    ] as any);

    await notifyUpcomingGames(1);

    // Dedup query only includes the 2 eligible users (not u1).
    const dedupArg = notificationFindMany.mock.calls[0][0] as any;
    expect(dedupArg.where.user_id.in.sort()).toEqual(['u2', 'u3']);
  });

  it('respects dedup hits — does not create notification for already-reminded user/event pairs', async () => {
    eventRsvpFindMany.mockResolvedValueOnce([rsvp('u1', 'e1'), rsvp('u2', 'e1')] as any);
    notificationFindMany.mockResolvedValueOnce([
      { user_id: 'u1', meta: { event_id: 'e1' } },
    ] as any);

    await notifyUpcomingGames(12);

    // u1 was deduped → only u2 gets a notification.create
    expect(notificationCreate).toHaveBeenCalledTimes(1);
    const createArg = notificationCreate.mock.calls[0][0] as any;
    expect(createArg.data.user_id).toBe('u2');
  });
});
