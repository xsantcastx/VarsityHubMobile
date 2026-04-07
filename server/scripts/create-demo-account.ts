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
const DEMO_PASSWORD = 'VarsityDemo2026!';
const DEMO_USERNAME = 'appledemo';

async function main() {
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

    console.log('Demo account created/updated successfully:');
    console.log(`  Email:    ${DEMO_EMAIL}`);
    console.log(`  Password: ${DEMO_PASSWORD}`);
    console.log(`  Username: ${DEMO_USERNAME}`);
    console.log(`  User ID:  ${user.id}`);
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
