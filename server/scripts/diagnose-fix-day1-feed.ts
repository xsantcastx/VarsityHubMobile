/**
 * Diagnose + fix why Fanatics Day 1 isn't on the feed/map. The feed lists GAMES
 * and filters by game.date; earlier nudges only touched the EVENT date, so the
 * game may still be past-dated. Dumps the event, its linked game (dates, team
 * columns, approval, privacy) and, if a game is found, sets its date ~50 min
 * ahead so it's map/feed-visible now (posting keys off the event date, already
 * nudged). Run via CI with PRODUCTION_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DAY1_EVENT_ID = 'cmrblzxwi0001x1lasw8q7cc0';

async function main() {
  const now = new Date();
  const target = new Date(now.getTime() + 50 * 60 * 1000);
  console.log(`[day1] now=${now.toISOString()}  target=${target.toISOString()}`);

  const event = await prisma.event.findUnique({
    where: { id: DAY1_EVENT_ID },
    select: { id: true, title: true, date: true, game_id: true, status: true },
  });
  console.log(`[day1] EVENT: date=${event?.date.toISOString()} game_id=${event?.game_id ?? 'null'} status=${(event as any)?.status}`);

  // Find the game the feed would show: prefer event.game_id, else a game linking back.
  let game =
    event?.game_id
      ? await prisma.game.findUnique({
          where: { id: event.game_id },
          select: {
            id: true,
            date: true,
            home_team_id: true,
            away_team_id: true,
            approval_status: true,
          } as any,
        })
      : null;
  if (!game) {
    game = await prisma.game.findFirst({
      where: { events: { some: { id: DAY1_EVENT_ID } } },
      select: {
        id: true,
        date: true,
        home_team_id: true,
        away_team_id: true,
        approval_status: true,
      } as any,
    });
  }

  if (!game) {
    console.log('[day1] NO linked game found — the feed card must be the event itself.');
    return;
  }

  const g = game as any;
  console.log(
    `[day1] GAME ${g.id}: date=${new Date(g.date).toISOString()} home_team=${g.home_team_id ?? 'null'} away_team=${g.away_team_id ?? 'null'} approval=${g.approval_status}`
  );
  const teamless = !g.home_team_id && !g.away_team_id;
  console.log(`[day1] teamless(marquee)=${teamless}`);

  const updated = await prisma.game.update({
    where: { id: g.id },
    data: { date: target },
    select: { id: true, date: true },
  });
  console.log(`[day1] ✓ GAME date updated -> ${updated.date.toISOString()} (map/feed-visible now)`);
}

main()
  .catch(err => {
    console.error('[day1] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
