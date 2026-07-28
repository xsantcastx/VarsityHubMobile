/**
 * MLB duplicate CLEANUP. Dry-run by default — pass --apply to write.
 *
 * For each MLB matchup with more than one Game/Event on the same UTC day, keeps
 * the EARLIEST-created Game + Event and removes the extras. Run
 * `find-duplicate-mlb-events.ts` first to preview the backlog. The sync's dedup
 * key is now a ±12h window, so once this clears the backlog duplicates should
 * not come back.
 *
 * Safety:
 *   - Dry-run unless --apply is passed (prints exactly what it WOULD delete).
 *   - Each matchup group is cleaned in its own transaction — if any delete in a
 *     group is FK-blocked (e.g. a user RSVP/post references the row), that whole
 *     group rolls back and is reported for manual review; other groups proceed.
 *   - Never deletes the kept (earliest) row.
 *
 * Usage:
 *   npx tsx scripts/mlb/clean-duplicate-mlb-events.ts            # dry-run preview
 *   npx tsx scripts/mlb/clean-duplicate-mlb-events.ts --apply    # actually delete
 *
 * Requires DATABASE_URL in environment (or .env file). Point it at PROD to
 * clean the prod backlog — run the dry-run first and eyeball it.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type Row = { id: string; title: string | null; date: Date | null; created_at: Date | null };

/** Group MLB rows by title + UTC day; return only the duplicated groups. */
function duplicateGroups(rows: Row[]): { key: string; rows: Row[] }[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.title || !r.date) continue;
    const key = `${r.title}__${dayKey(r.date)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      rows: list.sort((a, b) => (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0)),
    }));
}

async function main() {
  console.log(APPLY ? '⚠️  APPLY mode — deletions WILL be written.\n' : 'Dry-run (no writes).\n');

  const mlbEvents = (await prisma.event.findMany({
    where: { linked_league: 'MLB' },
    select: { id: true, title: true, date: true, created_at: true, game_id: true },
    orderBy: { created_at: 'asc' },
    take: 10000,
  })) as (Row & { game_id: string | null })[];

  const gameIds = [...new Set(mlbEvents.map(e => e.game_id).filter((x): x is string => !!x))];
  const mlbGames = (await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, title: true, date: true, created_at: true },
    orderBy: { created_at: 'asc' },
    take: 10000,
  })) as Row[];

  // Group events and games independently, then clean per matchup.
  const eventGroups = duplicateGroups(mlbEvents);
  const gameGroups = duplicateGroups(mlbGames);
  const allKeys = new Set([...eventGroups.map(g => g.key), ...gameGroups.map(g => g.key)]);

  let removedEvents = 0;
  let removedGames = 0;
  let skipped = 0;

  for (const key of allKeys) {
    const events = eventGroups.find(g => g.key === key)?.rows ?? [];
    const games = gameGroups.find(g => g.key === key)?.rows ?? [];
    const keptGameId = games[0]?.id;
    const keptEventId = events[0]?.id;
    const dropEvents = events.slice(1).map(e => e.id);
    const dropGames = games.slice(1).map(g => g.id);
    if (dropEvents.length === 0 && dropGames.length === 0) continue;

    const [title, day] = key.split('__');
    console.log(
      `• "${title}" ${day}: keep game=${keptGameId ?? '—'} event=${keptEventId ?? '—'}; ` +
        `drop ${dropEvents.length} event(s) + ${dropGames.length} game(s)`
    );

    if (!APPLY) continue;

    try {
      await prisma.$transaction(async tx => {
        // Repoint the kept event at the kept game so dropping the other games
        // never orphans it.
        if (keptEventId && keptGameId) {
          await tx.event.update({ where: { id: keptEventId }, data: { game_id: keptGameId } });
        }
        if (dropEvents.length) await tx.event.deleteMany({ where: { id: { in: dropEvents } } });
        if (dropGames.length) await tx.game.deleteMany({ where: { id: { in: dropGames } } });
      });
      removedEvents += dropEvents.length;
      removedGames += dropGames.length;
    } catch (err: any) {
      skipped++;
      console.warn(
        `    ↳ SKIPPED (rolled back) — ${err?.code ?? ''} ${err?.message ?? err}. ` +
          `Likely a user row (RSVP/post) references a duplicate; handle manually.`
      );
    }
  }

  console.log(
    `\n${APPLY ? 'Removed' : 'Would remove'}: ${removedGames || (APPLY ? 0 : gameGroups.reduce((s, g) => s + g.rows.length - 1, 0))} games, ` +
      `${removedEvents || (APPLY ? 0 : eventGroups.reduce((s, g) => s + g.rows.length - 1, 0))} events` +
      (APPLY ? `. Skipped groups: ${skipped}.` : ' (dry-run — pass --apply to execute).')
  );
}

main()
  .catch(err => {
    console.error('[clean-duplicate-mlb-events] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
