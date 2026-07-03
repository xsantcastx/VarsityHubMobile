/**
 * One-time backfill: denormalize the post <-> event/game link for EXISTING rows.
 *
 * New posts carry both game_id and event_id (POST /posts denormalizes at write).
 * This fills the missing half for historical rows so game-keyed and event-keyed
 * reads are symmetric everywhere:
 *   - post has game_id, no event_id -> set event_id from the game's primary event
 *   - post has event_id, no game_id -> set game_id from the event's game
 *
 * Dry-run by default. Pass --apply to write. Safe to re-run (idempotent — only
 * touches rows still missing the derivable half).
 *
 *   npx tsx scripts/backfill-post-event-links.ts            # dry run
 *   npx tsx scripts/backfill-post-event-links.ts --apply    # write
 *
 * NOT wired into start.sh — run manually against a target DB.
 */
import { prisma } from '../src/lib/prisma.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;

async function backfillEventIdFromGame(): Promise<{ scanned: number; filled: number }> {
  let scanned = 0;
  let filled = 0;
  let cursor: string | null = null;

  for (;;) {
    const rows: Array<{ id: string; game_id: string | null }> = await prisma.post.findMany({
      where: { game_id: { not: null }, event_id: null },
      select: { id: true, game_id: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    // Resolve each game's primary (earliest) event once.
    const gameIds = [...new Set(rows.map(r => r.game_id).filter(Boolean) as string[])];
    const games = await prisma.game.findMany({
      where: { id: { in: gameIds } },
      select: { id: true, events: { orderBy: { date: 'asc' }, take: 1, select: { id: true } } },
    });
    const eventByGame = new Map(games.map(g => [g.id, g.events[0]?.id ?? null]));

    for (const row of rows) {
      const eventId = row.game_id ? eventByGame.get(row.game_id) : null;
      if (!eventId) continue; // game has no event — nothing to denormalize
      filled++;
      if (APPLY) {
        await prisma.post.update({ where: { id: row.id }, data: { event_id: eventId } });
      }
    }
  }
  return { scanned, filled };
}

async function backfillGameIdFromEvent(): Promise<{ scanned: number; filled: number }> {
  let scanned = 0;
  let filled = 0;
  let cursor: string | null = null;

  for (;;) {
    const rows: Array<{ id: string; event_id: string | null }> = await prisma.post.findMany({
      where: { event_id: { not: null }, game_id: null },
      select: { id: true, event_id: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    const eventIds = [...new Set(rows.map(r => r.event_id).filter(Boolean) as string[])];
    const events = await prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, game_id: true },
    });
    const gameByEvent = new Map(events.map(e => [e.id, e.game_id ?? null]));

    for (const row of rows) {
      const gameId = row.event_id ? gameByEvent.get(row.event_id) : null;
      if (!gameId) continue; // event-only post — game_id legitimately stays null
      filled++;
      if (APPLY) {
        await prisma.post.update({ where: { id: row.id }, data: { game_id: gameId } });
      }
    }
  }
  return { scanned, filled };
}

async function main() {
  console.log(
    `\nPost<->event link backfill — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`
  );

  const a = await backfillEventIdFromGame();
  console.log(
    `game_id -> event_id : scanned ${a.scanned}, ${APPLY ? 'filled' : 'would fill'} ${a.filled}`
  );

  const b = await backfillGameIdFromEvent();
  console.log(
    `event_id -> game_id : scanned ${b.scanned}, ${APPLY ? 'filled' : 'would fill'} ${b.filled}`
  );

  console.log(
    `\nDone. ${APPLY ? 'Rows updated' : 'Re-run with --apply to write'}: ${a.filled + b.filled}\n`
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async err => {
  console.error('[backfill-post-event-links] failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
