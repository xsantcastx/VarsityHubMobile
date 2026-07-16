/**
 * END-TO-END drive of the org-owner / coach / manager / authorized-user
 * permission matrix against the REAL authorization helpers
 * (server/src/lib/teamAuthorization.ts + accountDeletion.ts) and a REAL
 * Postgres (local `varsityhub`). Answers the owner's note: "test every single
 * case scenario for all org owners, coaches, and authorized users — they
 * should have safe and secure borders that actually work end to end," plus
 * "if they are the sole owner they can delete the org page but cannot get it
 * back" (the sole-owner guards).
 *
 * Seeds one org + one team + a cast of users at every role, asserts each
 * helper's boundary, then simulates the transfer-ownership $transaction (the
 * exact ops POST /organizations/:id/transfer-ownership runs) and re-asserts
 * that authority MOVED. Everything created is deleted at the end (revert).
 *
 *   cd server && npx tsx scripts/e2e/org-coach-authz-matrix.ts
 */
import { prisma } from '../../src/lib/prisma.js';
import {
  canManageTeam,
  canAdministerTeam,
  canArchiveTeam,
  canApproveTeamGame,
  canAssignTeamRole,
  isOrgOwner,
  isOrgAdmin,
} from '../../src/lib/teamAuthorization.js';
import { assertCanSelfDeleteUser } from '../../src/lib/accountDeletion.js';

const RUN = Date.now().toString(36);
const created: { users: string[]; teams: string[]; orgs: string[] } = {
  users: [],
  teams: [],
  orgs: [],
};

type Row = { name: string; pass: boolean; detail: string };
const rows: Row[] = [];
function check(name: string, pass: boolean, detail = '') {
  rows.push({ name, pass, detail });
  console.log(`  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ' — ' + detail : ''}`);
}

async function user(tag: string) {
  const u = await prisma.user.create({
    data: { email: `azm-${tag}-${RUN}@test.local`, username: `azm_${tag}_${RUN}`.slice(0, 20) },
    select: { id: true },
  });
  created.users.push(u.id);
  return u.id;
}

