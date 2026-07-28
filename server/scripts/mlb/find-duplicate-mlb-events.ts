/**
 * MLB duplicate DIAGNOSTIC — READ ONLY. Makes no writes.
 *
 * Lists every MLB matchup that has more than one Game (and/or Event) row on the
 * same calendar day. This is the fallout of the old exact-timestamp dedup key:
 * MLB firms up first-pitch times between syncs, so each run created a fresh
 * duplicate. The sync now dedups on title + a ±12h window, so this only reports
 * the backlog that already exists — run `clean-duplicate-mlb-events.ts` to
 * remove it.
 *
 * Usage:
 *   npx tsx scripts/mlb/find-duplicate-mlb-events.ts
 *
 * Requires DATABASE_URL in environment (or .env file). Point it at PROD to see
 * the prod backlog.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

/** UTC calendar-day key, e.g. "2026-07-16". */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function reportDuplicates(
  kind: 'game' | 'event',
  rows: { id: string; title: string | null; date: Date | null; created_at?: Date | null }[]
) {
  // Group by title + UTC day. Only MLB rows are considered by the caller.
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.title || !r.date) continue;
    const key = `${r.title}__${dayKey(r.date)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const dupGroups = [...groups.entries()].filter(([, list]) => list.length > 1);
  const totalExtra = dupGroups.reduce((sum, [, list]) => sum + (list.length - 1), 0);

  console.log(`\n=== ${kind.toUpperCase()} duplicates ===`);
  if (dupGroups.length === 0) {
    console.log(`  none — every ${kind} matchup is unique per day ✅`);
    return { groups: 0, extra: 0 };
  }
  console.log(
    `  ${dupGroups.length} duplicated matchups, ${totalExtra} extra ${kind} rows to remove:\n`
  );
  for (const [key, list] of dupGroups.sort((a, b) => b[1].length - a[1].length)) {
    const [title, day] = key.split('__');
    console.log(`  • "${title}" on ${day} — ${list.length} copies:`);
    for (const r of list.sort(
      (a, b) => (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0)
    )) {
      console.log(
        `      id=${r.id}  date=${r.date?.toISOString()}  created=${r.created_at?.toISOString() ?? '?'}`
      );
    }
  }
  return { groups: dupGroups.length, extra: totalExtra };
}

async function main() {
  // MLB rows are the linked_league='MLB' events + the games they point at, plus
  // any game that looks like an MLB matchup (event_type 'game', "X at Y" title,
  // no organization). We scope to linked_league='MLB' on events and the games
  // referenced by MLB events + games created by the MLB admin, to avoid touching
  // real user games.
  const mlbEvents = await prisma.event.findMany({
    where: { linked_league: 'MLB' },
    select: { id: true, title: true, date: true, created_at: true, game_id: true },
    orderBy: { created_at: 'asc' },
    take: 10000,
  });
  const gameIds = [...new Set(mlbEvents.map(e => e.game_id).filter((x): x is string => !!x))];
  const mlbGames = await prisma.game.findMany({
    where: { id: { in: gameIds } },
    select: { id: true, title: true, date: true, created_at: true },
    orderBy: { created_at: 'asc' },
    take: 10000,
  });

  console.log(`Scanned ${mlbEvents.length} MLB events and ${mlbGames.length} linked games.`);
  const g = await reportDuplicates('game', mlbGames);
  const e = await reportDuplicates('event', mlbEvents);

  console.log(
    `\nSUMMARY: ${g.extra} extra games + ${e.extra} extra events would be removed by the cleanup.\n`
  );
}

main()
  .catch(err => {
    console.error('[find-duplicate-mlb-events] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
