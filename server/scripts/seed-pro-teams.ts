#!/usr/bin/env npx tsx
/**
 * seed-pro-teams.ts
 *
 * Upserts the professional franchise + venue dataset (src/lib/proTeams.ts) into
 * ProTeam, keyed on external_ref so the script is idempotent — re-running it
 * updates renamed venues and relocated franchises in place without creating
 * duplicates or disturbing follower rows.
 *
 * Rows present in the DB but absent from the seed are reported, never deleted:
 * deleting a ProTeam cascades its ProTeamFollow rows and nulls its events'
 * team ids, which is not something a seed run should ever do silently. Retire a
 * defunct franchise by setting active=false instead.
 *
 * Dry run by default. Use --apply to write.
 *   cd server
 *   npx tsx scripts/seed-pro-teams.ts            # dry run
 *   npx tsx scripts/seed-pro-teams.ts --apply
 *   npx tsx scripts/seed-pro-teams.ts --apply --league=nba
 */
import { prisma } from '../src/lib/prisma.js';
import { PRO_TEAM_SEED, PRO_TEAM_SEED_COUNTS, type ProTeamSeed } from '../src/lib/proTeams.js';

const apply = process.argv.includes('--apply');
const leagueArg = process.argv.find(a => a.startsWith('--league='))?.split('=')[1];

// Fields compared to decide whether an existing row actually needs an update.
// Excludes id/created_at/updated_at, which the seed never asserts.
const COMPARED_FIELDS = [
  'league',
  'name',
  'short_name',
  'abbreviation',
  'city',
  'state',
  'conference',
  'division',
  'venue_name',
  'venue_address',
  'venue_lat',
  'venue_lng',
  'timezone',
  'primary_color',
] as const;

function diffFields(existing: Record<string, unknown>, seed: ProTeamSeed): string[] {
  return COMPARED_FIELDS.filter(
    f => (existing[f] ?? null) !== ((seed as unknown as Record<string, unknown>)[f] ?? null)
  );
}

async function main() {
  const seed = leagueArg ? PRO_TEAM_SEED.filter(t => t.league === leagueArg) : PRO_TEAM_SEED;

  if (seed.length === 0) {
    console.error(
      `[seed-pro-teams] no seed rows for --league=${leagueArg}. Valid: ${Object.keys(PRO_TEAM_SEED_COUNTS).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  // A duplicate external_ref would make the upsert non-deterministic — catch it
  // here rather than discovering it as a confusing half-applied run.
  const refs = new Set<string>();
  const duplicates = seed.filter(t =>
    refs.has(t.external_ref) ? true : (refs.add(t.external_ref), false)
  );
  if (duplicates.length > 0) {
    console.error(
      `[seed-pro-teams] duplicate external_ref in seed data: ${duplicates.map(d => d.external_ref).join(', ')}`
    );
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.proTeam.findMany({ take: 10000 });
  const byRef = new Map(existing.map(t => [t.external_ref, t]));

  const toCreate: ProTeamSeed[] = [];
  const toUpdate: Array<{ seed: ProTeamSeed; changed: string[] }> = [];
  let unchanged = 0;

  for (const t of seed) {
    const current = byRef.get(t.external_ref);
    if (!current) {
      toCreate.push(t);
      continue;
    }
    const changed = diffFields(current as unknown as Record<string, unknown>, t);
    if (changed.length > 0) toUpdate.push({ seed: t, changed });
    else unchanged += 1;
  }

  const seedRefs = new Set(seed.map(t => t.external_ref));
  const orphaned = existing.filter(
    t => !seedRefs.has(t.external_ref) && (!leagueArg || t.league === leagueArg)
  );

  console.log(
    `[seed-pro-teams] ${apply ? 'APPLY' : 'DRY RUN'}${leagueArg ? ` league=${leagueArg}` : ''}`
  );
  console.log(`  seed rows:  ${seed.length}`);
  console.log(`  create:     ${toCreate.length}`);
  console.log(`  update:     ${toUpdate.length}`);
  console.log(`  unchanged:  ${unchanged}`);

  for (const t of toCreate) console.log(`    + ${t.external_ref}  ${t.name}`);
  for (const { seed: t, changed } of toUpdate) {
    console.log(`    ~ ${t.external_ref}  ${t.name}  [${changed.join(', ')}]`);
  }

  if (orphaned.length > 0) {
    console.log(
      `\n  ${orphaned.length} ProTeam row(s) exist in the DB but not in the seed. NOT deleted — ` +
        `set active=false to retire a franchise (deleting cascades follows and orphans events):`
    );
    for (const t of orphaned) console.log(`    ? ${t.external_ref}  ${t.name}`);
  }

  // Teams with no venue coordinates cannot geofence. That is correct for a
  // touring promotion (its events carry their own coordinates) and a bug for a
  // franchise, so surface the distinction rather than letting it pass silently.
  const missingVenue = seed.filter(
    t => !['wwe', 'ufc'].includes(t.league) && (t.venue_lat === null || t.venue_lng === null)
  );
  if (missingVenue.length > 0) {
    console.warn(
      `\n  WARNING: ${missingVenue.length} franchise(s) have no venue coordinates — their events cannot geofence:`
    );
    for (const t of missingVenue) console.warn(`    ! ${t.external_ref}  ${t.name}`);
  }

  if (!apply) {
    console.log('\n[seed-pro-teams] dry run — nothing written. Re-run with --apply.');
    return;
  }

  // Only write rows that actually differ, so a no-op run leaves updated_at
  // alone and the reported counts mean what they say.
  let created = 0;
  let updated = 0;
  for (const t of [...toCreate, ...toUpdate.map(u => u.seed)]) {
    const { external_ref, ...data } = t;
    await prisma.proTeam.upsert({
      where: { external_ref },
      create: { external_ref, ...data },
      update: data,
    });
    if (byRef.has(external_ref)) updated += 1;
    else created += 1;
  }

  console.log(
    `\n[seed-pro-teams] done. created=${created} updated=${updated} unchanged=${unchanged}`
  );
}

main()
  .catch(err => {
    console.error('[seed-pro-teams] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
