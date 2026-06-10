/**
 * FIFA World Cup 2026 — template-driven event creator.
 *
 * Reads match definitions from worldcup-2026.data.ts and idempotently ensures:
 *   organization → teams → game → linked event
 * for each match. Existing rows (matched by name / title+date) are skipped.
 *
 * Usage:
 *   npx tsx scripts/fifa/create-fifa-events.ts                 # all matches in the data file
 *   npx tsx scripts/fifa/create-fifa-events.ts --date 2026-06-12   # matches kicking off that UTC date
 *   npx tsx scripts/fifa/create-fifa-events.ts --dry-run       # print plan, write nothing
 *
 * Requires DATABASE_URL in environment (or .env file). For production:
 *   DATABASE_URL="$(railway variables --json | jq -r .DATABASE_PUBLIC_URL)" \
 *     npx tsx scripts/fifa/create-fifa-events.ts --date 2026-06-12
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { MATCHES, ORGANIZATION, TEAMS, VENUES, type MatchDef } from './worldcup-2026.data';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'varsityhub00@gmail.com';

// Each team's tournament group, derived from the fixture list. Stored in the
// team description ("Group B — FIFA World Cup 2026") — the org page sections
// its team list by this prefix.
const TEAM_GROUPS: Record<string, string> = {};
for (const m of MATCHES) {
  TEAM_GROUPS[m.home] ??= m.group;
  TEAM_GROUPS[m.away] ??= m.group;
}

function teamDescription(teamKey: string): string | undefined {
  const group = TEAM_GROUPS[teamKey];
  return group ? `${group} — ${ORGANIZATION.name}` : undefined;
}

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

async function ensureOrganization(admin: Admin, dryRun: boolean) {
  const existing = await prisma.organization.findFirst({
    where: { name: ORGANIZATION.name },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(`ℹ️  Organization already exists: "${existing.name}" (${existing.id})`);
    return existing;
  }
  if (dryRun) {
    console.log(`[dry-run] Would create organization "${ORGANIZATION.name}"`);
    return { id: 'dry-run-org', name: ORGANIZATION.name };
  }
  const org = await prisma.$transaction(async tx => {
    const created = await tx.organization.create({
      data: {
        ...ORGANIZATION,
        admin_approved: true,
        approved_at: new Date(),
        approved_by: admin.id,
        league_owner_id: admin.id,
        status: 'active',
      },
      select: { id: true, name: true },
    });
    await tx.organizationMembership.create({
      data: {
        organization_id: created.id,
        user_id: admin.id,
        role: 'owner',
        status: 'active',
      },
    });
    return created;
  });
  console.log(`✅ Organization created: "${org.name}" (${org.id})`);
  return org;
}

async function ensureTeam(orgId: string, teamKey: string, dryRun: boolean): Promise<string> {
  const def = TEAMS[teamKey];
  if (!def) throw new Error(`No TEAMS entry for "${teamKey}" — add it to worldcup-2026.data.ts`);

  const existing = await prisma.team.findFirst({
    where: { name: def.name, organization_id: orgId },
    select: { id: true, name: true, logo_url: true, description: true },
  });
  if (existing) {
    console.log(`ℹ️  Team already exists: "${existing.name}" (${existing.id})`);
    const updates: { logo_url?: string; avatar_url?: string; description?: string } = {};
    if (!existing.logo_url) {
      updates.logo_url = def.logoUrl;
      updates.avatar_url = def.logoUrl;
    }
    const desc = teamDescription(teamKey);
    if (!existing.description && desc) {
      updates.description = desc;
    }
    if (Object.keys(updates).length > 0) {
      if (dryRun) {
        console.log(`   [dry-run] Would backfill: ${Object.keys(updates).join(', ')}`);
      } else {
        await prisma.team.update({ where: { id: existing.id }, data: updates });
        console.log(`   ✅ Backfilled: ${Object.keys(updates).join(', ')}`);
      }
    }
    return existing.id;
  }
  if (dryRun) {
    console.log(`[dry-run] Would create team "${def.name}"`);
    return `dry-run-team-${teamKey}`;
  }
  const team = await prisma.team.create({
    data: {
      name: def.name,
      sport: ORGANIZATION.sport,
      organization_id: orgId,
      city: def.city,
      state: def.state,
      league: ORGANIZATION.name,
      logo_url: def.logoUrl,
      avatar_url: def.logoUrl,
      description: teamDescription(teamKey),
    },
    select: { id: true, name: true },
  });
  console.log(`✅ Team created: "${team.name}" (${team.id})`);
  return team.id;
}

async function ensureMatch(
  match: MatchDef,
  teamIds: Record<string, string>,
  admin: Admin,
  dryRun: boolean
) {
  const venue = VENUES[match.venue];
  if (!venue)
    throw new Error(`No VENUES entry for "${match.venue}" — add it to worldcup-2026.data.ts`);

  const title = `${match.home} vs ${match.away}`;
  const kickoff = new Date(match.kickoffUtc);
  const description = [
    `${ORGANIZATION.name} — ${match.group}, ${match.matchLabel}.`,
    match.note,
    `${venue.name.split(',')[0]} hosts.`,
  ]
    .filter(Boolean)
    .join(' ');

  let game = await prisma.game.findFirst({
    where: { title, date: kickoff },
    select: { id: true, title: true, banner_url: true },
  });

  if (game) {
    console.log(`\nℹ️  Game already exists: "${game.title}" (${game.id})`);
    if (!game.banner_url) {
      if (dryRun) {
        console.log(`   [dry-run] Would backfill stadium banner`);
      } else {
        await prisma.game.update({
          where: { id: game.id },
          data: { banner_url: venue.bannerUrl },
        });
        console.log(`   ✅ Stadium banner backfilled`);
      }
    }
  } else if (dryRun) {
    console.log(`\n[dry-run] Would create game "${title}" @ ${venue.name} on ${match.kickoffUtc}`);
    return;
  } else {
    game = await prisma.game.create({
      data: {
        title,
        description,
        date: kickoff,
        location: venue.name,
        latitude: venue.lat,
        longitude: venue.lng,
        venue_address: venue.address,
        venue_lat: venue.lat,
        venue_lng: venue.lng,
        home_team: match.home,
        away_team: match.away,
        home_team_id: teamIds[match.home],
        away_team_id: teamIds[match.away],
        event_type: 'game',
        approval_status: 'approved',
        approved_at: new Date(),
        approved_by_id: admin.id,
        created_by_id: admin.id,
        expected_attendance: venue.capacity,
        is_neutral: match.isNeutral,
        banner_url: venue.bannerUrl,
      },
      select: { id: true, title: true, banner_url: true },
    });
    console.log(`\n✅ Game created: "${game.title}" (${game.id})`);
  }

  const existingEvent = await prisma.event.findFirst({
    where: { game_id: game.id },
    select: { id: true, banner_url: true },
  });
  if (existingEvent) {
    console.log(`   ℹ️  Event already linked to game`);
    if (!existingEvent.banner_url) {
      if (dryRun) {
        console.log(`   [dry-run] Would backfill event stadium banner`);
      } else {
        await prisma.event.update({
          where: { id: existingEvent.id },
          data: { banner_url: venue.bannerUrl },
        });
        console.log(`   ✅ Event stadium banner backfilled`);
      }
    }
    return;
  }
  const event = await prisma.event.create({
    data: {
      title: `${title} — ${ORGANIZATION.name}`,
      description: `World Cup 2026 ${match.group} at ${venue.name}. ${match.home} takes on ${match.away}. ${match.kickoffLocalNote}`,
      date: kickoff,
      location: venue.name,
      latitude: venue.lat,
      longitude: venue.lng,
      event_type: 'game',
      game_id: game.id,
      creator_id: admin.id,
      creator_role: 'organizer',
      approval_status: 'approved',
      status: 'approved',
      approved_at: new Date(),
      approved_by: admin.id,
      linked_league: ORGANIZATION.name,
      banner_url: venue.bannerUrl,
    },
  });
  console.log(`   Event created: ${event.id}`);
}

async function main() {
  const { dryRun, date } = parseArgs();

  const matches = date ? MATCHES.filter(m => m.kickoffUtc.startsWith(date)) : MATCHES;
  if (matches.length === 0) {
    console.error(`No matches in worldcup-2026.data.ts for date ${date}`);
    process.exit(1);
  }
  console.log(
    `${dryRun ? '[dry-run] ' : ''}Processing ${matches.length} match(es)${date ? ` for ${date} (UTC)` : ''}\n`
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

  const org = await ensureOrganization(admin, dryRun);

  const teamIds: Record<string, string> = {};
  for (const match of matches) {
    for (const key of [match.home, match.away]) {
      if (!teamIds[key]) teamIds[key] = await ensureTeam(org.id, key, dryRun);
    }
  }

  for (const match of matches) {
    await ensureMatch(match, teamIds, admin, dryRun);
  }

  console.log('\n🏆 FIFA World Cup 2026 template run complete.\n');
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
