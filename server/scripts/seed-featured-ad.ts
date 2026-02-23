/**
 * Seed Featured Ad for Feed
 *
 * Adds a paid, approved ad with today's reservation so it appears in the feed.
 * Run when: DB was seeded before ad fix, or you need a visible ad for testing.
 *
 * Usage: cd server && npx tsx scripts/seed-featured-ad.ts
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

function isoDate(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

async function main() {
  const today = new Date();
  const todayUTC = isoDate(today);

  // Get first user for ownership
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No users found. Run full seed first: npm run seed');
    process.exit(1);
  }

  const ad = await prisma.ad.create({
    data: {
      user_id: user.id,
      contact_name: 'VarsityHub Demo',
      contact_email: 'support@varsityhub.app',
      business_name: 'Varsity Sports Shop',
      banner_url: 'https://images.unsplash.com/photo-1461896836934-ff607b4f0c67?q=80&w=1280',
      target_url: 'https://instagram.com/varsityhub_',
      target_zip_code: null,
      radius: 45,
      description: 'Gear up for the season. Balls, jerseys, and more.',
      status: 'approved',
      payment_status: 'paid',
    },
  });

  const dates = [todayUTC];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    dates.push(isoDate(d));
  }

  await prisma.adReservation.createMany({
    data: dates.map((date) => ({ ad_id: ad.id, date })),
    skipDuplicates: true,
  });

  console.log('Featured ad created:', ad.id);
  console.log('Reservations:', dates.length, 'days starting today');
  console.log('Ad will appear in Feed immediately.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
