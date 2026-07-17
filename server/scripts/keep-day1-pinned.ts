/**
 * Keep Fanatics Fest Day 1 pinned to the TOP of the feed + on the map for its
 * full 18-hour live window, on the CURRENTLY INSTALLED app (no OTA needed).
 *
 * Why a repeating nudge: the live App Store binary (runtime 1.0.4) buckets a
 * game into the prominent "upcoming/live" feed section only if it started within
 * a 2-hour client window (LIVE_WINDOW_MS in app/feed.tsx). The server's 18h
 * marquee window returns Day 1 in the response, but the app still demotes a
 * >2h-old game to the collapsed "past" section — so at the real 1PM start it
 * looks "gone" from the top. Raising that 2h→18h is a client change that can't
 * reach the 1.0.4 binary mid-event. Keeping the GAME date fresh (a bit in the
 * future) is the one server-side lever that keeps it in the live section there.
 *
 * Design:
 *  - EVENT date is left at the real 1:00 PM start, so the geofenced POST window
 *    (event.date-1h .. event.date+18h) is a genuine 18 hours and posting is open.
 *  - GAME date is set to now+120min each run so the app always buckets it "live".
 *  - Self-terminates after the real 18h window ends (REAL_START + 18h): past
 *    that point it no-ops, so the scheduled workflow can stay armed harmlessly.
 *
 * Run via CI (scheduled) with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0';
const REAL_START = new Date('2026-07-16T17:00:00.000Z'); // 1:00 PM EDT
const WINDOW_END = new Date(REAL_START.getTime() + 18 * 60 * 60 * 1000); // 18h live window
const LOOKAHEAD_MS = 120 * 60 * 1000; // keep the game 2h in the future

async function day1GameId(): Promise<string | null> {
  const ev = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { game_id: true },
  });
  if (ev?.game_id) return ev.game_id;
  const g = await prisma.game.findFirst({
    where: { events: { some: { id: DAY1_EVENT_ID } } },
    select: { id: true },
  });
  return g?.id ?? null;
}

async function main() {
  const now = new Date();
  console.log(`[keep-day1] now=${now.toISOString()}  window_end=${WINDOW_END.toISOString()}`);

  if (now.getTime() > WINDOW_END.getTime()) {
    console.log('[keep-day1] 18h live window is over — no-op. (Safe to disable this schedule.)');
    return;
  }

  const gid = await day1GameId();
  if (!gid) {
    console.error('[keep-day1] Day 1 has no linked game — nothing to pin.');
    process.exit(1);
  }

  const target = new Date(now.getTime() + LOOKAHEAD_MS);
  const updated = await prisma.game.update({
    where: { id: gid },
    data: { date: target },
    select: { id: true, date: true },
  });
  console.log(`[keep-day1] ✓ game ${gid} date -> ${updated.date.toISOString()} (pinned live on feed+map)`);

  // Belt-and-suspenders: make sure the EVENT is still at the real 1PM start so
  // the geofenced posting window is a true 18h (never let a prior forward-nudge
  // of the event leak in and drift posting).
  const ev = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { date: true },
  });
  if (ev && ev.date.getTime() !== REAL_START.getTime()) {
    await prisma.event.update({ where: { id: DAY1_EVENT_ID }, data: { date: REAL_START } });
    console.log(`[keep-day1] event date reset to real start ${REAL_START.toISOString()} (posting window = 18h)`);
  } else {
    console.log(`[keep-day1] event date already at real start ${REAL_START.toISOString()}`);
  }
}

main()
  .catch(err => {
    console.error('[keep-day1] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
