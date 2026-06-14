/**
 * One-off: rename the FIFA World Cup 2026 team "Côte d'Ivoire" → "Ivory Coast"
 * across already-seeded rows. The seed source (worldcup-2026.data.ts) has been
 * updated, but existing DB records keep the old display name, so this backfills
 * them. Idempotent — safe to re-run; rows already showing the new name are
 * skipped.
 *
 * Touches every place the string was persisted:
 *   Team.name | Game.title/home_team/away_team | Event.title/description | GameVote.team
 *
 * Usage:
 *   npx tsx scripts/fifa/rename-cote-divoire.ts --dry-run    # print plan, write nothing
 *   npx tsx scripts/fifa/rename-cote-divoire.ts              # apply
 *
 * Requires DATABASE_URL in environment (or .env file). For production:
 *   DATABASE_URL="$(railway variables --json | jq -r .DATABASE_PUBLIC_URL)" \
 *     npx tsx scripts/fifa/rename-cote-divoire.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const OLD = "Côte d'Ivoire";
const NEW = 'Ivory Coast';

const dryRun = process.argv.slice(2).includes('--dry-run');
const tag = dryRun ? '[dry-run] ' : '';

function replaceAll(value: string): string {
  return value.split(OLD).join(NEW);
}

async function main() {
  console.log(`${tag}Renaming "${OLD}" → "${NEW}"\n`);

  // 1. Teams — exact name match.
  const teams = await prisma.team.findMany({
    where: { name: OLD },
    select: { id: true },
    take: 100,
  });
  console.log(`Teams: ${teams.length} to rename`);
  if (!dryRun && teams.length) {
    await prisma.team.updateMany({ where: { name: OLD }, data: { name: NEW } });
  }

  // 2. Games — exact home_team/away_team, substring in title.
  const games = await prisma.game.findMany({
    where: {
      OR: [{ home_team: OLD }, { away_team: OLD }, { title: { contains: OLD } }],
    },
    select: { id: true, title: true, home_team: true, away_team: true },
    take: 200,
  });
  console.log(`Games: ${games.length} to update`);
  for (const g of games) {
    console.log(`   - "${g.title}" (${g.id})`);
    if (dryRun) continue;
    await prisma.game.update({
      where: { id: g.id },
      data: {
        title: replaceAll(g.title),
        ...(g.home_team === OLD ? { home_team: NEW } : {}),
        ...(g.away_team === OLD ? { away_team: NEW } : {}),
      },
    });
  }

  // 3. Events — substring in title and description.
  const events = await prisma.event.findMany({
    where: { OR: [{ title: { contains: OLD } }, { description: { contains: OLD } }] },
    select: { id: true, title: true, description: true },
    take: 200,
  });
  console.log(`Events: ${events.length} to update`);
  for (const e of events) {
    console.log(`   - "${e.title}" (${e.id})`);
    if (dryRun) continue;
    await prisma.event.update({
      where: { id: e.id },
      data: {
        title: replaceAll(e.title),
        ...(e.description ? { description: replaceAll(e.description) } : {}),
      },
    });
  }

  // 4. GameVotes — exact team string, so tallies still match the renamed team.
  const votes = await prisma.gameVote.count({ where: { team: OLD } });
  console.log(`GameVotes: ${votes} to update`);
  if (!dryRun && votes) {
    await prisma.gameVote.updateMany({ where: { team: OLD }, data: { team: NEW } });
  }

  console.log(`\n${tag}Done.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
