import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function seedTournament() {
  console.log('🏆 Seeding FIFA World Cup Tournament...');

  // Create Tournament Organization
  const tournament = await prisma.organization.upsert({
    where: { id: 'fifa-world-cup-2026-guadalajara' },
    update: {},
    create: {
      id: 'fifa-world-cup-2026-guadalajara',
      name: 'FIFA World Cup 2026',
      description: 'FIFA World Cup Group Stage - International Football Tournament',
      location: 'Jalisco, Mexico',
      latitude: 20.5239,
      longitude: -103.3117,
      is_tournament: true,
      tournament_format: 'GROUP_STAGE',
      tournament_start_date: new Date('2026-06-11'),
      tournament_end_date: new Date('2026-06-26'),
      tournament_location: 'Estadio Akron, Guadalajara, Jalisco, Mexico',
      stadium_name: 'Estadio Akron',
      capacity: 48000,
      tournament_logo_url: null,
      type: 'tournament',
      status: 'active',
    },
  });

  console.log(`✓ Tournament created: ${tournament.name} (ID: ${tournament.id})`);

  // Create Games for each match
  const games = [
    {
      home_team: 'South Korea',
      away_team: 'UEFA Path D',
      date: new Date('2026-06-11T22:00:00Z'), // 10:00 PM ET
      location: 'Guadalajara, Mexico',
      stadium: 'Estadio Akron',
      latitude: 20.5239,
      longitude: -103.3117,
      status: 'SCHEDULED' as const,
      group: 'A',
      tournament_path: 'UEFA_PATH_D',
    },
    {
      home_team: 'Mexico',
      away_team: 'South Korea',
      date: new Date('2026-06-18T21:00:00Z'), // 9:00 PM ET
      location: 'Guadalajara, Mexico',
      stadium: 'Estadio Akron',
      latitude: 20.5239,
      longitude: -103.3117,
      status: 'SCHEDULED' as const,
      group: 'A',
      tournament_path: null,
    },
    {
      home_team: 'Colombia',
      away_team: 'FIFA Path 1',
      date: new Date('2026-06-23T22:00:00Z'), // 10:00 PM ET
      location: 'Guadalajara, Mexico',
      stadium: 'Estadio Akron',
      latitude: 20.5239,
      longitude: -103.3117,
      status: 'SCHEDULED' as const,
      group: 'K',
      tournament_path: 'FIFA_PATH_1',
    },
    {
      home_team: 'Uruguay',
      away_team: 'Spain',
      date: new Date('2026-06-26T20:00:00Z'), // 8:00 PM ET
      location: 'Guadalajara, Mexico',
      stadium: 'Estadio Akron',
      latitude: 20.5239,
      longitude: -103.3117,
      status: 'SCHEDULED' as const,
      group: 'H',
      tournament_path: null,
    },
  ];

  for (const gameData of games) {
    const gameId = `fifa-${gameData.home_team.toLowerCase().replace(/\s+/g, '-')}-vs-${gameData.away_team.toLowerCase().replace(/\s+/g, '-')}-${gameData.date.getTime()}`;
    
    const game = await prisma.game.upsert({
      where: { id: gameId },
      update: { tournament_organization_id: tournament.id },
      create: {
        id: gameId,
        title: `${gameData.home_team} vs ${gameData.away_team}`,
        home_team: gameData.home_team,
        away_team: gameData.away_team,
        date: gameData.date,
        location: gameData.location,
        stadium: gameData.stadium,
        latitude: gameData.latitude,
        longitude: gameData.longitude,
        approval_status: 'approved',
        tournament_organization_id: tournament.id,
        group: gameData.group,
        banner_image_url: 'data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%271568%27 height=%27882%27%3E%3Cdefs%3E%3ClinearGradient id=%27grad%27 x1=%270%25%27 y1=%270%25%27 x2=%27100%25%27 y2=%27100%25%27%3E%3Cstop offset=%270%25%27 style=%27stop-color:%231e40af;stop-opacity:1%27 /%3E%3Cstop offset=%2750%25%27 style=%27stop-color:%23dc2626;stop-opacity:1%27 /%3E%3Cstop offset=%27100%25%27 style=%27stop-color:%23fbbf24;stop-opacity:1%27 /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width=%271568%27 height=%27882%27 fill=%27url(%23grad)%27/%3E%3Ctext x=%2750%25%27 y=%2740%25%27 dominant-baseline=%27middle%27 text-anchor=%27middle%27 font-size=%2780%27 font-weight=%27bold%27 fill=%27white%27 font-family=%27Arial%27%3EGuadalajara%3C/text%3E%3Ctext x=%2750%25%27 y=%2755%25%27 dominant-baseline=%27middle%27 text-anchor=%27middle%27 font-size=%2760%27 fill=%27white%27 font-family=%27Arial%27%3EEstadio Akron%3C/text%3E%3Ctext x=%2750%25%27 y=%2770%25%27 dominant-baseline=%27middle%27 text-anchor=%27middle%27 font-size=%2748%27 fill=%27white%27 font-family=%27Arial%27%3EFIFA World Cup 2026%3C/text%3E%3C/svg%3E',
      },
    });

    console.log(`✓ Game created: ${gameData.home_team} vs ${gameData.away_team} - ${gameData.date.toISOString()}`);
  }

  console.log('\n✅ FIFA World Cup Tournament seeded successfully!');
  console.log(`Tournament ID: ${tournament.id}`);
  console.log(`Total Matches: ${games.length}`);
}

seedTournament()
  .catch((e) => {
    console.error('Error seeding tournament:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
