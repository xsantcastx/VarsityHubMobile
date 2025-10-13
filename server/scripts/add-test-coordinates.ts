/**
 * Add Test Coordinates to Games
 * 
 * This script adds latitude/longitude to existing games for testing the map feature.
 */

import { prisma } from '../src/lib/prisma.js';

// Sample coordinates for various US sports venues
const testVenues = [
  { name: 'Madison Square Garden, NYC', lat: 40.750504, lng: -73.993439 },
  { name: 'Stanford Stadium, Palo Alto, CA', lat: 37.434926, lng: -122.161491 },
  { name: 'Rose Bowl, Pasadena, CA', lat: 34.161174, lng: -118.167599 },
  { name: 'Soldier Field, Chicago, IL', lat: 41.862373, lng: -87.616706 },
  { name: 'Fenway Park, Boston, MA', lat: 42.346676, lng: -71.097218 },
  { name: 'AT&T Stadium, Arlington, TX', lat: 32.747778, lng: -97.092778 },
  { name: 'Lambeau Field, Green Bay, WI', lat: 44.501308, lng: -88.062226 },
  { name: 'MetLife Stadium, East Rutherford, NJ', lat: 40.813611, lng: -74.074444 },
  { name: 'Dodger Stadium, Los Angeles, CA', lat: 34.073851, lng: -118.239964 },
  { name: 'Wrigley Field, Chicago, IL', lat: 41.948376, lng: -87.655334 },
];

async function addTestCoordinates() {
  console.log('🗺️  Adding test coordinates to games...\n');

  try {
    // Get all games without coordinates
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: {
        id: true,
        title: true,
        location: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 20, // Only update first 20 games
    });

    if (games.length === 0) {
      console.log('✅ All games already have coordinates!');
      return;
    }

    console.log(`Found ${games.length} games without coordinates\n`);

    let updated = 0;
    for (const game of games) {
      // Pick a random venue from our test data
      const venue = testVenues[Math.floor(Math.random() * testVenues.length)];

      try {
        await prisma.game.update({
          where: { id: game.id },
          data: {
            latitude: venue.lat,
            longitude: venue.lng,
            // Optionally update location if it's empty
            ...((!game.location || game.location.trim() === '') && {
              location: venue.name,
            }),
          },
        });

        console.log(`✅ Updated: "${game.title || 'Untitled'}"`);
        console.log(`   Location: ${game.location || venue.name}`);
        console.log(`   Coordinates: ${venue.lat}, ${venue.lng}\n`);

        updated++;
      } catch (err) {
        console.error(`❌ Failed to update game ${game.id}:`, err);
      }
    }

    console.log(`\n🎉 Successfully updated ${updated}/${games.length} games with coordinates!`);
    console.log('\n📍 Next steps:');
    console.log('1. Reload your app (shake device → Reload)');
    console.log('2. Go to Discover tab');
    console.log('3. Click the map icon');
    console.log('4. You should now see markers on the map!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addTestCoordinates()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
