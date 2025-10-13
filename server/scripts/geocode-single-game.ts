/**
 * Geocode a Single Game by ID
 * 
 * Quick script to geocode one specific game.
 */

import { geocodeGame } from '../src/lib/geocoding.js';
import { prisma } from '../src/lib/prisma.js';

async function geocodeSingleGame() {
  const gameId = process.argv[2];
  
  if (!gameId) {
    console.error('❌ Please provide a game ID');
    console.error('Usage: npx tsx scripts/geocode-single-game.ts <gameId>');
    process.exit(1);
  }

  console.log(`🌍 Geocoding game: ${gameId}\n`);

  try {
    // Get game details first
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { id: true, title: true, location: true, latitude: true, longitude: true },
    });

    if (!game) {
      console.error('❌ Game not found');
      process.exit(1);
    }

    console.log(`📋 Game: "${game.title}"`);
    console.log(`📍 Location: ${game.location}`);
    
    if (game.latitude && game.longitude) {
      console.log(`\n✅ Game already has coordinates: ${game.latitude}, ${game.longitude}`);
      process.exit(0);
    }

    if (!game.location) {
      console.error('\n❌ Game has no location to geocode');
      process.exit(1);
    }

    console.log('\n🔍 Geocoding...');
    const result = await geocodeGame(gameId, game.location);

    if (result) {
      console.log('\n✅ Success!');
      console.log(`   Latitude: ${result.latitude}`);
      console.log(`   Longitude: ${result.longitude}`);
      console.log('\n💡 Reload your mobile app to see the marker on the map!');
    } else {
      console.error('\n❌ Geocoding failed');
      console.error('   Check if the location is valid');
      console.error('   Make sure GOOGLE_MAPS_API_KEY is set');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

geocodeSingleGame()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });
