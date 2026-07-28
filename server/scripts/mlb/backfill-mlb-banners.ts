/**
 * MLB banner backfill. Dry-run by default; pass --apply to write.
 *
 * A prior seed left some MLB games/events with invalid Unsplash banner ids
 * (verified HTTP 404) or no banner at all, so they render as broken/blank hero
 * images. Most MLB events already have a good Wikimedia stadium photo. This
 * fills ONLY the broken/blank ones by reusing the working banner from a sibling
 * event at the SAME venue (home team parsed from the "Away at Home" title).
 *
 * Safety:
 *   - Only touches events whose banner is NULL or an images.unsplash.com URL.
 *   - Never modifies an event that already has a good (non-Unsplash) banner.
 *   - If no sibling has a working banner for that venue, leaves it null (the
 *     client shows a clean gradient — never a broken image).
 *
 * Usage:
 *   npx tsx scripts/mlb/backfill-mlb-banners.ts            # dry-run
 *   npx tsx scripts/mlb/backfill-mlb-banners.ts --apply    # write
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function homeTeamFromTitle(title: string | null): string | null {
  if (!title) return null;
  const idx = title.lastIndexOf(' at ');
  return idx === -1 ? null : title.slice(idx + 4).trim();
}
const isBroken = (u: string | null | undefined) => !u || u.includes('images.unsplash.com');
const isGood = (u: string | null | undefined): u is string =>
  !!u && !u.includes('images.unsplash.com');

async function main() {
  console.log(APPLY ? '⚠️  APPLY mode — writing.\n' : 'Dry-run (no writes).\n');

  const events = await prisma.event.findMany({
    where: { linked_league: 'MLB' },
    select: { id: true, title: true, banner_url: true, game_id: true },
    take: 10000,
  });

  // Build home-team -> a known-good banner, from events that already have one.
  const goodByVenue = new Map<string, string>();
  for (const e of events) {
    const home = homeTeamFromTitle(e.title);
    if (home && isGood(e.banner_url) && !goodByVenue.has(home)) goodByVenue.set(home, e.banner_url);
  }
  console.log(`Venues with a known-good banner to reuse: ${goodByVenue.size}\n`);

  let filled = 0;
  let noSource = 0;
  const gamesDone = new Set<string>();

  for (const e of events) {
    if (!isBroken(e.banner_url)) continue; // leave good ones alone
    const home = homeTeamFromTitle(e.title);
    const replacement = home ? goodByVenue.get(home) : undefined;
    if (!replacement) {
      noSource++;
      console.log(
        `· "${e.title}" — no sibling banner; leaving ${e.banner_url ? 'broken→null' : 'null'}`
      );
      // Still clear a broken Unsplash so it stops requesting a 404 image.
      if (APPLY && e.banner_url)
        await prisma.event.update({ where: { id: e.id }, data: { banner_url: null } });
      if (APPLY && e.game_id && !gamesDone.has(e.game_id)) {
        gamesDone.add(e.game_id);
        await prisma.game.updateMany({
          where: { id: e.game_id, banner_url: { contains: 'images.unsplash.com' } },
          data: { banner_url: null },
        });
      }
      continue;
    }
    console.log(`✓ "${e.title}" — ${e.banner_url ? 'broken' : 'blank'} → reuse ${home} photo`);
    filled++;
    if (APPLY) {
      await prisma.event.update({ where: { id: e.id }, data: { banner_url: replacement } });
      if (e.game_id && !gamesDone.has(e.game_id)) {
        gamesDone.add(e.game_id);
        await prisma.game.update({ where: { id: e.game_id }, data: { banner_url: replacement } });
      }
    }
  }

  console.log(
    `\n${APPLY ? 'Filled' : 'Would fill'} ${filled} broken/blank events with a real venue photo; ` +
      `${noSource} had no sibling source (left as clean gradient).`
  );
}

main()
  .catch(e => {
    console.error('[backfill-mlb-banners]', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
