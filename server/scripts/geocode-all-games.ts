/**
 * Geocode All Games Using Google Maps API
 * 
 * This script uses the Google Maps Geocoding API to automatically
 * add latitude/longitude coordinates to all games that have a location
 * but are missing coordinates.
 * 
 * Requirements:
 * - GOOGLE_MAPS_API_KEY environment variable must be set
 * - Games must have a location field with an address
 * 
 * Usage:
 *   npx tsx scripts/geocode-all-games.ts
 */

import { geocodeAllGames } from '../src/lib/geocoding.js';

async function main() {
  console.log('🌍 Starting geocoding process for all games...\n');
  console.log('This will use Google Maps API to find coordinates for games with locations.\n');
  
  // Check for API key
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('❌ ERROR: GOOGLE_MAPS_API_KEY environment variable is not set!');
    console.error('\nPlease add your Google Maps API key to your .env file:');
    console.error('GOOGLE_MAPS_API_KEY=your_api_key_here\n');
    console.error('📖 See docs/EVENT_MAP_COORDINATES_GUIDE.md for setup instructions.');
    process.exit(1);
  }

  try {
    const result = await geocodeAllGames(1000); // Process up to 1000 games
    
    console.log('\n✅ Geocoding Complete!\n');
    console.log(`📊 Results:`);
    console.log(`   - Successfully geocoded: ${result.success} games`);
    console.log(`   - Failed: ${result.failed} games`);
    console.log(`   - Skipped (already had coordinates): ${result.skipped} games`);
    console.log(`   - Total processed: ${result.total} games`);
    
    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered:`);
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err}`);
      });
    }
    
    console.log('\n💡 Tip: Restart your mobile app to see the new markers on the map!');
    
  } catch (error) {
    console.error('❌ Geocoding failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });
