/**
 * Check Games with Coordinates
 * 
 * Quick script to verify which games have coordinates in the database.
 */

import { prisma } from '../src/lib/prisma.js';

async function checkCoordinates() {
  console.log('📍 Checking games with coordinates...\n');

  try {
    // Get all games
    const allGames = await prisma.game.findMany({
      select: {
        id: true,
        title: true,
        location: true,
        latitude: true,
        longitude: true,
        date: true,
      },
      orderBy: {
        date: 'desc',
      },
    });

    console.log(`Total games in database: ${allGames.length}\n`);

    // Games with coordinates
    const withCoords = allGames.filter(g => g.latitude !== null && g.longitude !== null);
    console.log(`✅ Games with coordinates: ${withCoords.length}`);
    
    withCoords.forEach((game, idx) => {
      console.log(`\n${idx + 1}. "${game.title}"`);
      console.log(`   Location: ${game.location}`);
      console.log(`   Coordinates: ${game.latitude}, ${game.longitude}`);
      console.log(`   Date: ${game.date.toLocaleDateString()}`);
    });

    // Games without coordinates
    const withoutCoords = allGames.filter(g => g.latitude === null || g.longitude === null);
    if (withoutCoords.length > 0) {
      console.log(`\n\n❌ Games WITHOUT coordinates: ${withoutCoords.length}`);
      withoutCoords.forEach((game, idx) => {
        console.log(`\n${idx + 1}. "${game.title}"`);
        console.log(`   Location: ${game.location || 'No location'}`);
        console.log(`   ID: ${game.id}`);
      });
    }

    console.log('\n---\n');
    
    if (withCoords.length === 0) {
      console.log('⚠️  NO GAMES HAVE COORDINATES!');
      console.log('\nTo fix this, run:');
      console.log('  npx tsx scripts/add-test-coordinates.ts');
      console.log('  npx tsx scripts/create-test-games.ts');
    } else {
      console.log('✅ All set! Games have coordinates and should appear on the map.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCoordinates()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  });
