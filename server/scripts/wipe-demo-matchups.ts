/**
 * Delete every row tagged [DEMO_MATCHUP] created by seed-demo-matchups.ts.
 * Cascades through child rows in FK-safe order:
 *   posts + stories + rsvps → game → team memberships → team
 *
 * Run:
 *   cd server && npx tsx scripts/wipe-demo-matchups.ts
 *
 * This script only touches rows whose description/title contains the
 * [DEMO_MATCHUP] marker. Genuine user content is not affected.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TAG = '[DEMO_MATCHUP]';

async function main() {
  console.log(`[wipe-demo-matchups] Removing rows tagged ${DEMO_TAG}`);
  console.log(`[wipe-demo-matchups] Target DB: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log();

  // 1. Find the demo games by description tag.
  const demoGames = await prisma.game.findMany({
    where: { description: { contains: DEMO_TAG } },
    select: { id: true, title: true },
  });
  const demoGameIds = demoGames.map((g) => g.id);
  console.log(`  ${demoGameIds.length} demo games to remove.`);

  // 2. Find the demo teams by description tag.
  const demoTeams = await prisma.team.findMany({
    where: { description: { contains: DEMO_TAG } },
    select: { id: true, name: true },
  });
  const demoTeamIds = demoTeams.map((t) => t.id);
  console.log(`  ${demoTeamIds.length} demo teams to remove.`);
  console.log();

  // 3. Remove child rows first.
  if (demoGameIds.length) {
    const stories = await prisma.story.deleteMany({ where: { game_id: { in: demoGameIds } } });
    console.log(`  - stories: ${stories.count}`);

    const posts = await prisma.post.deleteMany({ where: { game_id: { in: demoGameIds } } });
    console.log(`  - posts: ${posts.count}`);

    const votes = await prisma.gameVote.deleteMany({ where: { game_id: { in: demoGameIds } } });
    console.log(`  - game votes: ${votes.count}`);

    const gameResult = await prisma.game.deleteMany({ where: { id: { in: demoGameIds } } });
    console.log(`  - games: ${gameResult.count}`);
  }

  if (demoTeamIds.length) {
    const memberships = await prisma.teamMembership.deleteMany({
      where: { team_id: { in: demoTeamIds } },
    });
    console.log(`  - team memberships: ${memberships.count}`);

    const follows = await prisma.teamFollow.deleteMany({
      where: { team_id: { in: demoTeamIds } },
    });
    console.log(`  - team follows: ${follows.count}`);

    const invites = await prisma.teamInvite.deleteMany({
      where: { team_id: { in: demoTeamIds } },
    });
    console.log(`  - team invites: ${invites.count}`);

    const teamResult = await prisma.team.deleteMany({ where: { id: { in: demoTeamIds } } });
    console.log(`  - teams: ${teamResult.count}`);
  }

  console.log();
  console.log('Done.');
}

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  return url.replace(/:[^:@/]*@/, ':***@');
}

main()
  .catch((err) => {
    console.error('[wipe-demo-matchups] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
