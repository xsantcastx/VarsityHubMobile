import { prisma } from './prisma.js';

/**
 * Minimum age before an empty event may be soft-archived.
 *
 * The upload window closes at (event.date + live-window + 7-day grace). The live
 * window's after-start bound is 3h by default and at most 18h (fest days), so
 * the latest possible close is date + ~7.75 days. 8 days clears that with a
 * buffer, so we never archive an event a user could still post a recap to.
 */
export const EVENT_CLEANUP_MIN_AGE_MS = 8 * 24 * 60 * 60 * 1000;

/** Hard cap per run so one pass can never scan/patch an unbounded set. */
const EVENT_CLEANUP_BATCH = 1000;

/**
 * Reversibly soft-archive events that are past their full 7-day upload window
 * AND never received a post. Owner rule (2026-08): "you don't have to keep
 * events that don't end up getting posts on them, but only remove them after
 * the 7-day window."
 *
 * Posts are the only engagement signal (RSVPs do NOT save an event). Archiving
 * sets `archived_at` — it deletes nothing, so RSVP / unlock history survives and
 * the row can be restored by nulling the column. Archived events drop out of the
 * public /events list (map, feed, date-lens).
 *
 * Eligibility (all must hold):
 *  - `date` older than EVENT_CLEANUP_MIN_AGE_MS (window fully closed)
 *  - not already archived, not cancelled
 *  - no linked posts (by event_id); for a game-linked event, its game also has
 *    no posts — recaps denormalize event_id, but this double-guards the game side
 *  - not a pro/seeded fixture (auto-reingested — archiving would just fight it)
 *  - not a `sample-` demo row
 *
 * Bounded + idempotent: already-archived rows are excluded, so re-runs are a
 * no-op, and each pass patches at most EVENT_CLEANUP_BATCH rows.
 */
export async function archiveEmptyExpiredEvents(
  now: Date = new Date(),
  take: number = EVENT_CLEANUP_BATCH
): Promise<number> {
  const cutoff = new Date(now.getTime() - EVENT_CLEANUP_MIN_AGE_MS);

  // Relation filters (`posts: { none }`) are valid in findMany but not
  // updateMany, so select ids first, then patch by id.
  const candidates = await prisma.event.findMany({
    where: {
      archived_at: null,
      status: { not: 'cancelled' },
      date: { lt: cutoff },
      // No post ever landed on the event page (event_id link).
      posts: { none: {} },
      // Never touch auto-managed pro/seeded fixtures.
      pro_home_team_id: null,
      pro_away_team_id: null,
      pro_external_ref: null,
      // Skip demo rows.
      NOT: { id: { startsWith: 'sample-' } },
      // Standalone events qualify outright; game-linked ones only when the
      // linked game also has no posts (recaps carry game_id).
      OR: [{ game_id: null }, { game: { is: { posts: { none: {} } } } }],
    },
    select: { id: true },
    take,
  });

  if (candidates.length === 0) return 0;

  const result = await prisma.event.updateMany({
    where: { id: { in: candidates.map(c => c.id) } },
    data: { archived_at: now },
  });
  return result.count;
}
