/**
 * VERIFY — Profile & Team Editing Security
 *
 * Tests that users cannot edit other users' profiles or unauthorized teams.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const PASSWORD = 'TestPass123';

let passed = 0;
let failed = 0;
const cleanupUsers: string[] = [];
const cleanupOrgs: string[] = [];

function divider(label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${label}`);
  console.log('='.repeat(60));
}

function check(label: string, condition: boolean, details?: string) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ FAIL: ${label}${details ? ` — ${details}` : ''}`); }
}

async function api(method: string, path: string, body?: any, tok?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  console.log(`\n  → ${method} ${path}`);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`  ← ${res.status} ${JSON.stringify(data).substring(0, 150)}`);
  return { status: res.status, data };
}

async function main() {
  console.log('🧪 SECURITY TEST — Profile & Team Editing Boundaries');
  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // Create User A
  const userA = await prisma.user.create({
    data: {
      email: `usera_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'User A', username: `usera_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'veteran' },
      bio: 'Original bio A',
    },
  });
  cleanupUsers.push(userA.id);

  // Create User B
  const userB = await prisma.user.create({
    data: {
      email: `userb_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'User B', username: `userb_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
      bio: 'Original bio B',
    },
  });
  cleanupUsers.push(userB.id);

  // Login both
  const loginA = await api('POST', '/auth/login', { email: `usera_${ts}@test.local`, password: PASSWORD });
  const tokenA = loginA.data?.access_token;
  const loginB = await api('POST', '/auth/login', { email: `userb_${ts}@test.local`, password: PASSWORD });
  const tokenB = loginB.data?.access_token;

  // Create org + team owned by A
  const org = await prisma.organization.create({
    data: { name: 'Security Test Org', league_owner_id: userA.id, admin_approved: true },
  });
  cleanupOrgs.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: userA.id, role: 'owner', status: 'active' },
  });
  const team = await prisma.team.create({
    data: { name: 'Security Test Team', organization_id: org.id, sport: 'basketball' },
  });
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: userA.id, role: 'owner', status: 'active' },
  });

  // ═══════════════════════════════════════════
  // PROFILE SECURITY TESTS
  // ═══════════════════════════════════════════
  divider('PROFILE: User A tries to edit User B\'s profile');

  // Test 1: PATCH /users/:id does not exist
  const t1 = await api('PATCH', `/users/${userB.id}`, { bio: 'Hacked by A' }, tokenA);
  check('PATCH /users/:id returns 404 (endpoint does not exist)', t1.status === 404);

  // Test 2: PUT /users/:id does not exist
  const t2 = await api('PUT', `/users/${userB.id}`, { bio: 'Hacked by A' }, tokenA);
  check('PUT /users/:id returns 404 (endpoint does not exist)', t2.status === 404);

  // Test 3: PATCH /me only edits own profile
  const t3 = await api('PATCH', '/me', { bio: 'A updated own bio' }, tokenA);
  check('PATCH /me updates own bio', t3.status === 200 && t3.data?.bio === 'A updated own bio');

  // Verify B's bio unchanged
  const bAfter = await prisma.user.findUnique({ where: { id: userB.id }, select: { bio: true } });
  check('User B bio unchanged after A edits /me', bAfter?.bio === 'Original bio B');

  // Test 4: PATCH /me/preferences only edits own
  const t4 = await api('PATCH', '/me/preferences', { bio: 'Injected via preferences' }, tokenA);
  const bAfter2 = await prisma.user.findUnique({ where: { id: userB.id }, select: { preferences: true } });
  check('User B preferences unchanged after A edits /me/preferences', !(bAfter2?.preferences as any)?.bio);

  // Test 5: A views B's profile via GET /users/:id (read-only, no edit)
  const t5 = await api('GET', `/users/${userB.id}`, undefined, tokenA);
  check('A can view B\'s public profile', t5.status === 200);
  check('No edit capability in response', !t5.data?.password_hash);

  // ═══════════════════════════════════════════
  // TEAM SECURITY TESTS
  // ═══════════════════════════════════════════
  divider('TEAM: User B (non-member) tries to edit A\'s team');

  // Test 6: B tries PUT /teams/:id
  const t6 = await api('PUT', `/teams/${team.id}`, { name: 'Hacked Team' }, tokenB);
  check('Non-member PUT /teams/:id returns 403', t6.status === 403);

  // Test 7: B tries DELETE /teams/:id
  const t7 = await api('DELETE', `/teams/${team.id}`, undefined, tokenB);
  check('Non-member DELETE /teams/:id returns 403', t7.status === 403);

  // Test 8: B tries POST /team-memberships (add self to team)
  const t8 = await api('POST', '/team-memberships', {
    team_id: team.id, user_id: userB.id, role: 'player',
  }, tokenB);
  check('Non-member POST /team-memberships returns 403', t8.status === 403);

  // Test 9: B tries POST /teams/:id/invite
  const t9 = await api('POST', `/teams/${team.id}/invite`, {
    email: 'hacker@test.local',
  }, tokenB);
  check('Non-member POST /teams/:id/invite returns 403', t9.status === 403);

  // Test 10: B tries POST /teams/:id/transfer-ownership
  const t10 = await api('POST', `/teams/${team.id}/transfer-ownership`, {
    new_owner_id: userB.id,
  }, tokenB);
  check('Non-member transfer-ownership returns 403', t10.status === 403);

  // Verify team unchanged
  const teamAfter = await prisma.team.findUnique({ where: { id: team.id }, select: { name: true } });
  check('Team name unchanged after all attacks', teamAfter?.name === 'Security Test Team');

  // Test 11: A (owner) CAN edit team
  divider('TEAM: User A (owner) edits own team — should succeed');
  const t11 = await api('PUT', `/teams/${team.id}`, { name: 'Updated By Owner' }, tokenA);
  check('Owner PUT /teams/:id returns 200', t11.status === 200);

  // ═══════════════════════════════════════════
  // FAN TRYING COACH ACTIONS
  // ═══════════════════════════════════════════
  divider('FAN: User B (fan) tries coach-only actions');
  const t12 = await api('POST', '/teams', { name: 'Fan Team', organization_id: org.id }, tokenB);
  check('Fan POST /teams returns 403', t12.status === 403);

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
  await prisma.team.deleteMany({ where: { id: team.id } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: { in: cleanupOrgs } } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanupUsers } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: cleanupUsers } } }).catch(() => {});
  console.log('🗑️  Cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (failed === 0) {
    console.log('\n  🔒 ALL BOUNDARIES ENFORCED');
    console.log('  → No user can edit another user\'s profile');
    console.log('  → No non-member can edit a team');
    console.log('  → No fan can access coach tools');
  }
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
