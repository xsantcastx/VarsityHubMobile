/**
 * Wipe all user data and posts from production database + Cloudinary media.
 * Preserves schema, promo codes, and categories.
 *
 * Usage: cd server && npx tsx scripts/wipe-production.ts --confirm
 * Or from Railway (where DB is reachable): railway run npx tsx scripts/wipe-production.ts --confirm
 */

import { PrismaClient } from '@prisma/client';
import { wipeCloudinary, wipeDatabase } from '../src/lib/wipeProduction.js';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Run via: railway run npx tsx scripts/wipe-production.ts');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('\n⚠️  This will DELETE all users, posts, teams, games, messages, and media from the database.');
  console.log('   Categories and promo codes will be preserved.\n');
  console.log('   To proceed, run with --confirm flag:\n');
  console.log('   railway run npx tsx scripts/wipe-production.ts --confirm\n');
  process.exit(0);
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

async function main() {
  try {
    console.log('🗑️  Wiping database (preserving schema, categories, promo codes)...\n');
    const dbResult = await wipeDatabase(prisma);
    for (const [name, count] of Object.entries(dbResult.deleted)) {
      console.log(`   ${count > 0 ? '✅' : '⏭️'} ${name}: ${count} rows`);
    }
    console.log('\n✅ Database wipe complete.\n');

    console.log('🗑️  Wiping Cloudinary media in varsityhub/ folder...');
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      console.log('⚠️  Cloudinary credentials not set, skipping media wipe.');
    } else {
      const cloudResult = await wipeCloudinary();
      console.log(`   ✅ Deleted ${cloudResult.deleted} Cloudinary resources.`);
    }
    console.log('\n🎉 Production wipe complete. Clean slate ready.');
  } catch (err) {
    console.error('\n❌ Error during wipe:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
