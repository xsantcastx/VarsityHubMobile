import type { PrismaClient } from '@prisma/client';
import { EVENT_POSTING_UNLOCK_DURATION_MS } from './geofencing.js';

/**
 * Grant / revoke a user's manual post + story access to a specific event page.
 *
 * This is the repeatable, audited version of the `grant-event-post-access`
 * one-off script (owner note 2026-09: "one of one case that may be used again").
 * It writes the same two rows the discovery/geofencing layer reads:
 *   - EventPostingUnlock  — the durable access ledger verifyEventPostingPermission
 *     checks after the live posting window closes (7-day window from unlocked_at).
 *   - EventDesignatedPoster — pairs with the unlock so the same user can also add
 *     stories for that window.
 * Both are written in one transaction and are idempotent (upsert), so re-granting
 * simply refreshes the window.
 *
 * The route layer (admin.ts) owns auth (platform admin) and the audit-log row;
 * this module owns the data write only, and takes `db` so it can be unit-tested
 * against a mock the same way eventDiscovery.ts is.
 */

type Db = Pick<
  PrismaClient,
  'event' | 'user' | 'eventPostingUnlock' | 'eventDesignatedPoster' | '$transaction'
>;

export type EventPostAccessTargets = {
  event: { id: string; title: string };
  user: { id: string; username: string | null };
};

export type EventPostAccessOutcome =
  | ({ ok: true; unlockedAt: Date; expiresAt: Date } & EventPostAccessTargets)
  | { ok: false; reason: 'event_not_found' | 'user_not_found' };

export type EventPostAccessRevokeOutcome =
  | ({ ok: true } & EventPostAccessTargets)
  | { ok: false; reason: 'event_not_found' | 'user_not_found' };

async function resolveTargets(
  db: Db,
  eventId: string,
  userId: string
): Promise<EventPostAccessTargets | { reason: 'event_not_found' | 'user_not_found' }> {
  const [event, user] = await Promise.all([
    db.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } }),
    db.user.findUnique({ where: { id: userId }, select: { id: true, username: true } }),
  ]);
  if (!event) return { reason: 'event_not_found' };
  if (!user) return { reason: 'user_not_found' };
  return { event, user };
}

export async function grantEventPostAccess(
  db: Db,
  params: { eventId: string; userId: string; grantedBy?: string | null; unlockedAt?: Date }
): Promise<EventPostAccessOutcome> {
  const unlockedAt = params.unlockedAt ?? new Date();
  const targets = await resolveTargets(db, params.eventId, params.userId);
  if ('reason' in targets) return { ok: false, reason: targets.reason };

  await db.$transaction([
    db.eventPostingUnlock.upsert({
      where: { user_id_event_id: { user_id: params.userId, event_id: params.eventId } },
      create: { user_id: params.userId, event_id: params.eventId, unlocked_at: unlockedAt },
      update: { unlocked_at: unlockedAt },
    }),
    db.eventDesignatedPoster.upsert({
      where: { event_id_user_id: { event_id: params.eventId, user_id: params.userId } },
      create: {
        event_id: params.eventId,
        user_id: params.userId,
        created_by: params.grantedBy ?? null,
      },
      // Keep the original grantor on a re-grant; only the unlock window refreshes.
      update: {},
    }),
  ]);

  return {
    ok: true,
    ...targets,
    unlockedAt,
    expiresAt: new Date(unlockedAt.getTime() + EVENT_POSTING_UNLOCK_DURATION_MS),
  };
}

export async function revokeEventPostAccess(
  db: Db,
  params: { eventId: string; userId: string }
): Promise<EventPostAccessRevokeOutcome> {
  const targets = await resolveTargets(db, params.eventId, params.userId);
  if ('reason' in targets) return { ok: false, reason: targets.reason };

  await db.$transaction([
    db.eventPostingUnlock.deleteMany({
      where: { user_id: params.userId, event_id: params.eventId },
    }),
    db.eventDesignatedPoster.deleteMany({
      where: { event_id: params.eventId, user_id: params.userId },
    }),
  ]);

  return { ok: true, ...targets };
}
