/**
 * Update cover/banner images for the two demo matchup Games.
 *
 * Images are already in Cloudinary — this script just updates the DB records.
 * Titles must match the fictional demo matchups defined in seed-demo-matchups.ts.
 *
 * Usage:
 *   cd server && railway run npx tsx scripts/update-demo-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TAG = '[DEMO_MATCHUP]';

// Riverside v Lakeside → demo arena photo (owned by us, hosted on Cloudinary)
const RIVERSIDE_LAKESIDE_IMAGE =
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776111005/convert_dauk3b.webp';

// Harbor City v Summit → demo stadium photo (owned by us, hosted on Cloudinary)
const HARBOR_SUMMIT_IMAGE =
  'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776113584/IMG_5935_qazitw.jpg';

async function main() {
  console.log('[update-demo-images] Updating demo game images...');
  console.log(`  DB: ${maskUrl(process.env.DATABASE_URL)}\n`);

  // Riverside v Lakeside
  const riversideLakeside = await prisma.game.findFirst({
    where: { title: 'Riverside Ravens vs. Lakeside Lions', description: { contains: DEMO_TAG } },
    select: { id: true, title: true, cover_image_url: true, banner_url: true },
  });

  if (!riversideLakeside) {
    console.error('Game not found: "Riverside Ravens vs. Lakeside Lions" — run seed-demo-matchups.ts first');
    process.exit(1);
  }

  await prisma.game.update({
    where: { id: riversideLakeside.id },
    data: { cover_image_url: RIVERSIDE_LAKESIDE_IMAGE, banner_url: RIVERSIDE_LAKESIDE_IMAGE },
  });
  console.log(`  ✓ ${riversideLakeside.title}`);
  console.log(`    cover: ${RIVERSIDE_LAKESIDE_IMAGE}`);
  console.log(`    banner: ${RIVERSIDE_LAKESIDE_IMAGE}`);

  // Harbor City v Summit
  const harborSummit = await prisma.game.findFirst({
    where: { title: 'Harbor City Hawks vs. Summit Storm', description: { contains: DEMO_TAG } },
    select: { id: true, title: true, cover_image_url: true, banner_url: true },
  });

  if (!harborSummit) {
    console.error('Game not found: "Harbor City Hawks vs. Summit Storm" — run seed-demo-matchups.ts first');
    process.exit(1);
  }

  await prisma.game.update({
    where: { id: harborSummit.id },
    data: { cover_image_url: HARBOR_SUMMIT_IMAGE, banner_url: HARBOR_SUMMIT_IMAGE },
  });
  console.log(`\n  ✓ ${harborSummit.title}`);
  console.log(`    cover: ${HARBOR_SUMMIT_IMAGE}`);
  console.log(`    banner: ${HARBOR_SUMMIT_IMAGE}`);

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
