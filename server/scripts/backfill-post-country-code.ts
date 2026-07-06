/**
 * One-time backfill: fill country_code on EXISTING posts that were written null.
 *
 * The country-scoped Highlights feed hard-filters `country_code = X`, so any post
 * with a null country_code silently drops out of Highlights (the July-5 report:
 * @jairo_rosales posted media to an event page but the posts never appeared).
 *
 * The write-side fix (commit 53fdfff4) now defaults country_code at POST /posts,
 * so NEW posts are fine — this only repairs historical rows created before it.
 *
 * Derivation mirrors the write-side dominant fallback (`preferCountry || 'US'`):
 *   1. the author's saved preference country (preferences.country_code/country)
 *   2. 'US' (matches the read-side default in app/highlights.tsx)
 * We intentionally do NOT reverse-geocode lat/lng here — the write-side already
 * falls back to preferCountry when geocode fails, and a mass geocode would burn
 * the Google quota (see the known geocode-quota issue). Author-pref-or-US is the
 * same value a fresh write would land on for these rows.
 *
 * Dry-run by default. Pass --apply to write. Safe to re-run (idempotent — only
 * touches rows still missing country_code).
 *
 *   npx tsx scripts/backfill-post-country-code.ts            # dry run
 *   npx tsx scripts/backfill-post-country-code.ts --apply    # write
 *
 * NOT wired into start.sh — run manually against a target DB.
 */
import { prisma } from '../src/lib/prisma.js';
import { getCountryFromReqOrPrefs } from '../src/lib/geo.js';

const APPLY = process.argv.includes('--apply');
const BATCH = 500;
const DEFAULT_COUNTRY = 'US';

async function main(): Promise<void> {
  let scanned = 0;
  let filled = 0;
  const byCountry: Record<string, number> = {};
  let cursor: string | null = null;

  for (;;) {
    const rows: Array<{ id: string; author_id: string }> = await prisma.post.findMany({
      where: { country_code: null },
      select: { id: true, author_id: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    // Resolve each distinct author's preference country once per batch.
    const authorIds = [...new Set(rows.map(r => r.author_id))];
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, preferences: true },
    });
    const authorCountry = new Map<string, string>();
    for (const a of authors) {
      const c = getCountryFromReqOrPrefs({} as any, a.preferences as any) || DEFAULT_COUNTRY;
      authorCountry.set(a.id, c);
    }

    // Group post ids by the country we'll assign, so we can updateMany per value.
    const idsByCountry: Record<string, string[]> = {};
    for (const r of rows) {
      const c = authorCountry.get(r.author_id) || DEFAULT_COUNTRY;
      (idsByCountry[c] ??= []).push(r.id);
      byCountry[c] = (byCountry[c] || 0) + 1;
    }

    for (const [country, ids] of Object.entries(idsByCountry)) {
      if (APPLY) {
        await prisma.post.updateMany({
          where: { id: { in: ids }, country_code: null },
          data: { country_code: country },
        });
      }
      filled += ids.length;
    }

    console.log(`  …scanned ${scanned}, ${APPLY ? 'filled' : 'would fill'} ${filled}`);
  }

  console.log(`\n${APPLY ? 'Backfill complete' : 'DRY RUN (no writes)'}:`);
  console.log(`  posts with null country_code: ${scanned}`);
  console.log(`  ${APPLY ? 'updated' : 'would update'}: ${filled}`);
  console.log('  by assigned country:', byCountry);
  if (!APPLY && scanned > 0) {
    console.log('\nRe-run with --apply to write these changes.');
  }
}

main()
  .catch(err => {
    console.error('[backfill-post-country-code] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
