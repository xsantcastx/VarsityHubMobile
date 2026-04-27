#!/usr/bin/env npx tsx
/**
 * backfill-join-request-approved-system.ts
 *
 * Sets actor_id to null for JOIN_REQUEST_APPROVED notifications so
 * the client renders the VarsityHub logo for system notifications.
 *
 * Dry run by default. Use --apply to perform updates.
 *
 * Run:
 *   cd server
 *   npx tsx scripts/backfill-join-request-approved-system.ts
 *   npx tsx scripts/backfill-join-request-approved-system.ts --apply
 */

import { prisma } from '../src/lib/prisma.js';

const apply = process.argv.includes('--apply');

async function main() {
  const toUpdate = await prisma.notification.count({
    where: {
      type: 'JOIN_REQUEST_APPROVED',
      actor_id: { not: null },
    },
  });

  if (!apply) {
    console.log(`Dry run: ${toUpdate} JOIN_REQUEST_APPROVED rows would be updated.`);
    console.log('Re-run with --apply to perform the update.');
    return;
  }

  const result = await prisma.notification.updateMany({
    where: {
      type: 'JOIN_REQUEST_APPROVED',
      actor_id: { not: null },
    },
    data: { actor_id: null },
  });

  console.log(`Updated ${result.count} JOIN_REQUEST_APPROVED rows (actor_id -> null).`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
