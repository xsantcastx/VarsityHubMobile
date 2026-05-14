/**
 * Create a pre-onboarded demo account for Apple App Store review.
 *
 * Usage:
 *   npx tsx scripts/create-demo-account.ts
 *
 * Requires DATABASE_URL in environment (or .env file).
 * Safe to re-run — uses upsert.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const DEMO_EMAIL = 'demo@varsityhub.app';
const DEMO_USERNAME = 'appledemo';
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD?.trim();

async function main() {
  if (!DEMO_PASSWORD) {
    console.error(
      'DEMO_ACCOUNT_PASSWORD is required. Set it in the environment before running this script.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const user = await prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: {
        password_hash,
        display_name: 'Demo User',
        username: DEMO_USERNAME,
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          onboarding_completed: true,
          role: 'fan',
          plan: 'rookie',
          affiliation: 'none',
          dob: '2000-01-15',
          notifications: {
            game_event_reminders: false,
            team_updates: false,
            comments_upvotes: false,
            follows_notifications: true,
            messages_notifications: true,
          },
        },
      },
      create: {
        email: DEMO_EMAIL,
        password_hash,
        display_name: 'Demo User',
        username: DEMO_USERNAME,
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          onboarding_completed: true,
          role: 'fan',
          plan: 'rookie',
          affiliation: 'none',
          dob: '2000-01-15',
          notifications: {
            game_event_reminders: false,
            team_updates: false,
            comments_upvotes: false,
            follows_notifications: true,
            messages_notifications: true,
          },
        },
      },
    });

    const existingReviewAd = await prisma.ad.findFirst({
      where: {
        user_id: user.id,
        business_name: 'VarsityHub Review Demo Ad',
      },
      select: { id: true },
    });

    const reviewDemoAdData = {
      user_id: user.id,
      contact_name: 'VarsityHub Review',
      contact_email: DEMO_EMAIL,
      business_name: 'VarsityHub Review Demo Ad',
      banner_url: null,
      banner_fit_mode: 'cover',
      target_url: 'https://www.varsityhub.app',
      target_zip_code: '10001',
      target_lat: 40.7506,
      target_lng: -73.9972,
      radius: 9,
      description:
        'Review-ready approved ad used to verify iOS in-app purchase checkout during App Review.',
      status: 'approved' as const,
      payment_status: 'unpaid' as const,
      admin_note: 'System-seeded review demo ad. Approved to expose ad booking checkout during App Review.',
    };

    if (existingReviewAd) {
      await prisma.ad.update({
        where: { id: existingReviewAd.id },
        data: reviewDemoAdData,
      });
    } else {
      await prisma.ad.create({
        data: reviewDemoAdData,
      });
    }

    console.log('Demo account created/updated successfully:');
    console.log(`  Email:    ${DEMO_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Username: ${DEMO_USERNAME}`);
    console.log(`  User ID:  ${user.id}`);
    console.log('  Review Ad: VarsityHub Review Demo Ad (approved, unpaid)');
    console.log('');
    console.log('For App Store Connect review notes:');
    console.log(`  Email: ${DEMO_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
  } catch (err) {
    console.error('Failed to create demo account:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
