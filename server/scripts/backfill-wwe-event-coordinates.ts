/**
 * One-time backfill for WWE Event rows missing coordinates.
 *
 * Uses the deterministic WWE venue fallback table (no live geocoder calls) to
 * fill latitude/longitude for previously ingested rows that were quarantined by
 * geocoding misses.
 *
 * Dry-run by default. Pass --apply to write.
 *
 *   cd server && npx tsx scripts/backfill-wwe-event-coordinates.ts
 *   cd server && npx tsx scripts/backfill-wwe-event-coordinates.ts --apply
 */

import { prisma } from '../src/lib/prisma.js';
import { resolveWweVenueFallbackFromLocation } from '../src/lib/proSchedule/wweVenueFallbacks.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;

type Row = {
  id: string;
  pro_external_ref: string | null;
  title: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function run(): Promise<void> {
  console.log(
    `\nWWE coordinate backfill — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`
  );

  let scanned = 0;
  let fixable = 0;
  let updated = 0;
  let cursor: string | null = null;

  for (;;) {
    const rows: Row[] = await prisma.event.findMany({
      where: {
        pro_external_ref: { startsWith: 'wwe:' },
        OR: [{ latitude: null }, { longitude: null }],
      },
      select: {
        id: true,
        pro_external_ref: true,
        title: true,
        location: true,
        latitude: true,
        longitude: true,
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]!.id;
    scanned += rows.length;

    for (const row of rows) {
      const coords = resolveWweVenueFallbackFromLocation(row.location);
      if (!coords) continue;
      fixable += 1;

      if (APPLY) {
        await prisma.event.update({
          where: { id: row.id },
          data: { latitude: coords.lat, longitude: coords.lng },
        });
        updated += 1;
      }
    }
  }

  console.log(`Rows scanned: ${scanned}`);
  console.log(`${APPLY ? 'Rows updated' : 'Rows fixable'}: ${APPLY ? updated : fixable}`);
  console.log(`${APPLY ? 'Updated with static coordinates.' : 'Re-run with --apply to write.'}\n`);
}

run()
  .catch(err => {
    console.error('[backfill-wwe-event-coordinates] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
