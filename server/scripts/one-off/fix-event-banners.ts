/**
 * Event banner audit/fix tool — list what's actually on prod event pages for a
 * given date, and replace a bad banner (e.g. an AI-generated stock image) with
 * a real, free-use photo URL you supply.
 *
 * Read-only by default. Nothing is written unless --apply is passed.
 *
 * Usage (run against prod with DATABASE_URL="$(railway variables --json | jq -r .DATABASE_PUBLIC_URL)"):
 *
 *   # 1. See what's on today's (or any date's) event pages before touching anything
 *   npx tsx scripts/one-off/fix-event-banners.ts --list --date 2026-07-01
 *
 *   # 2. Dry-run a fix — shows current vs. planned banner for matching events
 *   npx tsx scripts/one-off/fix-event-banners.ts --set --match "Belgium" --match "Senegal" \
 *     --url "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/2025_FIFA_Club_World_Cup_-_Seattle_Sounders_FC_vs._Atl%C3%A9tico_Madrid_-_05.jpg/960px-2025_FIFA_Club_World_Cup_-_Seattle_Sounders_FC_vs._Atl%C3%A9tico_Madrid_-_05.jpg"
 *
 *   # 3. Actually write it (updates event.banner_url, and the linked game's
 *   #    banner_url + cover_image_url if the event has a game_id, since either
 *   #    field can be what a screen renders)
 *   npx tsx scripts/one-off/fix-event-banners.ts --set --match "Belgium" --match "Senegal" \
 *     --url "https://upload.wikimedia.org/..." --apply
 *
 * --match can be passed multiple times; an event matches only if its title
 * contains ALL given substrings (case-insensitive) — this is how you narrow
 * "Belgium" (too broad alone) down to the single "Belgium vs Senegal" event.
 */
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const mode = args.includes('--list') ? 'list' : args.includes('--set') ? 'set' : null;
  const apply = args.includes('--apply');
  const dateIdx = args.indexOf('--date');
  const date = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
  if (dateIdx !== -1 && !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error('Invalid --date, expected YYYY-MM-DD');
    process.exit(1);
  }
  const matches: string[] = [];
  args.forEach((a, i) => {
    if (a === '--match') matches.push(args[i + 1]);
  });
  const urlIdx = args.indexOf('--url');
  const url = urlIdx !== -1 ? args[urlIdx + 1] : undefined;
  return { mode, apply, date, matches, url };
}

function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
}

async function list(dateStr: string) {
  const { start, end } = dayRange(dateStr);
  const events = await prisma.event.findMany({
    where: { date: { gte: start, lte: end } },
    select: {
      id: true,
      title: true,
      location: true,
      date: true,
      banner_url: true,
      game_id: true,
      game: { select: { id: true, banner_url: true, cover_image_url: true } },
    },
    orderBy: { date: 'asc' },
    take: 200,
  });

  if (events.length === 0) {
    console.log(`No events found on ${dateStr}.`);
    return;
  }
  console.log(`${events.length} event(s) on ${dateStr}:\n`);
  for (const e of events) {
    console.log(`- ${e.title} (${e.id})`);
    console.log(`    location:            ${e.location ?? '(none)'}`);
    console.log(`    event.banner_url:    ${e.banner_url ?? '(none)'}`);
    if (e.game) {
      console.log(`    game.banner_url:     ${e.game.banner_url ?? '(none)'}`);
      console.log(`    game.cover_image_url:${e.game.cover_image_url ?? '(none)'}`);
    }
    console.log();
  }
}

async function set(matches: string[], url: string, apply: boolean) {
  if (matches.length === 0) {
    console.error('--set requires at least one --match "<substring>"');
    process.exit(1);
  }
  const isKnownFreeSource = /^https:\/\/(upload\.wikimedia\.org|commons\.wikimedia\.org)\//.test(
    url
  );
  if (!isKnownFreeSource) {
    console.warn(
      `⚠️  URL is not from wikimedia.org — make sure you've personally verified this is a real, free-use (public domain / CC-licensed) photo, not an AI-generated image, before applying.\n`
    );
  }

  const events = await prisma.event.findMany({
    where: {
      AND: matches.map(m => ({ title: { contains: m, mode: 'insensitive' as const } })),
    },
    select: {
      id: true,
      title: true,
      date: true,
      banner_url: true,
      game_id: true,
      game: { select: { id: true, banner_url: true, cover_image_url: true } },
    },
    take: 50,
  });

  if (events.length === 0) {
    console.log(`No events match all of: ${matches.join(', ')}`);
    return;
  }

  console.log(
    `${apply ? 'Applying' : '[dry-run] Would apply'} banner "${url}" to ${events.length} matching event(s):\n`
  );

  for (const e of events) {
    console.log(`- ${e.title} (${e.id}) — ${e.date.toISOString()}`);
    console.log(`    event.banner_url:    ${e.banner_url ?? '(none)'} -> ${url}`);
    if (e.game) {
      console.log(`    game.banner_url:     ${e.game.banner_url ?? '(none)'} -> ${url}`);
      console.log(`    game.cover_image_url:${e.game.cover_image_url ?? '(none)'} -> ${url}`);
    }
    console.log();

    if (!apply) continue;

    await prisma.event.update({ where: { id: e.id }, data: { banner_url: url } });
    if (e.game_id) {
      await prisma.game.update({
        where: { id: e.game_id },
        data: { banner_url: url, cover_image_url: url },
      });
    }
  }

  if (apply) {
    console.log(`✅ Updated ${events.length} event(s)${events.some(e => e.game_id) ? ' and their linked game(s)' : ''}.`);
  } else {
    console.log('Dry run only — re-run with --apply to write these changes.');
  }
}

async function main() {
  const { mode, apply, date, matches, url } = parseArgs();

  if (mode === 'list') {
    const dateStr = date ?? new Date().toISOString().slice(0, 10);
    await list(dateStr);
  } else if (mode === 'set') {
    if (!url) {
      console.error('--set requires --url "<real photo url>"');
      process.exit(1);
    }
    await set(matches, url, apply);
  } else {
    console.error('Pass --list or --set. See file header for usage.');
    process.exit(1);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
