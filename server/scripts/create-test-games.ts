/**
 * Create Test Games with Coordinates
 * 
 * This script creates sample games with coordinates for testing the map feature.
 */

import { prisma } from '../src/lib/prisma.js';

const testGames = [
  {
    title: 'Lakers vs Warriors',
    date: new Date('2025-11-15T19:00:00'),
    location: 'Madison Square Garden, NYC',
    latitude: 40.750504,
    longitude: -73.993439,
    home_team: 'Lakers',
    away_team: 'Warriors',
    description: 'NBA showdown at MSG',
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
    title: 'Patriots vs Cowboys',
    date: new Date('2025-11-25T13:00:00'),
    location: 'AT&T Stadium, Arlington, TX',
    latitude: 32.747778,
    longitude: -97.092778,
    home_team: 'Cowboys',
    away_team: 'Patriots',
    description: 'NFL Thanksgiving game',
  },
  {
    title: 'Cubs vs Red Sox',
    date: new Date('2025-12-01T18:00:00'),
    location: 'Wrigley Field, Chicago, IL',
    latitude: 41.948376,
    longitude: -87.655334,
    home_team: 'Cubs',
    away_team: 'Red Sox',
    description: 'Historic ballpark matchup',
  },
  {
    title: 'Packers vs Bears',
    date: new Date('2025-12-08T12:00:00'),
    location: 'Lambeau Field, Green Bay, WI',
    latitude: 44.501308,
    longitude: -88.062226,
    home_team: 'Packers',
    away_team: 'Bears',
    description: 'NFC North rivalry',
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
