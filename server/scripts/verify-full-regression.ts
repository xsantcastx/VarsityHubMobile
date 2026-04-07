/**
 * VERIFY 10 — Full Regression After All Fixes
 *
 * Runs every verification in sequence and produces a final scorecard.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const PASSWORD = 'TestPass123';
const ADMIN_EMAIL = 'sanchezemil203@gmail.com';

let passed = 0;
let failed = 0;
const cleanup: string[] = [];
const cleanupOrgs: string[] = [];

function divider(label: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
}

function check(label: string, condition: boolean) {
  if (condition) { passed++; console.log(`    ✅ ${label}`); }
  else { failed++; console.log(`    ❌ ${label}`); }
}

async function api(method: string, path: string, body?: any, tok?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function quickRegister(email: string, role = 'fan') {
  const reg = await api('POST', '/auth/register', { email, password: PASSWORD, display_name: `Test ${role}`, role });
  const id = reg.data?.user?.id;
  const tok = reg.data?.access_token;
  if (id) cleanup.push(id);
  // Verify email directly in DB (avoids rate limit issues during test suite)
  if (id) {
    await prisma.user.update({ where: { id }, data: { email_verified: true, email_verification_code: null } });
  }
  return { id, token: tok, email };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║       VERIFY 10 — FULL REGRESSION (ALL FIXES)          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // ═══════════════════════════════════════════
  // REGRESSION 1: Fan signup E2E
  // ═══════════════════════════════════════════
  divider('R1: Fan Signup → Feed');
  const start1 = Date.now();
  const fanReg = await api('POST', '/auth/register', {
    email: `fan_r_${ts}@test.local`, password: PASSWORD, display_name: 'Test fan', role: 'fan',
  });
  const fanId = fanReg.data?.user?.id;
  if (fanId) cleanup.push(fanId);
  const fanToken0 = fanReg.data?.access_token;
  // Verify email
  // Directly verify in DB to avoid rate limit issues from test suite
  if (fanId) {
    await prisma.user.update({ where: { id: fanId }, data: { email_verified: true, email_verification_code: null } });
  }
  // Login fresh
  const fanLogin = await api('POST', '/auth/login', { email: `fan_r_${ts}@test.local`, password: PASSWORD });
  const fan = { id: fanId, token: fanLogin.data?.access_token, email: `fan_r_${ts}@test.local` };
  const onboard = await api('POST', '/me/complete-onboarding', {
    role: 'fan', username: `fan_r_${ts}`.slice(0, 20), dob: '2000-01-01', affiliation: 'none',
  }, fan.token);
  const me = await api('GET', '/auth/me', undefined, fan.token);
  const elapsed = Date.now() - start1;
  check(`Fan registered + onboarded in ${elapsed}ms`, onboard.status === 200);
  check('Fan reaches /me with complete profile', me.data?.preferences?.onboarding_completed === true);
  check('Fan has role=fan', me.data?.preferences?.role === 'fan');
  check('Fan cannot create team', (await api('POST', '/teams', { name: 'Fan Team Attempt', organization_id: 'fake' }, fan.token)).status === 403);

  // ═══════════════════════════════════════════
  // REGRESSION 2: Coach joining league → pending → blocked
  // ═══════════════════════════════════════════
  divider('R2: Coach Joining League → Pending → Blocked');
  // Create org + owner
  const owner = await prisma.user.create({
    data: {
      email: `owner_r_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'Owner', username: `owner_r_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'veteran' },
    },
  });
  cleanup.push(owner.id);
  const org = await prisma.organization.create({
    data: { name: 'Regression League', league_owner_id: owner.id, admin_approved: true },
  });
  cleanupOrgs.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: owner.id, role: 'owner', status: 'active' },
  });
  const ownerLogin = await api('POST', '/auth/login', { email: `owner_r_${ts}@test.local`, password: PASSWORD });
  const ownerToken = ownerLogin.data?.access_token;

  const coach = await quickRegister(`coach_r_${ts}@test.local`, 'coach');
  await api('POST', '/me/complete-onboarding', {
    role: 'coach', username: `coach_r_${ts}`.slice(0, 20), dob: '1990-01-01',
    affiliation: 'school', plan: 'rookie', organization_id: org.id,
    organization_name: 'Regression League', join_request_pending: true,
  }, coach.token);

  // Join request
  await api('POST', '/organizations/join-requests', { organization_id: org.id }, coach.token);

  const coachMe = await api('GET', '/auth/me', undefined, coach.token);
  check('Coach is PENDING after join request', coachMe.data?.approval_status === 'PENDING');
  check('Coach blocked from /teams', (await api('POST', '/teams', { name: 'Test Team', organization_id: org.id }, coach.token)).status === 403);
  check('Coach blocked from /posts', (await api('POST', '/posts', { content: 'test' }, coach.token)).status === 403);

  // ═══════════════════════════════════════════
  // REGRESSION 3: Approval unlocks access immediately
  // ═══════════════════════════════════════════
  divider('R3: Approval Unlocks Access');
  const approveRes = await api('POST', `/organizations/${org.id}/coaches/${coach.id}/approve`, {}, ownerToken);
  check('Approval succeeds', approveRes.status === 200);

  const coachMeAfter = await api('GET', '/auth/me', undefined, coach.token);
  check('Coach is APPROVED after approval', coachMeAfter.data?.approval_status === 'APPROVED');

  // Check notification created
  const notif = await prisma.notification.findFirst({
    where: { user_id: coach.id!, type: 'TEAM_INVITE' },
    select: { type: true, meta: true },
  });
  check('In-app notification created', !!notif);
  check('Notification has coach_approved flag', (notif?.meta as any)?.coach_approved === true);

  // ═══════════════════════════════════════════
  // REGRESSION 4: Coach creating league → admin email triggered
  // ═══════════════════════════════════════════
  divider('R4: Coach Creates League → Admin Email');
  // Create admin
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL, password_hash: hashedPw,
      display_name: 'Admin', username: `admin_r_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'legend', is_admin: true },
    },
  });
  cleanup.push(admin.id);

  const creator = await quickRegister(`creator_r_${ts}@test.local`, 'coach');
  const orgCreate = await api('POST', '/organizations', {
    name: 'Regression Created League', sport: 'basketball',
    supporting_document_url: 'https://example.com/doc.pdf',
  }, creator.token);

  check('Org created with admin_approved=false', orgCreate.data?.admin_approved === false);
  if (orgCreate.data?.id) cleanupOrgs.push(orgCreate.data.id);

  const creatorDb = await prisma.user.findUnique({ where: { id: creator.id }, select: { approval_status: true } });
  check('Creator set to PENDING', creatorDb?.approval_status === 'PENDING');
  console.log('    (Admin email to emancero@varsityhub.app triggered by server — verify in SendGrid logs)');

  // ═══════════════════════════════════════════
  // REGRESSION 5: Push token registration flow
  // ═══════════════════════════════════════════
  divider('R5: Push Token Registration');
  const FAKE_TOKEN = `ExponentPushToken[regression_${ts}]`;
  const saveToken = await api('PATCH', '/me/preferences', {
    push_token: FAKE_TOKEN, notifications_enabled: true,
  }, fan.token);
  check('Push token saved via preferences', saveToken.status === 200);

  const fanDb = await prisma.user.findUnique({ where: { id: fan.id }, select: { preferences: true } });
  const fanPrefs = fanDb?.preferences as any;
  check('Token in DB matches', fanPrefs?.push_token === FAKE_TOKEN);
  check('Token has valid Expo format', /^ExponentPushToken\[.+\]$/.test(fanPrefs?.push_token));

  // ═══════════════════════════════════════════
  // REGRESSION 6: Event notification types
  // ═══════════════════════════════════════════
  divider('R6: New Notification Types Exist');
  // Verify enum values exist by checking Prisma can create them
  try {
    const testNotif = await prisma.notification.create({
      data: { user_id: fan.id!, type: 'EVENT_APPROVED', meta: { test: true } },
    });
    check('EVENT_APPROVED type works', true);
    await prisma.notification.delete({ where: { id: testNotif.id } });
  } catch { check('EVENT_APPROVED type works', false); }

  try {
    const testNotif = await prisma.notification.create({
      data: { user_id: fan.id!, type: 'EVENT_REJECTED', meta: { test: true } },
    });
    check('EVENT_REJECTED type works', true);
    await prisma.notification.delete({ where: { id: testNotif.id } });
  } catch { check('EVENT_REJECTED type works', false); }

  try {
    const testNotif = await prisma.notification.create({
      data: { user_id: fan.id!, type: 'COACH_REJECTED', meta: { test: true } },
    });
    check('COACH_REJECTED type works', true);
    await prisma.notification.delete({ where: { id: testNotif.id } });
  } catch { check('COACH_REJECTED type works', false); }

  // ═══════════════════════════════════════════
  // REGRESSION 7: zip_code fix
  // ═══════════════════════════════════════════
  divider('R7: zip_code Not Stripped From /me');
  await api('PATCH', '/me/preferences', { zip_code: '06907' }, fan.token);
  const zipMe = await api('GET', '/auth/me', undefined, fan.token);
  check('zip_code appears in /me response', zipMe.data?.preferences?.zip_code === '06907');

  // ═══════════════════════════════════════════
  // REGRESSION 8: Guard bypass still blocked
  // ═══════════════════════════════════════════
  divider('R8: Security Guards Still Hold');
  const pendingCoach2 = await prisma.user.create({
    data: {
      email: `pending_r_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'Pending', username: `pending_r_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'PENDING',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie' },
    },
  });
  cleanup.push(pendingCoach2.id);
  const pc2Login = await api('POST', '/auth/login', { email: `pending_r_${ts}@test.local`, password: PASSWORD });
  const pc2Token = pc2Login.data?.access_token;

  check('Pending: /teams blocked', (await api('POST', '/teams', { name: 'Test Team', organization_id: org.id }, pc2Token)).status === 403);
  check('Pending: /posts blocked', (await api('POST', '/posts', { content: 'X' }, pc2Token)).status === 403);
  check('Pending: approval_status inject ignored',
    (await api('PATCH', '/me/preferences', { approval_status: 'APPROVED' }, pc2Token)).status === 200 &&
    (await prisma.user.findUnique({ where: { id: pendingCoach2.id }, select: { approval_status: true } }))?.approval_status === 'PENDING'
  );

  // ═══════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════
  divider('CLEANUP');
  await prisma.notification.deleteMany({ where: { user_id: { in: cleanup } } }).catch(() => {});
  await prisma.organizationJoinRequest.deleteMany({ where: { user_id: { in: cleanup } } }).catch(() => {});
  for (const oid of cleanupOrgs) {
    await prisma.teamMembership.deleteMany({ where: { team: { organization_id: oid } } }).catch(() => {});
    await prisma.team.deleteMany({ where: { organization_id: oid } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: oid } }).catch(() => {});
  }
  await prisma.organization.deleteMany({ where: { id: { in: cleanupOrgs } } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanup } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: cleanup } } }).catch(() => {});
  console.log(`  🗑️  Cleaned ${cleanup.length} users, ${cleanupOrgs.length} orgs`);

  // ═══════════════════════════════════════════
  // FINAL SCORECARD
  // ═══════════════════════════════════════════
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                  FINAL SCORECARD                        ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(passed).padEnd(3)} / ${String(passed + failed).padEnd(3)}                                   ║`);
  console.log(`║  ❌ Failed: ${String(failed).padEnd(3)}                                          ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (failed === 0) {
    console.log('║  🏆 ALL TESTS PASSED — READY TO SHIP                    ║');
  } else {
    console.log('║  ⚠️  ISSUES FOUND — Review failures above               ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
