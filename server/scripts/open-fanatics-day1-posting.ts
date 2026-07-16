/**
 * Open Fanatics Fest NYC 2026 — Day 1 for geofenced highlight-posting NOW.
 *
 * The geofenced post window opens 1h before the event's start. Day 1 was set
 * to 1:00 PM EDT (17:00 UTC), so posting wouldn't open until noon EDT. Fans are
 * already inside the Javits Center and posting must be live immediately, so we
 * move Day 1's `date` back to the current time — the window then opens at
 * (now - 1h), i.e. already open. The 18h live window keeps it open all day and
 * overnight. Story posting (game-day + geofence) is unaffected (same UTC day).
 *
 * Prints the ORIGINAL date so this is trivially reversible:
 *   prisma.event.update({ where:{id}, data:{ date: new Date('<printed ISO>') }})
 *
 * Only touches the single Day 1 event row. Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0'; // Day 1: Thursday, July 16

async function main() {
  const before = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { id: true, title: true, date: true, live_window_hours_after_start: true },
  });
  if (!before) {
    console.error(`[open-day1] Event ${DAY1_EVENT_ID} not found — aborting.`);
    process.exit(1);
  }
  console.log('[open-day1] BEFORE (save this to revert):');
  console.log(`  id:    ${before.id}`);
  console.log(`  title: ${before.title}`);
  console.log(`  date:  ${before.date.toISOString()}  <-- ORIGINAL START (revert value)`);
  console.log(`  live_window_hours_after_start: ${before.live_window_hours_after_start ?? 'null'}`);

  const now = new Date();
  // Set the start ~50 min into the future: the map ("Nearby Games") only shows
  // events with date >= now, so a live event needs a near-future start to stay
  // pinned. Posting is already open because the window opens 1h before start
  // (date - 1h = ~10 min ago). Discoverable on map + feed immediately.
  const target = new Date(now.getTime() + 50 * 60 * 1000);
  const updated = await prisma.event.update({
    where: { id: DAY1_EVENT_ID },
    data: { date: target },
    select: { id: true, date: true },
  });
  console.log(`[open-day1] AFTER:`);
  console.log(`  date:  ${updated.date.toISOString()}  (map-visible; posting opened ~10 min ago)`);

  // Verify the geofenced post window is now open.
  const windowStartMs = updated.date.getTime() - 60 * 60 * 1000;
  const isOpen = Date.now() >= windowStartMs;
  if (!isOpen) {
    console.error('[open-day1] VERIFY FAILED — window still not open. Investigate.');
    process.exit(1);
  }
  console.log('[open-day1] ✓ Day 1 geofenced post window is now OPEN. Fans at the venue can post highlights.');
}

main()
  .catch(err => {
    console.error('[open-day1] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
