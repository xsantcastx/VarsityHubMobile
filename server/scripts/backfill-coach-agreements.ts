#!/usr/bin/env npx tsx
/**
 * backfill-coach-agreements.ts
 *
 * Stamps coach_agreement_accepted_at and coach_agreement_version on every
 * APPROVED coach account that is missing the agreement fields.
 *
 * These coaches were approved between 2026-05-14 (when the agreement gate was
 * removed from canAccessCoachTools) and 2026-05-30 (when it was re-added).
 * They went straight from approval to using coach tools and never hit the
 * agreement screen — so the timestamp was never written.
 *
 * After this backfill, those coaches will pass canAccessCoachTools immediately
 * without needing to tap the "Finish Setup" CTA.
 *
 * Dry run by default. Use --apply to perform updates.
 *
 * Usage:
 *   cd server
 *   npx tsx scripts/backfill-coach-agreements.ts          # dry run
 *   npx tsx scripts/backfill-coach-agreements.ts --apply  # write to DB
 */

import { prisma } from '../src/lib/prisma.js';
import { invalidateMeCacheForUser } from '../src/lib/userCache.js';

const apply = process.argv.includes('--apply');
const REQUIRED_VERSION = Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1);

async function main() {
  const affected = await prisma.user.findMany({
    where: {
      role: 'coach',
      approval_status: 'APPROVED',
      coach_agreement_accepted_at: null,
    },
    select: { id: true, email: true, organization_id: true },
    orderBy: { id: 'asc' },
  });

  if (affected.length === 0) {
    console.log('No coaches found with missing agreement. Nothing to do.');
    return;
  }

  console.log(`Found ${affected.length} approved coach(es) missing coach_agreement_accepted_at:`);
  for (const u of affected) {
    console.log(`  ${u.id}  ${u.email}  org=${u.organization_id ?? 'none'}`);
  }

  if (!apply) {
    console.log('\nDry run — no changes made. Re-run with --apply to backfill.');
    return;
  }

  const now = new Date();
  let updated = 0;
  for (const user of affected) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        coach_agreement_accepted_at: now,
        coach_agreement_version: REQUIRED_VERSION,
        preferences: {
          update: {},  // Prisma JSON merge not possible here; use raw update below
        },
      },
    });
    // Preferences need the agreement fields too for the client-side check
    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { preferences: true },
    });
    const prefs = (current?.preferences as Record<string, unknown>) ?? {};
    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferences: {
          ...prefs,
          coach_agreement_accepted_at: now.toISOString(),
          coach_agreement_version: REQUIRED_VERSION,
        },
      },
    });
    await invalidateMeCacheForUser(user.id);
    updated++;
  }

  console.log(`\nBackfill complete: ${updated} coach(es) updated.`);
}

main()
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
