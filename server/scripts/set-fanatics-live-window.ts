/**
 * Set the 18-hour live posting window on the four Fanatics Fest NYC 2026 day
 * events (owner rule, 2026-07-15): fans at the Javits Center must be able to
 * make geofenced FIRST posts all day, not just for the default -1h → +3h
 * window. Requires the 20260715220000_event_live_window_override migration.
 *
 * Idempotent — safe to re-run. Prints before/after state and never touches
 * any other row.
 *
 * Run against prod (Railway service "Postgres-TnGR", NOT "Postgres"):
 *   DATABASE_URL="$(railway variables --service Postgres-TnGR --kv | grep -o 'DATABASE_PUBLIC_URL=[^ ]*' | cut -d= -f2-)" \
 *     npx tsx server/scripts/set-fanatics-live-window.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FANATICS_FEST_EVENT_IDS = [
  'cmrblzxwi0001x1lasw8q7cc0', // Day 1: Thursday, July 16
  'cmrblzxxn0003x1lanq5vn4bs', // Day 2: Friday, July 17
  'cmrblzxyc0005x1la8stvo3e0', // Day 3: Saturday, July 18
  'cmrblzy070007x1lajr3u9bmi', // Day 4: Sunday, July 19
];

const LIVE_WINDOW_HOURS = 18;

async function main() {
  const before = await prisma.event.findMany({
    where: { id: { in: FANATICS_FEST_EVENT_IDS } },
    select: { id: true, title: true, date: true, live_window_hours_after_start: true },
    take: FANATICS_FEST_EVENT_IDS.length,
  });
  console.log('[fanatics-live-window] Before:');
  for (const e of before) {
    console.log(`  ${e.id}  ${e.live_window_hours_after_start ?? 'null'}  ${e.title}`);
  }
  if (before.length !== FANATICS_FEST_EVENT_IDS.length) {
    console.error(
      `[fanatics-live-window] Expected ${FANATICS_FEST_EVENT_IDS.length} events, found ${before.length} — aborting.`
    );
    process.exit(1);
  }

  const result = await prisma.event.updateMany({
    where: { id: { in: FANATICS_FEST_EVENT_IDS } },
    data: { live_window_hours_after_start: LIVE_WINDOW_HOURS },
  });
  console.log(`[fanatics-live-window] Updated ${result.count} events to ${LIVE_WINDOW_HOURS}h.`);

  const after = await prisma.event.findMany({
    where: { id: { in: FANATICS_FEST_EVENT_IDS } },
    select: { id: true, live_window_hours_after_start: true },
    take: FANATICS_FEST_EVENT_IDS.length,
  });
  const wrong = after.filter(e => e.live_window_hours_after_start !== LIVE_WINDOW_HOURS);
  if (wrong.length) {
    console.error('[fanatics-live-window] VERIFY FAILED for:', wrong);
    process.exit(1);
  }
  console.log('[fanatics-live-window] ✓ All four fest events now have the 18h live window.');
}

main()
  .catch(err => {
    console.error('[fanatics-live-window] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
