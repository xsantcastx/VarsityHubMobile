#!/usr/bin/env npx tsx
/**
 * backfill-sport-programs.ts
 *
 * Phase 1 of the sport-program pivot: for every active team, infer
 * (sport, gender, level) from Team.sport + Team.name, upsert the org's
 * SportProgram, and link the team (program_id + level). Teams whose sport
 * cannot be normalized are REPORTED and left untouched — never guessed.
 *
 * Dry run by default. Use --apply to write.
 *   cd server
 *   npx tsx scripts/backfill-sport-programs.ts          # dry run
 *   npx tsx scripts/backfill-sport-programs.ts --apply
 */
import { prisma } from '../src/lib/prisma.js';
import { inferProgramForTeam, InferredGender, InferredLevel } from '../src/lib/programInference.js';

const apply = process.argv.includes('--apply');

async function main() {
  const teams = await prisma.team.findMany({
    where: { status: 'active', program_id: null, club_type: 'sport' },
    select: { id: true, name: true, sport: true, organization_id: true },
    take: 100000,
  });

  const unresolved: typeof teams = [];
  const planned: Array<{
    teamId: string; teamName: string; orgId: string;
    sport: string; gender: InferredGender; level: InferredLevel | null;
  }> = [];

  for (const team of teams) {
    const inferred = inferProgramForTeam(team);
    if (!inferred) {
      unresolved.push(team);
      continue;
    }
    planned.push({
      teamId: team.id, teamName: team.name, orgId: team.organization_id,
      sport: inferred.sport, gender: inferred.gender, level: inferred.level,
    });
  }

  console.log(`[programs-backfill] mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[programs-backfill] linkable teams: ${planned.length}`);
  for (const p of planned) {
    console.log(`  - ${p.teamName} -> ${p.sport} [${p.gender}/${p.level ?? 'no-level'}]`);
  }
  console.log(`[programs-backfill] UNRESOLVED (left untouched): ${unresolved.length}`);
  for (const t of unresolved) {
    console.log(`  - ${t.name} (sport column: ${JSON.stringify(t.sport)})`);
  }
  if (!apply) {
    console.log('[programs-backfill] dry run complete — re-run with --apply to write.');
    return;
  }

  let linked = 0;
  for (const p of planned) {
    // SportProgram is keyed on (organization_id, sport) only — one program
    // per sport per org, regardless of gender. Gender lives on the Team row.
    const program = await prisma.sportProgram.upsert({
      where: {
        organization_id_sport: { organization_id: p.orgId, sport: p.sport },
      },
      update: {},
      create: { organization_id: p.orgId, sport: p.sport },
    });
    await prisma.team.update({
      where: { id: p.teamId },
      data: { program_id: program.id, level: p.level ?? 'other', gender: p.gender },
    });
    linked += 1;
  }
  console.log(`[programs-backfill] done: linked ${linked} teams.`);
}

main()
  .catch(err => {
    console.error('[programs-backfill] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
