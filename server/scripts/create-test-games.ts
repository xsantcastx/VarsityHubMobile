/**
 * Create Test Games with Coordinates
 * 
 * This script creates sample games with coordinates for testing the map feature.
 */

import { prisma } from '../src/lib/prisma.js';

const testGames = [
  {
    title: 'Westhill Warriors vs Stamford Knights',
    date: new Date('2025-11-15T19:00:00'),
    location: 'Westhill High School, Stamford, CT',
    latitude: 41.0834,
    longitude: -73.5587,
    home_team: 'Westhill Warriors',
    away_team: 'Stamford Knights',
    description: 'FCIAC conference basketball game',
  },
  {
    title: 'Stanford vs Cal',
    date: new Date('2025-11-20T14:00:00'),
    location: 'Stanford Stadium, Palo Alto, CA',
    latitude: 37.434926,
    longitude: -122.161491,
    home_team: 'Stanford',
    away_team: 'Cal',
    description: 'Big Game rivalry',
  },
  {
    title: 'Lincoln Lions vs Jefferson Jaguars',
    date: new Date('2025-11-25T18:00:00'),
    location: 'Lincoln High School, Dallas, TX',
    latitude: 32.747778,
    longitude: -97.092778,
    home_team: 'Lincoln Lions',
    away_team: 'Jefferson Jaguars',
    description: 'District playoff game',
  },
  {
    title: 'North Side Wolves vs South Side Falcons',
    date: new Date('2025-12-01T18:00:00'),
    location: 'North Side High School, Chicago, IL',
    latitude: 41.948376,
    longitude: -87.655334,
    home_team: 'North Side Wolves',
    away_team: 'South Side Falcons',
    description: 'City championship semifinal',
  },
  {
    title: 'Bay Port Pirates vs Pulaski Red Raiders',
    date: new Date('2025-12-08T19:00:00'),
    location: 'Bay Port High School, Green Bay, WI',
    latitude: 44.501308,
    longitude: -88.062226,
    home_team: 'Bay Port Pirates',
    away_team: 'Pulaski Red Raiders',
    description: 'FRCC conference matchup',
  },
];

async function createTestGames() {
  console.log('🏈 Creating test games with coordinates...\n');

  try {
    let created = 0;
    for (const gameData of testGames) {
      try {
        const game = await prisma.game.create({
          data: gameData,
        });

        console.log(`✅ Created: "${game.title}"`);
        console.log(`   Location: ${game.location}`);
        console.log(`   Coordinates: ${gameData.latitude}, ${gameData.longitude}`);
        console.log(`   Date: ${game.date.toLocaleDateString()}\n`);

        created++;
      } catch (err: any) {
        console.error(`❌ Failed to create "${gameData.title}":`, err.message);
      }
    }

    console.log(`\n🎉 Successfully created ${created}/${testGames.length} test games!`);
    console.log('\n📍 Next steps:');
    console.log('1. Reload your app');
    console.log('2. Go to Discover tab');
    console.log('3. Click the map icon');
    console.log(`4. You should see ${created} markers spread across the US!\n`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createTestGames()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
