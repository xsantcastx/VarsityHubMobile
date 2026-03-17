#!/usr/bin/env npx tsx
/**
 * verify-cloudinary.ts
 *
 * Verifies that Cloudinary credentials in server/.env are real and working.
 * Run: cd server && npx tsx scripts/verify-cloudinary.ts
 *
 * Exit 0 = credentials work. Exit 1 = not configured or 401/invalid.
 */

import 'dotenv/config';
import { getCloudinaryCredentials, isCloudinaryConfigured } from '../src/lib/cloudinary.js';

async function main() {
  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary not configured.');
    console.error('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env');
    console.error('   Use real values from Cloudinary Console → API Keys (no quotes, no trailing spaces).');
    process.exit(1);
  }

  try {
    const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();
    const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?max_results=1&prefix=varsityhub`;

    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      const body = await res.text();
      console.error(`❌ Cloudinary API returned ${res.status}: ${body.slice(0, 200)}`);
      if (res.status === 401) {
        console.error('   Fix: Copy API Secret again from Cloudinary Console. No quotes in .env.');
      }
      process.exit(1);
    }

    console.log('✅ Cloudinary credentials verified — real values are working.');
    process.exit(0);
  } catch (e: any) {
    console.error('❌', e?.message || e);
    process.exit(1);
  }
}

main();
