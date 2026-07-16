/**
 * Pin Fanatics Fest Day 1 for its full 18-hour live window WITHOUT date-nudging.
 *
 * Background: the feed's event cards come from the /games marquee query
 * (teamless=true) and the map from /games?map_view=true. Both already carry a
 * deployed "keep live fest events pinned for 18h" rule:
 *   - list/marquee: whereClause.date.gte widened from now-2h to now-18h when
 *     teamless=true (server/src/routes/games.ts).
 *   - map: an OR branch keeps teamless events with date within [now-18h, now+7d].
 * Earlier fixes moved the dates FORWARD every hour, which fought that rule and
 * made the displayed start drift (5:15 PM instead of 1:00 PM).
 *
 * This sets Day 1's GAME and EVENT back to the REAL 1:00 PM EDT start, then
 * replays the exact deployed where-clauses against prod to PROVE Day 1 is
 * returned by both the feed-marquee and the map. If either check fails (18h
 * rule somehow not live), it falls back to a forward-nudge so the page never
 * goes dark, and reports FALLBACK loudly.
 *
 * Read-only visibility check for Days 2-4 is included for confidence.
 * Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0';
const REAL_START = new Date('2026-07-16T17:00:00.000Z'); // 1:00 PM EDT, Day 1
const OTHER_FEST_EVENT_IDS = [
  'cmrblzxxn0003x1lanq5vn4bs', // Day 2
  'cmrblzxyc0005x1la8stvo3e0', // Day 3
  'cmrblzy070007x1lajr3u9bmi', // Day 4
];

const MS_18H = 18 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;

/** Replays the deployed feed-marquee where-clause: approved + teamless + date >= now-18h. */
async function marqueeReturnsGame(gameId: string, now: Date): Promise<boolean> {
  const hit = await prisma.game.findFirst({
    where: {
      id: gameId,
      approval_status: 'approved',
      opponent_approval_status: { in: ['not_required', 'approved'] },
      home_team_id: null,
      away_team_id: null,
      date: { gte: new Date(now.getTime() - MS_18H) },
    } as any,
    select: { id: true },
  });
  return !!hit;
}

/** Replays the deployed map teamless OR-branch: teamless + date in [now-18h, now+7d]. */
async function mapReturnsGame(gameId: string, now: Date): Promise<boolean> {
  const hit = await prisma.game.findFirst({
    where: {
      id: gameId,
      home_team_id: null,
      away_team_id: null,
      date: { gte: new Date(now.getTime() - MS_18H), lte: new Date(now.getTime() + MS_7D) },
    } as any,
    select: { id: true },
  });
  return !!hit;
}

async function loadGameId(eventId: string): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, date: true, game_id: true },
  });
  if (!event) return null;
  if (event.game_id) return event.game_id;
  const game = await prisma.game.findFirst({
    where: { events: { some: { id: eventId } } },
    select: { id: true },
  });
  return game?.id ?? null;
}

async function main() {
  const now = new Date();
  console.log(`[pin-day1] now=${now.toISOString()}  REAL_START=${REAL_START.toISOString()}`);

  const gameId = await loadGameId(DAY1_EVENT_ID);
  if (!gameId) {
    console.error('[pin-day1] Day 1 has no linked game — cannot pin. Aborting.');
    process.exit(1);
  }
  console.log(`[pin-day1] Day 1 game=${gameId}`);

  // Set BOTH the game (feed/map filter) and event (posting window) to the real start.
  await prisma.game.update({ where: { id: gameId }, data: { date: REAL_START } });
  await prisma.event.update({ where: { id: DAY1_EVENT_ID }, data: { date: REAL_START } });
  console.log(`[pin-day1] set game.date + event.date -> ${REAL_START.toISOString()} (real 1:00 PM EDT)`);

  // Prove the deployed 18h window surfaces it on both surfaces.
  const [feedOk, mapOk] = await Promise.all([
    marqueeReturnsGame(gameId, now),
    mapReturnsGame(gameId, now),
  ]);
  console.log(`[pin-day1] feed-marquee returns Day 1? ${feedOk ? 'YES' : 'NO'}`);
  console.log(`[pin-day1] map returns Day 1?          ${mapOk ? 'YES' : 'NO'}`);

  // Posting window (geofence): opens event.date-1h, closes event.date+18h.
  const postOpen = now.getTime() >= REAL_START.getTime() - 60 * 60 * 1000;
  const postCloses = new Date(REAL_START.getTime() + MS_18H);
  console.log(
    `[pin-day1] posting window open now? ${postOpen ? 'YES' : 'NO'}  (closes ${postCloses.toISOString()})`
  );

  if (feedOk && mapOk) {
    console.log('[pin-day1] ✓ PASS — Day 1 shows real 1:00 PM start and is pinned by the deployed 18h window on feed + map. No nudging needed.');
  } else {
    // Safety net: never let the page go dark. Nudge forward so base filters catch it.
    const target = new Date(now.getTime() + 50 * 60 * 1000);
    await prisma.game.update({ where: { id: gameId }, data: { date: target } });
    await prisma.event.update({ where: { id: DAY1_EVENT_ID }, data: { date: target } });
    console.error(
      `[pin-day1] ⚠ FALLBACK — 18h window did not surface Day 1 (feed=${feedOk} map=${mapOk}). ` +
        `Nudged game+event to ${target.toISOString()} so it stays visible. The 18h rule needs a look.`
    );
  }

  // Read-only confidence check for the other fest days.
  for (const eid of OTHER_FEST_EVENT_IDS) {
    const gid = await loadGameId(eid);
    if (!gid) {
      console.log(`[pin-day1] other fest event ${eid}: no linked game`);
      continue;
    }
    const g = await prisma.game.findUnique({
      where: { id: gid },
      select: { id: true, date: true, home_team_id: true, away_team_id: true },
    });
    const teamless = g && !g.home_team_id && !g.away_team_id;
    const feed = await marqueeReturnsGame(gid, now);
    const map = teamless ? await mapReturnsGame(gid, now) : (g ? g.date >= now : false);
    console.log(
      `[pin-day1] fest event ${eid}: game=${gid} date=${g?.date.toISOString()} teamless=${teamless} feed=${feed ? 'YES' : 'no'} map=${map ? 'YES' : 'no'}`
    );
  }
}

main()
  .catch(err => {
    console.error('[pin-day1] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
