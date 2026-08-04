/**
 * Wipe the legacy auto-synced MLB/WNBA pro games — the parallel system being
 * retired in favor of the ProTeam pipeline (pro_external_ref + sport).
 *
 * Scope is SURGICAL: only Events tagged `linked_league IN ('MLB','WNBA')`, which
 * is exactly what scripts/{mlb,wnba}/sync-*-schedule.ts stamped. The ProTeam
 * pipeline's events carry `pro_external_ref` and a null `linked_league`, so they
 * are NEVER matched here. High-school / user games are untouched.
 *
 * DRY RUN by default. Pass --apply to delete.
 *   cd server && npx tsx scripts/wipe-synced-pro-games.ts            # dry run
 *   cd server && npx tsx scripts/wipe-synced-pro-games.ts --apply    # delete
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SYNCED_LEAGUES = ['MLB', 'WNBA'];
const apply = process.argv.includes('--apply');

async function main() {
  console.log(
    `${apply ? 'APPLY' : '[dry-run]'} wiping synced pro games (Event.linked_league IN ${SYNCED_LEAGUES.join('/')})\n`
  );

  const events = await prisma.event.findMany({
    where: { linked_league: { in: SYNCED_LEAGUES }, pro_external_ref: null },
    select: { id: true, title: true, date: true, game_id: true },
    take: 100000,
  });
  const eventIds = events.map(e => e.id);
  const gameIds = events.map(e => e.game_id).filter((g): g is string => !!g);
  console.log(`Found ${events.length} synced events, ${gameIds.length} linked games`);

  if (!apply) {
    for (const e of events.slice(0, 20)) console.log(`  [dry-run] would delete "${e.title}"`);
    if (events.length > 20) console.log(`  … and ${events.length - 20} more`);
    console.log('\n[dry-run] nothing deleted. Re-run with --apply.');
    return;
  }

  // Dependents first (best-effort; a missing table/relation must not abort the wipe).
  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    try {
      const r = await fn();
      console.log(`  deleted ${r.count} ${label}`);
    } catch (err) {
      console.warn(`  skip ${label}: ${err instanceof Error ? err.message : err}`);
    }
  };
  if (gameIds.length) {
    await del('stories', () => prisma.story.deleteMany({ where: { game_id: { in: gameIds } } }));
    await del('game posts', () => prisma.post.deleteMany({ where: { game_id: { in: gameIds } } }));
    await del('game votes', () =>
      prisma.gameVote.deleteMany({ where: { game_id: { in: gameIds } } })
    );
  }
  await del('event posts', () => prisma.post.deleteMany({ where: { event_id: { in: eventIds } } }));
  await del('event RSVPs', () =>
    prisma.eventRsvp.deleteMany({ where: { event_id: { in: eventIds } } })
  );

  const eventResult = await prisma.event.deleteMany({ where: { id: { in: eventIds } } });
  const gameResult = gameIds.length
    ? await prisma.game.deleteMany({ where: { id: { in: gameIds } } })
    : { count: 0 };

  console.log(`\n✅ Wipe complete. events=${eventResult.count} games=${gameResult.count}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
