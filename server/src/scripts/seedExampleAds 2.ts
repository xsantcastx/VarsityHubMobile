/**
 * Seed Example Ads
 * 
 * Run this to populate the database with example ads for testing.
 * Usage: npx ts-node server/src/scripts/seedExampleAds.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedExampleAds() {
  console.log('🌱 Seeding example ads...');

  try {
    // Example 1: Stamford Skate Shop
    const skateboardAd = await prisma.ad.upsert({
      where: { id: 'example-skateboard-shop-1' },
      update: {},
      create: {
        id: 'example-skateboard-shop-1',
        business_name: 'Stamford Skate Shop',
        contact_name: 'Shop Manager',
        contact_email: 'info@stamfordskate.com',
        description: 'Gear up & ride! Skateboards, shoes, apparel, accessories. Shop now for the latest boards and gear!',
        banner_url: 'https://example.com/ads/skateboard-shop-banner.jpg', // Replace with your CDN URL
        banner_fit_mode: 'fill',
        target_url: 'https://stamfordskate.com',
        target_zip_code: '06901',
        radius: 45,
        status: 'approved',
        payment_status: 'paid',
      },
    });

    console.log('✅ Created/updated skateboard shop ad:', skateboardAd.id);

    // Create a reservation for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservation = await prisma.adReservation.create({
      data: {
        ad_id: skateboardAd.id,
        date: today,
      },
    });

    console.log('✅ Created reservation for today:', reservation.id);

    // You can add more example ads here...

    console.log('🎉 Example ads seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding example ads:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedExampleAds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
