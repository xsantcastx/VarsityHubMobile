/**
 * READ-ONLY. Verifies the geofenced post window for the four Fanatics Fest day
 * events: prints each event's start date, live_window_hours_after_start, the
 * computed window open/close bounds, and the current state (before_open / live
 * / grace / closed). No writes.
 *
 * Mirrors server/src/lib/geofencing.ts window math exactly:
 *   windowStart = date - 1h
 *   liveCutoff  = date + (live_window_hours_after_start || 3)h
 *   graceEnd    = liveCutoff + 7d
 *
 * Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OPEN_BEFORE_MS = 60 * 60 * 1000; // 1h
const DEFAULT_HOURS = 3;
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const FEST_EVENT_IDS = [
  'cmrblzxwi0001x1lasw8q7cc0', // Day 1
  'cmrblzxxn0003x1lanq5vn4bs', // Day 2
  'cmrblzxyc0005x1la8stvo3e0', // Day 3
  'cmrblzy070007x1lajr3u9bmi', // Day 4
];

function stateFor(date: Date, hours: number | null, now: Date) {
  const windowStart = new Date(date.getTime() - OPEN_BEFORE_MS);
  const afterHours = typeof hours === 'number' && hours > 0 ? hours : DEFAULT_HOURS;
  const liveCutoff = new Date(date.getTime() + afterHours * 60 * 60 * 1000);
  const graceEnd = new Date(liveCutoff.getTime() + GRACE_MS);
  let state: string;
  if (now < windowStart) state = 'before_open';
  else if (now <= liveCutoff) state = 'LIVE';
  else if (now <= graceEnd) state = 'grace (unlocked users only)';
  else state = 'closed';
  return { windowStart, liveCutoff, graceEnd, afterHours, state };
}

async function main() {
  const now = new Date();
  console.log(`[verify] now = ${now.toISOString()}\n`);
  const events = await prisma.event.findMany({
    where: { id: { in: FEST_EVENT_IDS } },
    select: { id: true, title: true, date: true, live_window_hours_after_start: true },
    take: FEST_EVENT_IDS.length,
  });

  let allEighteen = true;
  for (const id of FEST_EVENT_IDS) {
    const e = events.find(x => x.id === id);
    if (!e) {
      console.log(`  ${id}  ❌ NOT FOUND`);
      allEighteen = false;
      continue;
    }
    const hours = e.live_window_hours_after_start;
    if (hours !== 18) allEighteen = false;
    const { windowStart, liveCutoff, afterHours, state } = stateFor(e.date, hours, now);
    console.log(`${e.title}`);
    console.log(`  start:        ${e.date.toISOString()}`);
    console.log(`  window_hours: ${hours ?? 'null'} ${hours === 18 ? '✓' : '⚠ not 18'}`);
    console.log(`  opens:        ${windowStart.toISOString()}`);
    console.log(`  closes:       ${liveCutoff.toISOString()}  (${afterHours}h after start)`);
    console.log(`  STATE:        ${state}\n`);
  }

  console.log(
    allEighteen
      ? '[verify] ✓ All four fest events have the 18h live window.'
      : '[verify] ⚠ Not all fest events have an 18h window — see above.'
  );
}

main()
  .catch(err => {
    console.error('[verify] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
