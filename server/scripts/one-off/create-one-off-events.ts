/**
 * One-off events — template-driven creator.
 *
 * Reads event definitions from one-off-events.data.ts and idempotently creates
 * each one (plus a linked Game record for eventType 'game'). Existing events
 * are matched by title + exact date and skipped.
 *
 * Usage:
 *   npx tsx scripts/one-off/create-one-off-events.ts                 # all entries
 *   npx tsx scripts/one-off/create-one-off-events.ts --date 2026-06-20  # entries starting that UTC date
 *   npx tsx scripts/one-off/create-one-off-events.ts --dry-run       # print plan, write nothing
 *
 * Requires DATABASE_URL in environment (or .env file). For production:
 *   DATABASE_URL="$(railway variables --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" \
 *     npx tsx scripts/one-off/create-one-off-events.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { EVENTS, type OneOffEventDef } from './one-off-events.data';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'varsityhub00@gmail.com';

interface Admin {
  id: string;
  email: string | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateIdx = args.indexOf('--date');
  const date = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
  if (dateIdx !== -1 && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error('Invalid --date, expected YYYY-MM-DD');
    process.exit(1);
  }
  return { dryRun, date };
}

/** Find-or-create a Team under an existing org; backfills logo if missing, never overwrites. */
async function ensureTeam(
  name: string,
  orgId: string,
  sport: string | null,
  logoUrl: string | undefined,
  dryRun: boolean
): Promise<string | undefined> {
  const existing = await prisma.team.findFirst({
    where: { name, organization_id: orgId },
    select: { id: true, logo_url: true },
  });
  if (existing) {
    console.log(`ℹ️  Team already exists: "${name}" (${existing.id})`);
    if (!existing.logo_url && logoUrl) {
      if (dryRun) {
        console.log(`   [dry-run] Would backfill team logo`);
      } else {
        await prisma.team.update({
          where: { id: existing.id },
          data: { logo_url: logoUrl, avatar_url: logoUrl },
        });
        console.log(`   ✅ Team logo backfilled`);
      }
    }
    return existing.id;
  }
  if (dryRun) {
    console.log(`[dry-run] Would create team "${name}"${logoUrl ? ' with logo' : ''}`);
    return undefined;
  }
  const team = await prisma.team.create({
    data: {
      name,
      sport: sport ?? 'Other',
      organization_id: orgId,
      logo_url: logoUrl,
      avatar_url: logoUrl,
    },
    select: { id: true },
  });
  console.log(`✅ Team created: "${name}" (${team.id})`);
  return team.id;
}