/** Does the guard throw the expected sole-owner code? */
async function selfDeleteBlocked(userId: string, expectedCode: string): Promise<boolean> {
  try {
    await assertCanSelfDeleteUser(userId);
    return false; // did not throw = not blocked
  } catch (e: any) {
    return e?.code === expectedCode;
  }
}
async function selfDeleteAllowed(userId: string): Promise<boolean> {
  try {
    await assertCanSelfDeleteUser(userId);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log(`\n\x1b[1mOrg / coach / authorized-user matrix E2E\x1b[0m (run ${RUN}) — local DB, real helpers\n`);

  // Cast
  const orgOwner = await user('orgowner');
  const orgManager = await user('orgmgr');
  const teamCoach = await user('coach');
  const teamManager = await user('teammgr');
  const assistant = await user('asst');
  const outsider = await user('outsider');
  const successor = await user('successor'); // will receive ownership

  // Org + team
  const org = await prisma.organization.create({
    data: { name: `AZM Org ${RUN}`, league_owner_id: orgOwner },
    select: { id: true },
  });
  created.orgs.push(org.id);
  const team = await prisma.team.create({
    data: { name: `AZM Team ${RUN}`, organization_id: org.id },
    select: { id: true },
  });
  created.teams.push(team.id);

  // Org memberships
  await prisma.organizationMembership.createMany({
    data: [
      { organization_id: org.id, user_id: orgOwner, role: 'owner', status: 'active' },
      { organization_id: org.id, user_id: orgManager, role: 'manager', status: 'active' },
      { organization_id: org.id, user_id: successor, role: 'manager', status: 'active' },
    ],
  });
  // Team memberships (staff only, per role-barrier model)
  await prisma.teamMembership.createMany({
    data: [
      { team_id: team.id, user_id: teamCoach, role: 'coach', status: 'active' },
      { team_id: team.id, user_id: teamManager, role: 'manager', status: 'active' },
      { team_id: team.id, user_id: assistant, role: 'assistant_coach', status: 'active' },
    ],
  });

  // ── Tier 1: canManageTeam (authorized user — event/game approve+create) ──
  check('org owner canManageTeam', await canManageTeam(orgOwner, team.id));
  check('org manager canManageTeam', await canManageTeam(orgManager, team.id));
  check('team coach canManageTeam', await canManageTeam(teamCoach, team.id));
  check('team manager canManageTeam', await canManageTeam(teamManager, team.id));
  check('assistant_coach canManageTeam', await canManageTeam(assistant, team.id));
  check('outsider CANNOT canManageTeam', !(await canManageTeam(outsider, team.id)));
  check('null user CANNOT canManageTeam', !(await canManageTeam(null, team.id)));
  check('canApproveTeamGame == canManageTeam (coach yes)', await canApproveTeamGame(teamCoach, team.id));
  check(
    'canApproveTeamGame outsider no',
    !(await canApproveTeamGame(outsider, team.id))
  );

  // ── Tier 2: canAdministerTeam (settings/roster/transfer — owner/coach/org-owner ONLY) ──
  check('org owner canAdministerTeam', await canAdministerTeam(orgOwner, team.id));
  check('team coach canAdministerTeam', await canAdministerTeam(teamCoach, team.id));
  check(
    'team MANAGER CANNOT canAdministerTeam (role-barrier)',
    !(await canAdministerTeam(teamManager, team.id)),
    'managers are authorized users, not admins'
  );
  check(
    'org MANAGER CANNOT canAdministerTeam',
    !(await canAdministerTeam(orgManager, team.id)),
    'org managers have zero team-admin power'
  );
  check(
    'assistant_coach CANNOT canAdministerTeam',
    !(await canAdministerTeam(assistant, team.id))
  );
  check('outsider CANNOT canAdministerTeam', !(await canAdministerTeam(outsider, team.id)));

  // canArchiveTeam is the same strict boundary
  check('canArchiveTeam == canAdministerTeam (coach yes)', await canArchiveTeam(teamCoach, team.id));
  check('canArchiveTeam team-manager no', !(await canArchiveTeam(teamManager, team.id)));

  // ── Privilege escalation: canAssignTeamRole(manager) ────────────────────
  check(
    'coach CANNOT mint a manager (escalation blocked)',
    !(await canAssignTeamRole(teamCoach, team.id, 'manager')),
    'coach passes canManageTeam but cannot promote peers to manager'
  );
  check('org owner CAN mint a manager', await canAssignTeamRole(orgOwner, team.id, 'manager'));
  check('org manager CAN mint a manager (org admin)', await canAssignTeamRole(orgManager, team.id, 'manager'));
  check(
    'nobody can assign owner via role change',
    !(await canAssignTeamRole(orgOwner, team.id, 'owner')),
    'owner only moves via transfer-ownership'
  );
  check('coach CAN assign a lower role (coach)', await canAssignTeamRole(teamCoach, team.id, 'coach'));

  // ── Org-level: isOrgOwner vs isOrgAdmin ─────────────────────────────────
  check('orgOwner isOrgOwner', await isOrgOwner(orgOwner, org.id));
  check('orgManager NOT isOrgOwner', !(await isOrgOwner(orgManager, org.id)));
  check('orgOwner isOrgAdmin', await isOrgAdmin(orgOwner, org.id));
  check('orgManager isOrgAdmin', await isOrgAdmin(orgManager, org.id));
  check('outsider NOT isOrgAdmin', !(await isOrgAdmin(outsider, org.id)));

  // ── Sole-owner self-delete guards (the "can't orphan the org/team" rule) ─
  // orgOwner owns the org (sole owner) AND — set them as sole team owner too.
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: orgOwner, role: 'owner', status: 'active' },
  });
  check(
    'sole org owner CANNOT self-delete (SOLE_ORG_OWNER)',
    await selfDeleteBlocked(orgOwner, 'SOLE_ORG_OWNER'),
    'blocks orphaning the org'
  );
  check(
    'outsider (owns nothing) CAN self-delete',
    await selfDeleteAllowed(outsider)
  );
  check(
    'team coach (not sole owner) CAN self-delete',
    await selfDeleteAllowed(teamCoach)
  );

  // Sole TEAM owner guard, isolated: give a fresh user a sole-owned team in a
  // multi-owner org (so only the TEAM guard, not the org guard, can fire).
  const teamOnlyOwner = await user('teamowner');
  const coOwner = await user('coowner');
  const org2 = await prisma.organization.create({
    data: { name: `AZM Org2 ${RUN}`, league_owner_id: teamOnlyOwner },
    select: { id: true },
  });
  created.orgs.push(org2.id);
  await prisma.organizationMembership.createMany({
    data: [
      { organization_id: org2.id, user_id: teamOnlyOwner, role: 'owner', status: 'active' },
      { organization_id: org2.id, user_id: coOwner, role: 'owner', status: 'active' }, // 2nd org owner
    ],
  });
  const team2 = await prisma.team.create({
    data: { name: `AZM Team2 ${RUN}`, organization_id: org2.id },
    select: { id: true },
  });
  created.teams.push(team2.id);
  await prisma.teamMembership.create({
    data: { team_id: team2.id, user_id: teamOnlyOwner, role: 'owner', status: 'active' },
  });
  check(
    'sole TEAM owner CANNOT self-delete (SOLE_TEAM_OWNER)',
    await selfDeleteBlocked(teamOnlyOwner, 'SOLE_TEAM_OWNER'),
    'org has a co-owner, but team would be orphaned'
  );

  // ── Transfer ownership: authority must MOVE atomically ──────────────────
  // Before: successor is a manager, orgOwner is owner.
  check('before transfer: successor NOT isOrgOwner', !(await isOrgOwner(successor, org.id)));
  check('before transfer: orgOwner IS isOrgOwner', await isOrgOwner(orgOwner, org.id));

  // Run the EXACT ops the transfer-ownership endpoint runs.
  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: org.id, user_id: orgOwner, role: 'owner', status: 'active' },
    select: { id: true },
  });
  const successorMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: org.id, user_id: successor, status: 'active' },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { league_owner_id: successor },
      select: { id: true },
    }),
    prisma.organizationMembership.update({
      where: { id: ownerMembership!.id },
      data: { role: 'manager' },
      select: { id: true },
    }),
    prisma.organizationMembership.update({
      where: { id: successorMembership!.id },
      data: { role: 'owner' },
      select: { id: true },
    }),
  ]);

  check('after transfer: successor IS isOrgOwner', await isOrgOwner(successor, org.id));
  check(
    'after transfer: OLD owner LOST isOrgOwner',
    !(await isOrgOwner(orgOwner, org.id)),
    'demoted to manager, league_owner_id moved — no leaked authority'
  );
  check(
    'after transfer: OLD owner still isOrgAdmin (now manager)',
    await isOrgAdmin(orgOwner, org.id)
  );
  check(
    'after transfer: NEW sole owner CANNOT self-delete',
    await selfDeleteBlocked(successor, 'SOLE_ORG_OWNER'),
    'guard follows ownership'
  );
  // OLD owner is still the SOLE owner of `team` (set earlier), so the guard
  // still correctly blocks them — losing ORG ownership doesn't release the
  // TEAM-orphan guard. This proves the two guards are independent.
  check(
    'after transfer: OLD owner still blocked (SOLE_TEAM_OWNER on their team)',
    await selfDeleteBlocked(orgOwner, 'SOLE_TEAM_OWNER'),
    'org-owner guard released, but team-owner guard still holds'
  );
  // Give `team` a second owner (a fresh user) → now nothing the old owner
  // solely owns would be orphaned → the guard releases and self-delete works.
  const teamCoOwner = await user('teamco');
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: teamCoOwner, role: 'owner', status: 'active' },
  });
  check(
    'add co-owner to team → OLD owner CAN now self-delete',
    await selfDeleteAllowed(orgOwner),
    'guard releases once no resource would be orphaned'
  );

  // Summary
  const failed = rows.filter(r => !r.pass);
  console.log(
    `\n\x1b[1m${rows.length - failed.length}/${rows.length} passed\x1b[0m` +
      (failed.length ? ` — \x1b[31m${failed.length} FAILED\x1b[0m` : ' — all green')
  );
  if (failed.length) failed.forEach(f => console.log(`   \x1b[31m✗\x1b[0m ${f.name}`));
  return failed.length;
}

async function cleanup() {
  await prisma.teamMembership.deleteMany({ where: { team_id: { in: created.teams } } });
  await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: created.orgs } } });
  await prisma.team.deleteMany({ where: { id: { in: created.teams } } });
  await prisma.organization.deleteMany({ where: { id: { in: created.orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
}

main()
  .then(async failed => {
    await cleanup();
    console.log('\x1b[2m[cleanup] seeded rows reverted\x1b[0m');
    await prisma.$disconnect();
    process.exit(failed ? 1 : 0);
  })
  .catch(async e => {
    console.error('E2E ERROR:', e);
    await cleanup().catch(() => {});
    await prisma.$disconnect();
    process.exit(2);
  });
