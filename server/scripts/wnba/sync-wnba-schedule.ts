/**
 * WNBA — bulk schedule sync from ESPN's public scoreboard API.
 *
 * ESPN's scoreboard endpoint is per-day, so this loops every date between
 * --from and --to (inclusive, UTC dates) and idempotently creates a Game +
 * linked Event for each game found, matched by title + exact date (same
 * convention as the one-off template). No Team or Organization records are
 * created — home/away are plain display strings.
 *
 * Usage:
 *   npx tsx scripts/wnba/sync-wnba-schedule.ts --inspect                        # dump raw API shape, no DB writes
 *   npx tsx scripts/wnba/sync-wnba-schedule.ts --from 2026-07-09 --to 2026-07-31 --dry-run
 *   npx tsx scripts/wnba/sync-wnba-schedule.ts --from 2026-07-09 --to 2026-07-31
 *
 * Requires DATABASE_URL in environment (or .env file).
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { WNBA_VENUES } from './wnba-venues';

const prisma = new PrismaClient();
const ADMIN_EMAIL = 'emancero@varsityhub.app';

interface Admin {
  id: string;
  email: string | null;
}

interface EspnGame {
  id: string;
  date: string;
  competitions: Array<{
    competitors: Array<{
      homeAway: 'home' | 'away';
      team: { displayName: string; shortDisplayName?: string };
    }>;
    venue?: { fullName?: string };
  }>;
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
      console.error('Usage: --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]  (or --inspect to preview raw API shape)');
      process.exit(1);
    }
  }
  return { dryRun, inspect, from: from ?? '2026-07-09', to: to ?? '2026-07-16' };
}

function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10).replace(/-/g, ''));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

async function fetchDay(yyyymmdd: string): Promise<{ games: EspnGame[]; raw: any }> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard?dates=${yyyymmdd}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API returned ${res.status} ${res.statusText} for ${yyyymmdd}`);
  const data: any = await res.json();
  return { games: data.events ?? [], raw: data };
}

async function ensureGame(
  game: EspnGame,
  admin: Admin,
  dryRun: boolean
): Promise<'created' | 'skipped' | 'no-venue' | 'malformed'> {
  const comp = game.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home')?.team?.displayName;
  const away = comp?.competitors?.find(c => c.homeAway === 'away')?.team?.displayName;
  if (!home || !away || !game.date) {
    console.warn(`⚠️  Malformed game entry (id=${game.id}): missing team names or date`);
    return 'malformed';
  }

  const title = `${away} at ${home}`;
  const date = new Date(game.date);
  const venue = WNBA_VENUES[home];
  if (!venue) {
    console.warn(`⚠️  No venue data for home team "${home}" — skipping "${title}"`);
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
      await prisma.game.update({ where: { id: existingGame.id }, data: { banner_url: venue.bannerUrl } });
    }
  } else if (dryRun) {
    console.log(`[dry-run] Would create "${title}" — ${game.date} @ ${venue.name}`);
    return 'created';
  } else {
    const created = await prisma.game.create({
      data: {
        title,
        description: `WNBA regular season. ${away} at ${venue.name}.`,
        date,
        location: venue.name,
        latitude: venue.lat,
        longitude: venue.lng,
        venue_address: venue.address,
        venue_lat: venue.lat,
        venue_lng: venue.lng,
        home_team: home,
        away_team: away,
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
      await prisma.event.update({ where: { id: existingEvent.id }, data: { banner_url: venue.bannerUrl } });
    }
    return 'skipped';
  }
  if (!dryRun) {
    await prisma.event.create({
      data: {
        title,
        description: `WNBA regular season. ${away} at ${venue.name}.`,
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
        linked_league: 'WNBA',
        banner_url: venue.bannerUrl,
      },
    });
  }
  return 'created';
}

async function main() {
  const { dryRun, inspect, from, to } = parseArgs();
  const days = dateRange(from, to);

  if (inspect) {
    console.log(`Fetching WNBA scoreboard for ${days[0]} (first day only, inspection mode)...\n`);
    const { games, raw } = await fetchDay(days[0]);
    console.log(`Games found: ${games.length}\n`);
    console.log('First 2 raw event objects:\n', JSON.stringify(games.slice(0, 2), null, 2));
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
  console.log(`${dryRun ? '[dry-run] ' : ''}Fetching WNBA schedule ${from} to ${to} (${days.length} days)...\n`);

  let created = 0;
  let skipped = 0;
  let noVenue = 0;
  let malformed = 0;
  let failed = 0;
  for (const day of days) {
    let games: EspnGame[];
    try {
      const result = await fetchDay(day);
      games = result.games;
    } catch (err) {
      failed++;
      console.error(`❌ Failed to fetch ${day}: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    for (const g of games) {
      try {
        const result = await ensureGame(g, admin, dryRun);
        if (result === 'created') created++;
        else if (result === 'no-venue') noVenue++;
        else if (result === 'malformed') malformed++;
        else skipped++;
      } catch (err) {
        failed++;
        console.error(`❌ Failed on event id=${g.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(
    `\n✅ WNBA sync complete. created=${created} already-existed=${skipped} no-venue-match=${noVenue} malformed=${malformed} failed=${failed}\n`
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
