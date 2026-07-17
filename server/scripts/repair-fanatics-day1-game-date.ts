/**
 * Repair Fanatics Fest Day 1's GAME date, corrupted by keep-day1-pinned.ts.
 *
 * That job (now retired) set Game.date = now + 2h every 20 minutes so the old
 * 1.0.4 client — which bucketed a game "live" only within a 2h window — kept
 * Day 1 at the top of the feed. It deliberately left Event.date at the real
 * 1:00 PM start. When it self-terminated at REAL_START + 18h the game date
 * stayed frozen at whatever the final run wrote, so the feed card prints a
 * start time hours away from the truth ("Jul 17, 3:05 AM" for a 1:00 PM Jul 16
 * event).
 *
 * restore-fanatics-day1-date.ts does NOT cover this — it only repairs
 * Event.date, which was never moved.
 *
 * Dry-run by default. Pass --apply to write.
 *
 *   npx tsx scripts/repair-fanatics-day1-game-date.ts            # preview
 *   npx tsx scripts/repair-fanatics-day1-game-date.ts --apply    # write
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0';
/** The real Day 1 start: 2026-07-16 1:00 PM EDT. Matches REAL_START in the retired keep-day1-pinned.ts. */
const REAL_START = new Date('2026-07-16T17:00:00.000Z');

const APPLY = process.argv.includes('--apply');

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { id: true, title: true, date: true, game_id: true },
  });

  if (!event) {
    console.error(`[repair-day1] Event ${DAY1_EVENT_ID} not found — nothing to do.`);
    process.exitCode = 1;
    return;
  }

  const gameId =
    event.game_id ??
    (
      await prisma.game.findFirst({
        where: { events: { some: { id: DAY1_EVENT_ID } } },
        select: { id: true },
      })
    )?.id;

  if (!gameId) {
    console.error('[repair-day1] Day 1 has no linked game — nothing to repair.');
    process.exitCode = 1;
    return;
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, date: true },
  });

  if (!game) {
    console.error(`[repair-day1] Game ${gameId} not found.`);
    process.exitCode = 1;
    return;
  }

  // The event date is the source of truth for the real start — prefer it over
  // the hardcoded constant if they disagree, and say so rather than guessing.
  const target = event.date ?? REAL_START;
  if (event.date && event.date.getTime() !== REAL_START.getTime()) {
    console.warn(
      `[repair-day1] NOTE: Event.date (${event.date.toISOString()}) != expected REAL_START ` +
        `(${REAL_START.toISOString()}). Using Event.date — it is the source of truth for the ` +
        `posting window. If the event date itself looks wrong, fix that first.`
    );
  }

  console.log(`[repair-day1] event:      ${event.title ?? event.id}`);
  console.log(`[repair-day1] event.date: ${event.date?.toISOString() ?? '(null)'}`);
  console.log(`[repair-day1] game.date:  ${game.date?.toISOString() ?? '(null)'}  <- corrupted`);
  console.log(`[repair-day1] target:     ${target.toISOString()}`);

  if (game.date && game.date.getTime() === target.getTime()) {
    console.log('[repair-day1] Already correct — no change needed.');
    return;
  }

  const driftHours =
    game.date != null ? (game.date.getTime() - target.getTime()) / (60 * 60 * 1000) : NaN;
  console.log(`[repair-day1] drift:      ${driftHours.toFixed(2)}h`);

  if (!APPLY) {
    console.log('\n[repair-day1] DRY RUN — no write. Re-run with --apply to fix.');
    return;
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { date: target },
    select: { id: true, date: true },
  });
  console.log(`\n[repair-day1] ✓ game ${updated.id} date -> ${updated.date.toISOString()}`);
  console.log(
    '[repair-day1] Confirm the retired workflow is not still running before trusting this:\n' +
      '              .github/workflows/keep-fanatics-day1-pinned.yml (schedule removed 2026-07-17)'
  );
}

main()
  .catch(err => {
    console.error('[repair-day1] Failed:', err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
