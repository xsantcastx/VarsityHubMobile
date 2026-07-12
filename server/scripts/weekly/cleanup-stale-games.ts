/**
 * Weekly automation — deletes past MLB/WNBA games (and their linked Events)
 * once they're a few days old, so the auto-synced schedule doesn't grow
 * forever. Scoped ONLY to Event.linked_league IN ('MLB', 'WNBA') — never
 * touches Fanatics Fest, FIFA, Wimbledon, UFC, or any real user/team/org
 * content, which either use a different linked_league or none at all.
 *
 * Usage:
 *   npx tsx scripts/weekly/cleanup-stale-games.ts --dry-run
 *   npx tsx scripts/weekly/cleanup-stale-games.ts
 *
 * Requires DATABASE_URL in environment (or .env file).
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const STALE_LEAGUES = ['MLB', 'WNBA'];
const BUFFER_DAYS = 2; // keep games visible for a couple days after they're played

function parseArgs() {
  const args = process.argv.slice(2);
  return { dryRun: args.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs();
  const cutoff = new Date(Date.now() - BUFFER_DAYS * 24 * 60 * 60 * 1000);
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Cleaning up ${STALE_LEAGUES.join('/')} events older than ${cutoff.toISOString()}\n`
  );

  const staleEvents = await prisma.event.findMany({
    where: { linked_league: { in: STALE_LEAGUES }, date: { lt: cutoff } },
    select: { id: true, title: true, date: true, game_id: true },
  });
  console.log(`Found ${staleEvents.length} stale event(s)\n`);

  let deletedEvents = 0;
  let deletedGames = 0;
  for (const e of staleEvents) {
    if (dryRun) {
      console.log(`[dry-run] Would delete "${e.title}" (${e.date.toISOString()})`);
      continue;
    }
    await prisma.event.delete({ where: { id: e.id } });
    deletedEvents++;
    if (e.game_id) {
      await prisma.game.delete({ where: { id: e.game_id } }).catch(() => {});
      deletedGames++;
    }
  }

  console.log(`\n✅ Cleanup complete. deletedEvents=${deletedEvents} deletedGames=${deletedGames}\n`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
