/**
 * Restore Fanatics Fest Day 1's start time to its real value (1:00 PM EDT =
 * 17:00 UTC). It was temporarily moved to this morning to open geofenced
 * posting before noon; that's moot now (it's the afternoon), and the original
 * time is what should display. Posting stays open (window opened at noon) and,
 * with the marquee 18h feed lookback, it stays on the feed while live.
 *
 * Idempotent. Prints before/after. Touches only the Day 1 event row.
 * Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0';
const ORIGINAL_START = new Date('2026-07-16T17:00:00.000Z');

async function main() {
  const before = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { id: true, title: true, date: true, live_window_hours_after_start: true },
  });
  if (!before) {
    console.error(`[restore-day1] Event ${DAY1_EVENT_ID} not found — aborting.`);
    process.exit(1);
  }
  console.log(`[restore-day1] BEFORE: date=${before.date.toISOString()}  (${before.title})`);

  const updated = await prisma.event.update({
    where: { id: DAY1_EVENT_ID },
    data: { date: ORIGINAL_START },
    select: { date: true },
  });
  console.log(`[restore-day1] AFTER:  date=${updated.date.toISOString()}`);
  console.log('[restore-day1] ✓ Day 1 start restored to 1:00 PM EDT.');
}

main()
  .catch(err => {
    console.error('[restore-day1] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
