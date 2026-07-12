/**
 * One-off: remove seeded "NBA Finals" demo content (Knicks/Spurs) that carries
 * real pro-team + league trademarks. Matches by TITLE pattern (not hardcoded
 * ids) so it catches every such row on whichever DB it targets.
 *
 * IMPORTANT: target the LIVE primary DB (Postgres-TnGR / turntable.proxy), NOT
 * the backup (Postgres / ballast.proxy). The backup has a stale schema and is
 * not what the app reads.
 *
 * FK behavior: Post.game_id / Post.event_id are onDelete SetNull → user posts
 * SURVIVE (just unlinked). EventRsvp / GameVote / Poll* cascade. Whole delete
 * runs in one transaction; any unexpected constraint rolls it all back.
 *
 * DRY-RUN BY DEFAULT. Pass --apply to execute.
 *
 * Usage (LIVE db, dry-run then apply):
 *   cd server
 *   DATABASE_URL="$(railway variables --service Postgres-TnGR --json | jq -r .DATABASE_PUBLIC_URL)" npx tsx scripts/delete-nba-finals-demo.ts
 *   DATABASE_URL="$(railway variables --service Postgres-TnGR --json | jq -r .DATABASE_PUBLIC_URL)" npx tsx scripts/delete-nba-finals-demo.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const TITLE_PATTERN = '%NBA Finals%';
const TEAM_NAMES = ['San Antonio Spurs', 'New York Knicks'];

async function main() {
  console.log('[delete-nba-finals-demo] Mode:', APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)');
  console.log('[delete-nba-finals-demo] DB host:',
    (process.env.DATABASE_URL || '').replace(/^.*@/, '').replace(/\/.*$/, ''));

  const games = await prisma.game.findMany({
    where: { title: { contains: 'NBA Finals', mode: 'insensitive' } },
    select: { id: true, title: true },
  });
  const events = await prisma.event.findMany({
    where: { title: { contains: 'NBA Finals', mode: 'insensitive' } },
    select: { id: true, title: true },
  });
  const teams = await prisma.team.findMany({
    where: { name: { in: TEAM_NAMES } },
    select: { id: true, name: true },
  });
  const gameIds = games.map(g => g.id);
  const eventIds = events.map(e => e.id);
  const teamIds = teams.map(t => t.id);

  console.log(`\n  Games (${games.length}):`);
  games.forEach(g => console.log(`    - ${g.id}  ${g.title}`));
  console.log(`  Events (${events.length}):`);
  events.forEach(e => console.log(`    - ${e.id}  ${e.title}`));
  console.log(`  Teams (${teams.length}):`);
  teams.forEach(t => console.log(`    - ${t.id}  ${t.name}`));

  const linkedPosts = await prisma.post.count({ where: { game_id: { in: gameIds } } });
  console.log(`\n  User posts unlinked (SetNull), NOT deleted: ${linkedPosts}`);

  if (!APPLY) {
    console.log('\n[delete-nba-finals-demo] Dry-run — re-run with --apply to delete.');
    return;
  }

  await prisma.$transaction(async tx => {
    await tx.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await tx.teamFollow.deleteMany({ where: { team_id: { in: teamIds } } });
    await tx.teamInvite.deleteMany({ where: { team_id: { in: teamIds } } });
    await tx.game.deleteMany({ where: { id: { in: gameIds } } });
    await tx.event.deleteMany({ where: { id: { in: eventIds } } });
    await tx.team.deleteMany({ where: { id: { in: teamIds } } });
  });

  console.log(`\n[delete-nba-finals-demo] Done — removed ${games.length} games, ${events.length} events, ${teams.length} teams (posts preserved, unlinked).`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
