/**
 * MLB — bulk schedule sync from the official MLB Stats API (statsapi.mlb.com).
 *
 * Fetches every game between --from and --to (inclusive, UTC dates) and
 * idempotently creates a Game + linked Event for each, matched by title +
 * exact date (same convention as the one-off template). No Team or
 * Organization records are created — home/away are plain display strings.
 *
 * Usage:
 *   npx tsx scripts/mlb/sync-mlb-schedule.ts --inspect                        # dump raw API shape, no DB writes
 *   npx tsx scripts/mlb/sync-mlb-schedule.ts --from 2026-07-09 --to 2026-07-31 --dry-run
 *   npx tsx scripts/mlb/sync-mlb-schedule.ts --from 2026-07-09 --to 2026-07-31
 *
 * Requires DATABASE_URL in environment (or .env file).
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { MLB_VENUES } from './mlb-venues';

const prisma = new PrismaClient();
const ADMIN_EMAIL = 'emancero@varsityhub.app';

interface Admin {
  id: string;
  email: string | null;
}

interface MlbGame {
  gamePk: number;
  gameDate: string;
  teams: {
    home: { team: { name: string } };
    away: { team: { name: string } };
  };
  venue?: { name: string };
  status?: { abstractGameState?: string; detailedState?: string };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inspect = args.includes('--inspect');
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const from = fromIdx !== -1 ? args[fromIdx + 1] : undefined;
  const to = toIdx !== -1 ? args[toIdx + 1] : undefined;
  if (!inspect) {
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      console.error(
        'Usage: --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]  (or --inspect to preview raw API shape)'
      );
      process.exit(1);
    }
  }
  return { dryRun, inspect, from: from ?? '2026-07-09', to: to ?? '2026-07-16' };
}

async function fetchSchedule(from: string, to: string): Promise<{ games: MlbGame[]; raw: any }> {
  const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${from}&endDate=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MLB Stats API returned ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  const games: MlbGame[] = [];
  for (const day of data.dates ?? []) {
    for (const g of day.games ?? []) {
      games.push(g);
    }
  }
  return { games, raw: data };
}

async function ensureGame(
  game: MlbGame,
  admin: Admin,
  dryRun: boolean
): Promise<'created' | 'skipped' | 'no-venue'> {
  const homeTeam = game.teams?.home?.team?.name;
  const awayTeam = game.teams?.away?.team?.name;
  if (!homeTeam || !awayTeam || !game.gameDate) {
    throw new Error(`Malformed game entry (gamePk=${game.gamePk}): missing team names or date`);
  }

  const title = `${awayTeam} at ${homeTeam}`;
  const date = new Date(game.gameDate);
  const venue = MLB_VENUES[homeTeam];
  if (!venue) {
    console.warn(`⚠️  No venue data for home team "${homeTeam}" — skipping "${title}"`);
    return 'no-venue';
  }

  let gameId: string | undefined;
  const existingGame = await prisma.game.findFirst({
    where: { title, date },
    select: { id: true, banner_url: true },
  });
  if (existingGame) {
    gameId = existingGame.id;
    if (!existingGame.banner_url && venue.bannerUrl && !dryRun) {
      await prisma.game.update({
        where: { id: existingGame.id },
        data: { banner_url: venue.bannerUrl },
      });
    }
  } else if (dryRun) {
    console.log(`[dry-run] Would create "${title}" — ${game.gameDate} @ ${venue.name}`);
    return 'created';
  } else {
    const created = await prisma.game.create({
      data: {
        title,
        description: `MLB regular season. ${awayTeam} at ${venue.name}.`,
        date,
        location: venue.name,
        latitude: venue.lat,
        longitude: venue.lng,
        venue_address: venue.address,
        venue_lat: venue.lat,
        venue_lng: venue.lng,
        home_team: homeTeam,
        away_team: awayTeam,
        event_type: 'game',
        approval_status: 'approved',
        approved_at: new Date(),
        approved_by_id: admin.id,
        created_by_id: admin.id,
        is_neutral: false,
        banner_url: venue.bannerUrl,
      },
      select: { id: true },
    });
    gameId = created.id;
  }

  const existingEvent = await prisma.event.findFirst({
    where: { title, date },
    select: { id: true, game_id: true, banner_url: true },
  });
  if (existingEvent) {
    if (dryRun) return 'skipped';
    if (gameId && !existingEvent.game_id) {
      await prisma.event.update({ where: { id: existingEvent.id }, data: { game_id: gameId } });
    }
    if (!existingEvent.banner_url && venue.bannerUrl) {
      await prisma.event.update({
        where: { id: existingEvent.id },
        data: { banner_url: venue.bannerUrl },
      });
    }
    return 'skipped';
  }
  if (!dryRun) {
    await prisma.event.create({
      data: {
        title,
        description: `MLB regular season. ${awayTeam} at ${venue.name}.`,
        date,
        location: venue.name,
        latitude: venue.lat,
        longitude: venue.lng,
        event_type: 'game',
        game_id: gameId,
        creator_id: admin.id,
        creator_role: 'organizer',
        approval_status: 'approved',
        status: 'approved',
        approved_at: new Date(),
        approved_by: admin.id,
        contact_info: 'customerservice@varsityhub.app',
        linked_league: 'MLB',
        banner_url: venue.bannerUrl,
      },
    });
  }
  return 'created';
}

async function main() {
  const { dryRun, inspect, from, to } = parseArgs();

  if (inspect) {
    console.log(`Fetching MLB schedule ${from} to ${to} for inspection (no DB writes)...\n`);
    const { games, raw } = await fetchSchedule(from, to);
    console.log(`Total games in range: ${games.length}\n`);
    console.log('First 2 raw game objects:\n', JSON.stringify(games.slice(0, 2), null, 2));
    console.log('\nTop-level response keys:', Object.keys(raw));
    return;
  }

  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }
  console.log(`Using admin: ${admin.email} (${admin.id})`);

  console.log(`${dryRun ? '[dry-run] ' : ''}Fetching MLB schedule ${from} to ${to}...`);
  const { games } = await fetchSchedule(from, to);
  console.log(`Found ${games.length} games\n`);

  let created = 0;
  let skipped = 0;
  let noVenue = 0;
  let failed = 0;
  for (const g of games) {
    try {
      const result = await ensureGame(g, admin, dryRun);
      if (result === 'created') created++;
      else if (result === 'no-venue') noVenue++;
      else skipped++;
    } catch (err) {
      failed++;
      console.error(`❌ Failed on gamePk=${g.gamePk}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `\n✅ MLB sync complete. created=${created} already-existed=${skipped} no-venue-match=${noVenue} failed=${failed}\n`
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
