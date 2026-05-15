#!/usr/bin/env npx tsx
/**
 * Prepare the single App Review account used in App Store Connect.
 *
 * Usage:
 *   APP_REVIEW_PASSWORD='...' npx tsx scripts/create-demo-account.ts
 *
 * DATABASE_URL must point at the target environment. Safe to re-run.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  APP_REVIEW_AD_NAME,
  APP_REVIEW_EMAIL,
  APP_REVIEW_ORG_NAME,
  APP_REVIEW_TEAM_NAME,
  APP_REVIEW_USERNAME,
  ensureAppReviewFixture,
} from '../src/lib/appReviewFixture.js';

const prisma = new PrismaClient();
const REVIEW_PASSWORD = (
  process.env.APP_REVIEW_PASSWORD ||
  process.env.DEMO_ACCOUNT_PASSWORD ||
  ''
).trim();

async function main() {
  if (!REVIEW_PASSWORD) {
    console.error(
      'APP_REVIEW_PASSWORD is required. Set it explicitly when running this script.'
    );
    process.exit(1);
  }

  if (process.env.DEMO_ACCOUNT_PASSWORD?.trim()) {
    console.warn(
      '[prepare-app-review] DEMO_ACCOUNT_PASSWORD is deprecated. Use APP_REVIEW_PASSWORD for this explicit one-off task.'
    );
  }

  try {
    await ensureAppReviewFixture(prisma, REVIEW_PASSWORD);

    console.log('App Review account prepared successfully:');
    console.log(`  Email:        ${APP_REVIEW_EMAIL}`);
    console.log(`  Username:     ${APP_REVIEW_USERNAME}`);
    console.log(`  Organization: ${APP_REVIEW_ORG_NAME}`);
    console.log(`  Team:         ${APP_REVIEW_TEAM_NAME}`);
    console.log(`  Review Ad:    ${APP_REVIEW_AD_NAME}`);
    console.log('  Role:         coach');
    console.log('  Plan:         rookie / free');
  } catch (err) {
    console.error('Failed to prepare App Review account:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
