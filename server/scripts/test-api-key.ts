/**
 * Test Google Maps API Key
 * 
 * Quick test to verify your Google Maps API key is working.
 */

import { geocodeLocation } from '../src/lib/geocoding.js';

async function testApiKey() {
  console.log('🔑 Testing Google Maps API Key...\n');

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('❌ ERROR: GOOGLE_MAPS_API_KEY not found in environment variables!');
    process.exit(1);
  }

  console.log('✅ API Key found in .env file');
  console.log(`   Key starts with: ${process.env.GOOGLE_MAPS_API_KEY.substring(0, 10)}...\n`);

  console.log('📍 Testing geocoding with a known location...');
  console.log('   Location: "Madison Square Garden, New York"\n');

  try {
    const result = await geocodeLocation('Madison Square Garden, New York');
    
    if (!result) {
      console.error('❌ No results returned from geocoding API');
      process.exit(1);
    }
    
    console.log('✅ SUCCESS! API key is working!\n');
    console.log('📊 Result:');
    console.log(`   Latitude: ${result.latitude}`);
    console.log(`   Longitude: ${result.longitude}`);
    console.log(`   Formatted Address: ${result.formatted_address}\n`);
    console.log('🎉 Your Google Maps API is configured correctly!');
    console.log('💡 You can now run: npx tsx scripts/geocode-all-games.ts');
    
  } catch (error: any) {
    console.error('❌ FAILED! API key test failed.\n');
    console.error('Error:', error.message);
    
    if (error.message.includes('REQUEST_DENIED')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Make sure you enabled the Geocoding API in Google Cloud Console');
      console.error('   2. Check if your API key has restrictions that block the Geocoding API');
      console.error('   3. Wait a few minutes for the API key to activate (new keys can take time)');
    } else if (error.message.includes('INVALID_REQUEST')) {
      console.error('\n💡 The API key might be invalid. Double-check the key in your .env file.');
    }
    
    process.exit(1);
  }
}

testApiKey()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Unhandled error:', err);
    process.exit(1);
  });
