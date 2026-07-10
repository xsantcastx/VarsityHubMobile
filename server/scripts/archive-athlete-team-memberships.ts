#!/usr/bin/env npx tsx
/**
 * archive-athlete-team-memberships.ts
 *
 * 2026-07-09 role-model change: teams hold STAFF ONLY (coaches + authorized
 * users added by coaches/org owners). The player/parent/member team roles were
 * retired — athletes connect to teams by following, never by membership.
 *
 * This one-time script:
 *   1. Archives every ACTIVE TeamMembership with role player/parent/member
 *      (status -> 'archived'; rows are kept, rosters stop rendering them).
 *   2. Revokes every PENDING TeamInvite carrying one of the retired roles
 *      (the accept endpoint also 410s them as a backstop).
 *
 * Dry run by default. Use --apply to perform updates.
 *
 * Usage (MUST target the LIVE database — Postgres-TnGR, not the backup):
 *   cd server
 *   npx tsx scripts/archive-athlete-team-memberships.ts          # dry run
 *   npx tsx scripts/archive-athlete-team-memberships.ts --apply  # write to DB
 */

import { prisma } from '../src/lib/prisma.js';

const apply = process.argv.includes('--apply');
const RETIRED_ROLES = ['player', 'parent', 'member'] as const;

async function main() {
  const memberships = await prisma.teamMembership.findMany({
    where: { role: { in: RETIRED_ROLES as any }, status: 'active' },
    select: {
      id: true,
      role: true,
      team: { select: { id: true, name: true } },
      user: { select: { id: true, username: true, display_name: true } },
    },
    take: 100000,
  });

  const invites = await prisma.teamInvite.findMany({
    where: { role: { in: RETIRED_ROLES as any }, status: 'pending' },
    select: { id: true, email: true, role: true, team: { select: { id: true, name: true } } },
    take: 100000,
  });

  console.log(`[archive-athletes] mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`[archive-athletes] active retired-role memberships: ${memberships.length}`);
  for (const m of memberships) {
    console.log(
      `  - ${m.role.padEnd(8)} ${m.user.display_name || m.user.username || m.user.id} @ ${m.team.name} (membership ${m.id})`
    );
  }
  console.log(`[archive-athletes] pending retired-role invites: ${invites.length}`);
  for (const i of invites) {
    console.log(`  - ${i.role.padEnd(8)} ${i.email} @ ${i.team.name} (invite ${i.id})`);
  }

  if (!apply) {
    console.log('[archive-athletes] dry run complete — re-run with --apply to write.');
    return;
  }

  const archived = await prisma.teamMembership.updateMany({
    where: { id: { in: memberships.map(m => m.id) } },
    data: { status: 'archived' },
  });
  const revoked = await prisma.teamInvite.updateMany({
    where: { id: { in: invites.map(i => i.id) } },
    data: { status: 'revoked' },
  });
  console.log(
    `[archive-athletes] done: archived ${archived.count} memberships, revoked ${revoked.count} invites.`
  );
}

main()
  .catch(err => {
    console.error('[archive-athletes] failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
