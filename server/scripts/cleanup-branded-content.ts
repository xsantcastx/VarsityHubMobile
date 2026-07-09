/**
 * One-off: scrub trademarked brand strings from ALREADY-SEEDED production rows.
 *
 * The seed SOURCE files were genericized (International Cup, fictional demo
 * teams), but any content already pushed to a database still carries the old
 * branded strings. This script reconciles live data with the new sources.
 *
 * What it does (idempotent, safe to re-run):
 *   1. RENAMES the "FIFA World Cup 2026" league everywhere it was persisted
 *      (Organization.name, Team.league, Event.linked_league, and any
 *      Game.title / Event.title / Event.description text) → "International Cup".
 *      This keeps the demo tournament fully browsable under the new name and in
 *      sync with DEMO_LEAGUE_NAMES in src/lib/demoContent.ts.
 *   2. REPORTS (does not delete) any remaining pro/college brand rows — the
 *      [DEMO_MATCHUP] teams (Duke/UNC/Cavaliers/Warriors) and the NBA-Finals
 *      one-off events (Spurs/Knicks). Deletion is destructive and cascades, so
 *      it is intentionally left to the existing, FK-safe tools:
 *        • Demo matchups:  npx tsx scripts/wipe-demo-matchups.ts
 *        • NBA one-offs:    review the printed ids and delete deliberately.
 *
 * DRY-RUN BY DEFAULT — prints the plan and writes nothing. Pass --apply to write.
 *
 * Usage (always dry-run first):
 *   cd server && railway run npx tsx scripts/cleanup-branded-content.ts
 *   cd server && railway run npx tsx scripts/cleanup-branded-content.ts --apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');

// Ordered replacements — longest/most-specific first so "FIFA World Cup" is
// consumed before the standalone "World Cup" pass.
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/FIFA World Cup/g, 'International Cup'],
  [/World Cup/g, 'International Cup'],
];

function scrub(value: string): string {
  return REPLACEMENTS.reduce((acc, [re, to]) => acc.replace(re, to), value);
}

function hasBrand(value: string | null | undefined): boolean {
  return !!value && /World Cup/.test(value);
}

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  return url.replace(/:[^:@/]*@/, ':***@');
}

async function renameFifaLeague() {
  console.log('\n── 1. Rename "FIFA World Cup 2026" → "International Cup 2026" ──');
  let changed = 0;

  // Organizations
  const orgs = await prisma.organization.findMany({
    where: { name: { contains: 'World Cup' } },
    select: { id: true, name: true },
  });
  for (const o of orgs) {
    const next = scrub(o.name);
    console.log(`  org ${o.id}: "${o.name}" → "${next}"`);
    if (APPLY) await prisma.organization.update({ where: { id: o.id }, data: { name: next } });
    changed++;
  }

  // Teams (league label)
  const teams = await prisma.team.findMany({
    where: { league: { contains: 'World Cup' } },
    select: { id: true, name: true, league: true },
  });
  for (const t of teams) {
    const next = scrub(t.league!);
    console.log(`  team ${t.id} (${t.name}) league: "${t.league}" → "${next}"`);
    if (APPLY) await prisma.team.update({ where: { id: t.id }, data: { league: next } });
    changed++;
  }

  // Games (title only — home_team/away_team are nation names)
  const games = await prisma.game.findMany({
    where: { title: { contains: 'World Cup' } },
    select: { id: true, title: true },
  });
  for (const g of games) {
    const next = scrub(g.title);
    console.log(`  game ${g.id} title: "${g.title}" → "${next}"`);
    if (APPLY) await prisma.game.update({ where: { id: g.id }, data: { title: next } });
    changed++;
  }

  // Events (title, description, linked_league)
  const events = await prisma.event.findMany({
    where: {
      OR: [
        { title: { contains: 'World Cup' } },
        { description: { contains: 'World Cup' } },
        { linked_league: { contains: 'World Cup' } },
      ],
    },
    select: { id: true, title: true, description: true, linked_league: true },
  });
  for (const e of events) {
    const data: { title?: string; description?: string; linked_league?: string } = {};
    if (hasBrand(e.title)) data.title = scrub(e.title);
    if (hasBrand(e.description)) data.description = scrub(e.description!);
    if (hasBrand(e.linked_league)) data.linked_league = scrub(e.linked_league!);
    console.log(`  event ${e.id}: ${JSON.stringify(data)}`);
    if (APPLY) await prisma.event.update({ where: { id: e.id }, data });
    changed++;
  }

  console.log(`  ${APPLY ? 'Updated' : 'Would update'} ${changed} row(s).`);
}

async function reportProBrandContent() {
  console.log('\n── 2. Pro/college brand content still present (REPORT ONLY) ──');

  const BRANDS = [
    'Duke Blue Devils',
    'UNC Tar Heels',
    'Cleveland Cavaliers',
    'Golden State Warriors',
    'San Antonio Spurs',
    'New York Knicks',
    'NBA Finals',
  ];
  const orFilter = (field: 'name' | 'title') => BRANDS.map(b => ({ [field]: { contains: b } }));

  const teams = await prisma.team.findMany({
    where: { OR: orFilter('name') },
    select: { id: true, name: true },
  });
  const games = await prisma.game.findMany({
    where: { OR: orFilter('title') },
    select: { id: true, title: true },
  });
  const events = await prisma.event.findMany({
    where: { OR: orFilter('title') },
    select: { id: true, title: true },
  });

  console.log(`  Teams (${teams.length}):`);
  teams.forEach(t => console.log(`    - ${t.id}  ${t.name}`));
  console.log(`  Games (${games.length}):`);
  games.forEach(g => console.log(`    - ${g.id}  ${g.title}`));
  console.log(`  Events (${events.length}):`);
  events.forEach(e => console.log(`    - ${e.id}  ${e.title}`));

  if (teams.length || games.length || events.length) {
    console.log('\n  These are demo/promo rows. To remove them (destructive, cascades):');
    console.log('    • Demo matchups tagged [DEMO_MATCHUP]:  npx tsx scripts/wipe-demo-matchups.ts');
    console.log('    • NBA-Finals one-offs: delete the game/event ids above deliberately after review.');
  } else {
    console.log('  None found ✓');
  }
}

async function main() {
  console.log('[cleanup-branded-content] Mode:', APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)');
  console.log('[cleanup-branded-content] Target DB:', maskDatabaseUrl(process.env.DATABASE_URL));

  await renameFifaLeague();
  await reportProBrandContent();

  console.log(
    `\n[cleanup-branded-content] Done (${APPLY ? 'changes applied' : 'dry-run — re-run with --apply to write'}).`
  );
}

main()
  .catch(err => {
    console.error('[cleanup-branded-content] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