async function ensureOneOffEvent(def: OneOffEventDef, admin: Admin, dryRun: boolean) {
  const date = new Date(def.dateUtc);

  // Teams + game record first — runs even when the event already exists, so
  // team logos and game↔team links get backfilled on re-runs
  let gameId: string | undefined;
  if (def.eventType === 'game' && def.game) {
    let homeTeamId: string | undefined;
    let awayTeamId: string | undefined;
    if (def.game.teamOrgName) {
      const org = await prisma.organization.findFirst({
        where: { name: def.game.teamOrgName },
        select: { id: true, sport: true },
      });
      if (!org) {
        throw new Error(
          `Organization "${def.game.teamOrgName}" not found — teamOrgName must reference an existing org`
        );
      }
      homeTeamId = await ensureTeam(
        def.game.homeTeam,
        org.id,
        org.sport,
        def.game.homeTeamLogoUrl,
        dryRun
      );
      awayTeamId = await ensureTeam(
        def.game.awayTeam,
        org.id,
        org.sport,
        def.game.awayTeamLogoUrl,
        dryRun
      );
    }

    const existingGame = await prisma.game.findFirst({
      where: { title: def.title, date },
      select: { id: true, home_team_id: true, away_team_id: true },
    });
    if (existingGame) {
      console.log(`ℹ️  Game already exists: "${def.title}" (${existingGame.id})`);
      if (
        (homeTeamId && !existingGame.home_team_id) ||
        (awayTeamId && !existingGame.away_team_id)
      ) {
        if (dryRun) {
          console.log(`   [dry-run] Would link team records to game`);
        } else {
          await prisma.game.update({
            where: { id: existingGame.id },
            data: {
              home_team_id: existingGame.home_team_id ?? homeTeamId,
              away_team_id: existingGame.away_team_id ?? awayTeamId,
            },
          });
          console.log(`   ✅ Team records linked to game`);
        }
      }
      gameId = existingGame.id;
    } else if (!dryRun) {
      const game = await prisma.game.create({
        data: {
          title: def.title,
          description: def.description,
          date,
          location: def.location,
          latitude: def.lat,
          longitude: def.lng,
          venue_address: def.location,
          venue_lat: def.lat,
          venue_lng: def.lng,
          home_team: def.game.homeTeam,
          away_team: def.game.awayTeam,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          event_type: 'game',
          approval_status: 'approved',
          approved_at: new Date(),
          approved_by_id: admin.id,
          created_by_id: admin.id,
          expected_attendance: def.game.expectedAttendance,
          is_neutral: def.game.isNeutral ?? false,
          banner_url: def.bannerUrl,
        },
        select: { id: true },
      });
      console.log(`✅ Game created: "${def.title}" (${game.id})`);
      gameId = game.id;
    }
  }

  const existing = await prisma.event.findFirst({
    where: { title: def.title, date },
    select: { id: true, title: true, banner_url: true },
  });
  if (existing) {
    console.log(`ℹ️  Event already exists: "${existing.title}" (${existing.id})`);
    if (!existing.banner_url && def.bannerUrl) {
      if (dryRun) {
        console.log(`   [dry-run] Would backfill venue banner`);
      } else {
        await prisma.event.update({
          where: { id: existing.id },
          data: { banner_url: def.bannerUrl },
        });
        console.log(`   ✅ Venue banner backfilled`);
      }
    }
    return;
  }
  if (dryRun) {
    console.log(
      `[dry-run] Would create ${def.eventType} "${def.title}" @ ${def.location} on ${def.dateUtc}` +
        (def.game ? ` (+ game record ${def.game.homeTeam} vs ${def.game.awayTeam})` : '')
    );
    return;
  }

  const event = await prisma.event.create({
    data: {
      title: def.title,
      description: def.description,
      date,
      location: def.location,
      latitude: def.lat,
      longitude: def.lng,
      event_type: def.eventType,
      game_id: gameId,
      creator_id: admin.id,
      creator_role: 'organizer',
      approval_status: 'approved',
      status: 'approved',
      approved_at: new Date(),
      approved_by: admin.id,
      max_attendees: def.maxAttendees,
      contact_info: def.contactInfo,
      linked_league: def.linkedLeague,
      banner_url: def.bannerUrl,
    },
  });
  console.log(`✅ Event created: "${def.title}" (${event.id})`);
}

async function main() {
  const { dryRun, date } = parseArgs();

  const events = date ? EVENTS.filter(e => e.dateUtc.startsWith(date)) : EVENTS;
  if (events.length === 0) {
    console.error(`No entries in one-off-events.data.ts${date ? ` for date ${date}` : ''}`);
    process.exit(1);
  }
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Processing ${events.length} event(s)${date ? ` for ${date} (UTC)` : ''}\n`
  );

  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true },
  });
  if (!admin) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }
  console.log(`Using admin: ${admin.email} (${admin.id})\n`);

  let failures = 0;
  for (const def of events) {
    try {
      await ensureOneOffEvent(def, admin, dryRun);
    } catch (err) {
      failures++;
      console.error(`❌ Failed to process "${def.title}": ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `\n✅ One-off events template run complete.${failures ? ` (${failures} entr${failures === 1 ? 'y' : 'ies'} failed — see errors above)` : ''}\n`
  );
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
