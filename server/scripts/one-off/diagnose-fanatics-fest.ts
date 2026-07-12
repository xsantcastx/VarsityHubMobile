/**
 * Read-only diagnostic: confirms the 4 Fanatics Fest day-pages still exist
 * in the DB, and counts how many Game rows sort ahead of them in the main
 * feed's date-ascending query (app/feed.tsx uses Game.list('date', { limit: 30 })).
 *
 * Usage: npx tsx scripts/one-off/diagnose-fanatics-fest.ts
 * Requires DATABASE_URL in environment.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  console.log(`Now: ${now.toISOString()}\n`);

  const fanaticsEvents = await prisma.event.findMany({
    where: { title: { startsWith: 'Fanatics Fest NYC 2026' } },
    select: {
      id: true,
      title: true,
      date: true,
      game_id: true,
      approval_status: true,
      status: true,
    },
    orderBy: { date: 'asc' },
  });
  console.log(`Fanatics Fest events found: ${fanaticsEvents.length}`);
  for (const e of fanaticsEvents) {
    console.log(
      `  - "${e.title}" date=${e.date.toISOString()} game_id=${e.game_id} approval=${e.approval_status} status=${e.status}`
    );
  }
  console.log('');

  const fanaticsGames = await prisma.game.findMany({
    where: { title: { startsWith: 'Fanatics Fest NYC 2026' } },
    select: { id: true, title: true, date: true, approval_status: true },
    orderBy: { date: 'asc' },
  });
  console.log(`Fanatics Fest games found: ${fanaticsGames.length}`);
  for (const g of fanaticsGames) {
    console.log(`  - "${g.title}" date=${g.date.toISOString()} approval=${g.approval_status}`);
  }
  console.log('');

  if (fanaticsGames.length > 0) {
    const earliest = fanaticsGames[0].date;
    const aheadCount = await prisma.game.count({
      where: { date: { gte: now, lt: earliest }, approval_status: 'approved' },
    });
    console.log(
      `Approved games scheduled between now and the first Fanatics Fest game (${earliest.toISOString()}): ${aheadCount}`
    );
    console.log(
      `Feed query is Game.list('date', { limit: 30, dateFrom: now }) — if aheadCount >= 30, Fanatics Fest is past page 1.`
    );
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
