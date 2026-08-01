#!/usr/bin/env npx tsx
/**
 * split-other-sport-programs.ts
 *
 * Corrective backfill for the custom-sport collision fix: before that fix, every
 * non-canonical ("Other") sport collapsed into a single per-org `sport: 'other'`
 * SportProgram, so two different custom sports (e.g. "Rowing" and "Fencing") in
 * one org shared one program and rendered as sub-teams of each other.
 *
 * This script finds every `'other'` program whose ACTIVE teams span more than one
 * distinct custom sport, creates a per-custom-sport program (keyed on
 * customSportSlug, named from the team's display sport), and reassigns those
 * teams' program_id. Teams whose sport is blank keep slug 'other' and stay put.
 *
 * Dry run by default. Use --apply to write.
 *   cd server
 *   npx tsx scripts/split-other-sport-programs.ts          # dry run
 *   npx tsx scripts/split-other-sport-programs.ts --apply
 *
 * NOTE: reassigning program_id does NOT rewrite ProgramFollow/TeamFollow rows.
 * Followers of the old mashup 'other' program keep their direct (via_program_id)
 * TeamFollow on each team, but will not hold a ProgramFollow for the new split
 * programs. Review server/src/lib/programFollowFanout.ts and decide whether to
 * reconcile follows before/after a live run.
 */
import { prisma } from '../src/lib/prisma.js';
import { customSportSlug } from '../src/lib/sportsTaxonomy.js';

const apply = process.argv.includes('--apply');

async function main() {
  const otherPrograms = await prisma.sportProgram.findMany({
    where: { sport: 'other' },
    select: {
      id: true,
      organization_id: true,
      teams: {
        where: { status: 'active' },
        select: { id: true, name: true, sport: true },
        take: 1000,
      },
    },
    take: 100000,
  });

  type Move = { teamId: string; teamName: string; toSlug: string; displaySport: string };
  const plans: Array<{ orgId: string; fromProgramId: string; moves: Move[] }> = [];

  for (const program of otherPrograms) {
    // Group this program's active teams by their per-name custom slug.
    const bySlug = new Map<string, typeof program.teams>();
    for (const team of program.teams) {
      const slug = customSportSlug(team.sport);
      const list = bySlug.get(slug) ?? [];
      list.push(team);
      bySlug.set(slug, list);
    }
    // Only a program spanning >1 distinct slug is a collision worth splitting.
    if (bySlug.size <= 1) continue;

    const moves: Move[] = [];
    for (const [slug, teams] of bySlug) {
      // Blank-sport teams (slug 'other') legitimately belong on the 'other'
      // program — leave them where they are.
      if (slug === 'other') continue;
      for (const team of teams) {
        moves.push({
          teamId: team.id,
          teamName: team.name,
          toSlug: slug,
          displaySport: (team.sport ?? '').trim(),
        });
      }
    }
    if (moves.length > 0) {
      plans.push({ orgId: program.organization_id, fromProgramId: program.id, moves });
    }
  }

  console.log(`[split-other] mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[split-other] colliding 'other' programs: ${plans.length}`);
  for (const p of plans) {
    console.log(`  program ${p.fromProgramId} (org ${p.orgId}):`);
    for (const m of p.moves) {
      console.log(`    - "${m.teamName}" -> ${m.toSlug} ("${m.displaySport}")`);
    }
  }
  if (plans.length === 0) {
    console.log("[split-other] nothing to do — no 'other' program spans >1 custom sport.");
    return;
  }
  if (!apply) {
    console.log('[split-other] dry run complete — re-run with --apply to write.');
    console.log(
      '[split-other] WARNING before --apply: reassigning program_id does NOT rewrite ' +
        'ProgramFollow/TeamFollow. Review programFollowFanout.ts and reconcile follows.'
    );
    return;
  }

  let moved = 0;
  for (const p of plans) {
    for (const m of p.moves) {
      const program = await prisma.sportProgram.upsert({
        where: {
          organization_id_sport: { organization_id: p.orgId, sport: m.toSlug },
        },
        create: {
          organization_id: p.orgId,
          sport: m.toSlug,
          ...(m.displaySport ? { name: m.displaySport } : {}),
        },
        update: {},
        select: { id: true },
      });
      await prisma.team.update({
        where: { id: m.teamId },
        data: { program_id: program.id },
      });
      moved += 1;
    }
  }
  console.log(`[split-other] APPLY complete — reassigned ${moved} team(s).`);
  console.log(
    '[split-other] follow reconciliation NOT performed — verify ProgramFollow rows ' +
      'against the new programs if whole-sport follow correctness matters.'
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[split-other] failed:', err);
    process.exit(1);
  });
