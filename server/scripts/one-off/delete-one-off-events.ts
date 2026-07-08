/**
 * One-off events — targeted deletion.
 *
 * Deletes ONLY the exact Event (and linked Game, if any) rows whose IDs are
 * listed in EVENT_IDS_TO_DELETE below. Never touches anything else. Existing
 * posts linked to a deleted event have their event_id set to NULL by the DB
 * FK (onDelete: SetNull) — they are not deleted.
 *
 * Usage:
 *   npx tsx scripts/one-off/delete-one-off-events.ts --dry-run   # preview
 *   npx tsx scripts/one-off/delete-one-off-events.ts             # delete
 *
 * Requires DATABASE_URL in environment (or .env file).
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// Replaced by four day-based pages — see one-off-events.data.ts.
const EVENT_IDS_TO_DELETE: string[] = [
  'cmrbce30k0001jwtc99ogwj1o', // Fanatics Fest NYC 2026 (hub)
  'cmrbce38w0003jwtcrf9zjljb', // LeBron James & Tyrese Haliburton — Live "Mind the Game" Taping
  'cmrbce3eh0005jwtcsz55nztq', // FIFA World Cup Final Pre-Match Press Conferences
  'cmrbce3k40007jwtc0dm38rii', // FIFA World Cup 2026 Final Watch Party at Fanatics Fest
];

function parseArgs() {
  const args = process.argv.slice(2);
  return { dryRun: args.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs();
  console.log(`${dryRun ? '[dry-run] ' : ''}Checking ${EVENT_IDS_TO_DELETE.length} event ID(s)\n`);

  for (const id of EVENT_IDS_TO_DELETE) {
    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true, game_id: true },
    });
    if (!event) {
      console.log(`ℹ️  Event ${id} already gone — skipping`);
      continue;
    }
    if (dryRun) {
      console.log(`[dry-run] Would delete event "${event.title}" (${event.id})`);
      if (event.game_id) {
        console.log(`   [dry-run] Would also delete linked game (${event.game_id})`);
      }
      continue;
    }
    await prisma.event.delete({ where: { id: event.id } });
    console.log(`✅ Deleted event "${event.title}" (${event.id})`);
    if (event.game_id) {
      const game = await prisma.game.findUnique({
        where: { id: event.game_id },
        select: { id: true, title: true },
      });
      if (game) {
        await prisma.game.delete({ where: { id: game.id } });
        console.log(`   ✅ Deleted linked game "${game.title}" (${game.id})`);
      }
    }
  }

  console.log('\n✅ Deletion pass complete.\n');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
