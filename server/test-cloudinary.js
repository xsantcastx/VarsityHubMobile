/**
 * Quick test script to verify Cloudinary uploads are working
 * 
 * Usage:
 *   node test-cloudinary.js
 * 
 * This will:
 * 1. Check if Cloudinary is configured
 * 2. Upload a test image to Cloudinary
 * 3. Display the resulting URL
 */

import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('🧪 Testing Cloudinary Configuration...\n');

// Check configuration
const isConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (!isConfigured) {
  console.error('❌ Cloudinary is not configured!');
  console.error('Please set these environment variables:');
  console.error('  - CLOUDINARY_CLOUD_NAME');
  console.error('  - CLOUDINARY_API_KEY');
  console.error('  - CLOUDINARY_API_SECRET');
  process.exit(1);
}

console.log('✅ Cloudinary environment variables found:');
console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY?.substring(0, 8)}...`);
console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET?.substring(0, 8)}...\n`);

// Test upload with a simple base64 image (1x1 red pixel)
const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

console.log('📤 Uploading test image to Cloudinary...\n');

try {
  const result = await cloudinary.uploader.upload(testImage, {
    folder: process.env.NODE_ENV === 'production' ? 'varsityhub-prod' : 'varsityhub-dev',
    resource_type: 'image',
    public_id: `test-${Date.now()}`,
  });

  console.log('✅ Upload successful!\n');
  console.log('📊 Upload Details:');
  console.log(`   Public ID: ${result.public_id}`);
  console.log(`   URL: ${result.secure_url}`);
  console.log(`   Format: ${result.format}`);
  console.log(`   Width: ${result.width}px`);
  console.log(`   Height: ${result.height}px`);
  console.log(`   Size: ${result.bytes} bytes`);
  console.log(`   Created: ${result.created_at}\n`);

  console.log('🎉 Cloudinary is working correctly!');
  console.log('You can now upload images through your app.\n');

  // Clean up test image (optional)
  console.log('🧹 Cleaning up test image...');
  await cloudinary.uploader.destroy(result.public_id);
  console.log('✅ Test image deleted from Cloudinary\n');

} catch (error) {
  console.error('❌ Upload failed!');
  console.error('Error:', error.message);
  if (error.http_code) {
    console.error('HTTP Code:', error.http_code);
  }
  process.exit(1);
}
