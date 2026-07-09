/**
 * Create International Cup 2026 organization and Group A games (June 11)
 *
 * Games:
 *   Match 1 — Mexico vs South Africa, Estadio Azteca, Mexico City, 3:00 PM EDT
 *   Match 2 — South Korea vs Czechia, Estadio Akron, Guadalajara, 10:00 PM EDT
 *
 * Usage:
 *   npx tsx scripts/create-fifa-worldcup-2026.ts
 *
 * Requires DATABASE_URL in environment (or .env file).
 * Safe to re-run — checks for existing org/games by name before creating.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'varsityhub00@gmail.com';

// Real venue coordinates
// Estadio Azteca — Mexico City, Mexico
const AZTECA_LAT = 19.303;
const AZTECA_LNG = -99.1506;

// Estadio Akron — Zapopan, Guadalajara, Mexico
const AKRON_LAT = 20.6859;
const AKRON_LNG = -103.4667;

async function main() {
  // Resolve super admin user
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, display_name: true },
  });
  if (!admin) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}`);
    process.exit(1);
  }
  console.log(`Using admin: ${admin.email} (${admin.id})\n`);

  // ── 1. Create or reuse International Cup 2026 organization ──────────────────
  let org = await prisma.organization.findFirst({
    where: { name: 'International Cup 2026' },
    select: { id: true, name: true },
  });

  if (org) {
    console.log(`ℹ️  Organization already exists: "${org.name}" (${org.id})`);
  } else {
    org = await prisma.$transaction(async tx => {
      const created = await tx.organization.create({
        data: {
          name: 'International Cup 2026',
          description:
            'The 23rd International Cup, co-hosted by Canada, Mexico, and the United States from June 11 – July 19, 2026. Featuring 48 nations across 16 host cities.',
          sport: 'Soccer',
          org_type: 'league',
          location: 'United States, Canada & Mexico',
          admin_approved: true,
          approved_at: new Date(),
          approved_by: admin.id,
          league_owner_id: admin.id,
          status: 'active',
        },
        select: { id: true, name: true },
      });

      // Make admin the owner member
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
  }

  // ── 2. Create teams ───────────────────────────────────────────────────────
  const teamDefs = [
    { name: 'Mexico', sport: 'Soccer', city: 'Mexico City', state: 'Mexico' },
    { name: 'South Africa', sport: 'Soccer', city: 'Johannesburg', state: 'South Africa' },
    { name: 'South Korea', sport: 'Soccer', city: 'Seoul', state: 'South Korea' },
    { name: 'Czechia', sport: 'Soccer', city: 'Prague', state: 'Czech Republic' },
  ];

  const teamMap: Record<string, string> = {};
  for (const def of teamDefs) {
    let team = await prisma.team.findFirst({
      where: { name: def.name, organization_id: org.id },
      select: { id: true, name: true },
    });
    if (!team) {
      team = await prisma.team.create({
        data: {
          name: def.name,
          sport: def.sport,
          organization_id: org.id,
          city: def.city,
          state: def.state,
          league: 'International Cup 2026',
        },
        select: { id: true, name: true },
      });
      console.log(`✅ Team created: "${team.name}" (${team.id})`);
    } else {
      console.log(`ℹ️  Team already exists: "${team.name}" (${team.id})`);
    }
    teamMap[def.name] = team.id;
  }

  // ── 3. Match 1 — Mexico vs South Africa ──────────────────────────────────
  // June 11, 2026 at 3:00 PM EDT = 19:00 UTC
  const match1Date = new Date('2026-06-11T19:00:00.000Z');

  let game1 = await prisma.game.findFirst({
    where: { title: 'Mexico vs South Africa', date: match1Date },
    select: { id: true, title: true },
  });

  if (game1) {
    console.log(`\nℹ️  Game already exists: "${game1.title}" (${game1.id})`);
  } else {
    game1 = await prisma.game.create({
      data: {
        title: 'Mexico vs South Africa',
        description:
          'International Cup 2026 — Group A, Match 1. The opening match of the tournament. Estadio Azteca becomes the first venue to host three International Cup opening matches.',
        date: match1Date,
        location: 'Estadio Azteca, Mexico City, Mexico',
        latitude: AZTECA_LAT,
        longitude: AZTECA_LNG,
        venue_address:
          'Calzada de Tlalpan 3465, Santa Úrsula Coapa, Coyoacán, 04650 Ciudad de México, CDMX, Mexico',
        venue_lat: AZTECA_LAT,
        venue_lng: AZTECA_LNG,
        home_team: 'Mexico',
        away_team: 'South Africa',
        home_team_id: teamMap['Mexico'],
        away_team_id: teamMap['South Africa'],
        event_type: 'game',
        approval_status: 'approved',
        approved_at: new Date(),
        approved_by_id: admin.id,
        created_by_id: admin.id,
        expected_attendance: 87523,
        is_neutral: false,
      },
      select: { id: true, title: true },
    });
    console.log(`\n✅ Game created: "${game1.title}" (${game1.id})`);
  }

  // Associated event for Match 1
  const existingEvent1 = await prisma.event.findFirst({
    where: { game_id: game1.id },
    select: { id: true },
  });
  if (!existingEvent1) {
    const event1 = await prisma.event.create({
      data: {
        title: 'Mexico vs South Africa — International Cup 2026',
        description:
          'International Cup 2026 Group A opener at Estadio Azteca in Mexico City. Mexico takes on South Africa in the first match of the tournament. Kickoff: 3:00 PM EDT / 2:00 PM CDT.',
        date: match1Date,
        location: 'Estadio Azteca, Mexico City, Mexico',
        latitude: AZTECA_LAT,
        longitude: AZTECA_LNG,
        event_type: 'game',
        game_id: game1.id,
        creator_id: admin.id,
        creator_role: 'organizer',
        approval_status: 'approved',
        status: 'approved',
        approved_at: new Date(),
        approved_by: admin.id,
        linked_league: 'International Cup 2026',
      },
    });
    console.log(`   Event created: ${event1.id}`);
  } else {
    console.log(`   ℹ️  Event already linked to game`);
  }

  // ── 4. Match 2 — South Korea vs Czechia ──────────────────────────────────
  // June 11, 2026 at 10:00 PM EDT = June 12 02:00 UTC
  const match2Date = new Date('2026-06-12T02:00:00.000Z');

  let game2 = await prisma.game.findFirst({
    where: { title: 'South Korea vs Czechia', date: match2Date },
    select: { id: true, title: true },
  });

  if (game2) {
    console.log(`\nℹ️  Game already exists: "${game2.title}" (${game2.id})`);
  } else {
    game2 = await prisma.game.create({
      data: {
        title: 'South Korea vs Czechia',
        description:
          'International Cup 2026 — Group A, Match 2. Estadio Akron in Guadalajara, Mexico. Kickoff at 8:00 PM local time.',
        date: match2Date,
        location: 'Estadio Akron, Zapopan, Guadalajara, Mexico',
        latitude: AKRON_LAT,
        longitude: AKRON_LNG,
        venue_address: 'Av. Paseo Royal Country 4601, Royal Country, 45116 Zapopan, Jal., Mexico',
        venue_lat: AKRON_LAT,
        venue_lng: AKRON_LNG,
        home_team: 'South Korea',
        away_team: 'Czechia',
        home_team_id: teamMap['South Korea'],
        away_team_id: teamMap['Czechia'],
        event_type: 'game',
        approval_status: 'approved',
        approved_at: new Date(),
        approved_by_id: admin.id,
        created_by_id: admin.id,
        expected_attendance: 46732,
        is_neutral: true,
      },
      select: { id: true, title: true },
    });
    console.log(`\n✅ Game created: "${game2.title}" (${game2.id})`);
  }

  // Associated event for Match 2
  const existingEvent2 = await prisma.event.findFirst({
    where: { game_id: game2.id },
    select: { id: true },
  });
  if (!existingEvent2) {
    const event2 = await prisma.event.create({
      data: {
        title: 'South Korea vs Czechia — International Cup 2026',
        description:
          'International Cup 2026 Group A at Estadio Akron in Guadalajara. South Korea faces Czechia in their opening match. Kickoff: 10:00 PM EDT / 8:00 PM MDT.',
        date: match2Date,
        location: 'Estadio Akron, Zapopan, Guadalajara, Mexico',
        latitude: AKRON_LAT,
        longitude: AKRON_LNG,
        event_type: 'game',
        game_id: game2.id,
        creator_id: admin.id,
        creator_role: 'organizer',
        approval_status: 'approved',
        status: 'approved',
        approved_at: new Date(),
        approved_by: admin.id,
        linked_league: 'International Cup 2026',
      },
    });
    console.log(`   Event created: ${event2.id}`);
  } else {
    console.log(`   ℹ️  Event already linked to game`);
  }

  console.log('\n🏆 International Cup 2026 setup complete.\n');
  console.log(`Organization: ${org.id}`);
  console.log(`Match 1 (Mexico vs South Africa): ${game1.id}`);
  console.log(`Match 2 (South Korea vs Czechia):  ${game2.id}`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
