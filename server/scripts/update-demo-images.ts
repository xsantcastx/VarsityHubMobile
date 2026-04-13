/**
 * Update cover/banner images for the two demo matchup Games.
 *
 * Images are already in Cloudinary — this script just updates the DB records.
 *
 * Usage:
 *   cd server && railway run npx tsx scripts/update-demo-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TAG = '[DEMO_MATCHUP]';

// Duke v UNC → Oracle Arena crowd photo (basketball arena, yellow crowd)
const DUKE_UNC_IMAGE =
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto/f_auto/v1776111005/convert_dauk3b.webp';

// Cavs v Warriors → Duke Wallace Wade Stadium (football field, blue seats)
const CAVS_WARRIORS_IMAGE =
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto/f_auto/v1776111005/unnamed_yhflhv.jpg';

async function main() {
  console.log('[update-demo-images] Updating demo game images...');
  console.log(`  DB: ${maskUrl(process.env.DATABASE_URL)}\n`);

  // Duke v UNC
  const dukeUnc = await prisma.game.findFirst({
    where: { title: 'Duke Blue Devils vs. UNC Tar Heels', description: { contains: DEMO_TAG } },
    select: { id: true, title: true, cover_image_url: true, banner_url: true },
  });

  if (!dukeUnc) {
    console.error('Game not found: "Duke Blue Devils vs. UNC Tar Heels" — run seed-demo-matchups.ts first');
    process.exit(1);
  }

  await prisma.game.update({
    where: { id: dukeUnc.id },
    data: { cover_image_url: DUKE_UNC_IMAGE, banner_url: DUKE_UNC_IMAGE },
  });
  console.log(`  ✓ ${dukeUnc.title}`);
  console.log(`    cover: ${DUKE_UNC_IMAGE}`);
  console.log(`    banner: ${DUKE_UNC_IMAGE}`);

  // Cavs v Warriors
  const cavsWarriors = await prisma.game.findFirst({
    where: { title: 'Cleveland Cavaliers vs. Golden State Warriors', description: { contains: DEMO_TAG } },
    select: { id: true, title: true, cover_image_url: true, banner_url: true },
  });

  if (!cavsWarriors) {
    console.error('Game not found: "Cleveland Cavaliers vs. Golden State Warriors" — run seed-demo-matchups.ts first');
    process.exit(1);
  }

  await prisma.game.update({
    where: { id: cavsWarriors.id },
    data: { cover_image_url: CAVS_WARRIORS_IMAGE, banner_url: CAVS_WARRIORS_IMAGE },
  });
  console.log(`\n  ✓ ${cavsWarriors.title}`);
  console.log(`    cover: ${CAVS_WARRIORS_IMAGE}`);
  console.log(`    banner: ${CAVS_WARRIORS_IMAGE}`);

  console.log('\nDone! Both demo events updated. Open the app to see the new images.');
}

function maskUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  return url.replace(/:[^:@/]*@/, ':***@');
}

main()
  .catch((err) => {
    console.error('[update-demo-images] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
