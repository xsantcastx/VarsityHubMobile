/**
 * VERIFY 5 — Confirm guards cannot be bypassed
 *
 * Tests every bypass attempt against a PENDING coach JWT.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const COACH_EMAIL = `bypass_${ts}@test.local`;
const OWNER_EMAIL = `bypassowner_${ts}@test.local`;
const PASSWORD = 'TestPass123';

let coachToken = '';
let coachId = '';
let ownerToken = '';
let ownerId = '';
let orgId = '';

let passed = 0;
let failed = 0;

function divider(label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${label}`);
  console.log('='.repeat(60));
}

function check(label: string, condition: boolean, details?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${label}${details ? ` — ${details}` : ''}`);
  }
}

async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  console.log(`\n  → ${method} ${path}`);

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  console.log(`  ← ${res.status} ${JSON.stringify(data).substring(0, 200)}`);
  return { status: res.status, data };
}

async function main() {
  console.log('🧪 VERIFY 5 — Guard Bypass Attempts (PENDING Coach)');

  // ── Setup ──
  divider('SETUP: Create pending coach + org owner');
  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // Owner
  const owner = await prisma.user.create({
    data: {
      email: OWNER_EMAIL, password_hash: hashedPw,
      display_name: 'Owner', username: `bowner_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'veteran' },
    },
  });
  ownerId = owner.id;

  const org = await prisma.organization.create({
    data: { name: 'Bypass Test League', league_owner_id: ownerId, admin_approved: true },
  });
  orgId = org.id;

  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
  });

  const ownerLogin = await api('POST', '/auth/login', { email: OWNER_EMAIL, password: PASSWORD });
  ownerToken = ownerLogin.data.access_token;

  // Pending coach
  const coach = await prisma.user.create({
    data: {
      email: COACH_EMAIL, password_hash: hashedPw,
      display_name: 'Bypass Coach', username: `bcoach_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'PENDING',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie', organization_id: orgId },
    },
  });
  coachId = coach.id;

  // Add coach as org member (but pending approval)
  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: coachId, role: 'member', status: 'active' },
  });

  const coachLogin = await api('POST', '/auth/login', { email: COACH_EMAIL, password: PASSWORD });
  coachToken = coachLogin.data.access_token;

  console.log(`  Coach: ${coachId} (PENDING)`);
  console.log(`  Org: ${orgId}`);

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 1: POST /teams
  // ═══════════════════════════════════════════
  divider('BYPASS 1: POST /teams — expect APPROVAL_REQUIRED');
  const t1 = await api('POST', '/teams', { name: 'Hack Team', organization_id: orgId }, coachToken);
  check('POST /teams blocked with 403', t1.status === 403);
  check('Error code is APPROVAL_REQUIRED', t1.data?.code === 'APPROVAL_REQUIRED');

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 2: POST /posts
  // ═══════════════════════════════════════════
  divider('BYPASS 2: POST /posts — expect blocked');
  const t2 = await api('POST', '/posts', { content: 'Bypass post attempt', team_id: 'fake' }, coachToken);
  check('POST /posts blocked with 403', t2.status === 403);
  check('Error code is APPROVAL_REQUIRED', t2.data?.code === 'APPROVAL_REQUIRED');

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 3: PATCH /organizations/:id
  // ═══════════════════════════════════════════
  divider('BYPASS 3: PATCH /organizations/:id — expect blocked');
  const t3 = await api('PATCH', `/organizations/${orgId}`, { name: 'Hacked League' }, coachToken);
  check('PATCH /organizations blocked', t3.status === 403);

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 4: GET /organizations/:id/pending-coaches
  // ═══════════════════════════════════════════
  divider('BYPASS 4: GET /organizations/:id/pending-coaches — expect blocked');
  const t4 = await api('GET', `/organizations/${orgId}/pending-coaches`, undefined, coachToken);
  check('GET pending-coaches blocked with 403', t4.status === 403);

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 5: POST /organizations/:id/coaches/:userId/approve (self-approve)
  // ═══════════════════════════════════════════
  divider('BYPASS 5: POST coaches/approve — self-approve attempt');
  const t5 = await api('POST', `/organizations/${orgId}/coaches/${coachId}/approve`, {}, coachToken);
  check('Self-approve blocked with 403', t5.status === 403);

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 6: Inject approval_status in various endpoints
  // ═══════════════════════════════════════════
  divider('BYPASS 6: Inject approval_status in request body');

  // 6a: PATCH /me/preferences with approval_status
  const t6a = await api('PATCH', '/me/preferences', {
    approval_status: 'APPROVED',
    role: 'coach',
  }, coachToken);

  // Check DB — approval_status should STILL be PENDING
  const dbAfter6a = await prisma.user.findUnique({
    where: { id: coachId },
    select: { approval_status: true },
  });
  console.log(`  DB approval_status after inject: ${dbAfter6a?.approval_status}`);
  check('approval_status still PENDING after preferences inject', dbAfter6a?.approval_status === 'PENDING');

  // 6b: PATCH /me with approval_status
  const t6b = await api('PATCH', '/me', {
    approval_status: 'APPROVED',
    display_name: 'Hacker',
  }, coachToken);

  const dbAfter6b = await prisma.user.findUnique({
    where: { id: coachId },
    select: { approval_status: true, display_name: true },
  });
  console.log(`  DB approval_status after /me inject: ${dbAfter6b?.approval_status}`);
  console.log(`  DB display_name: ${dbAfter6b?.display_name}`);
  check('approval_status still PENDING after /me inject', dbAfter6b?.approval_status === 'PENDING');

  // 6c: POST /me/complete-onboarding with approval_status
  const t6c = await api('POST', '/me/complete-onboarding', {
    role: 'coach',
    username: `bcoach_${ts}`.slice(0, 20),
    dob: '1990-01-01',
    approval_status: 'APPROVED',
    plan: 'rookie',
    organization_id: orgId,
  }, coachToken);

  const dbAfter6c = await prisma.user.findUnique({
    where: { id: coachId },
    select: { approval_status: true },
  });
  console.log(`  DB approval_status after onboarding inject: ${dbAfter6c?.approval_status}`);
  check('approval_status still PENDING after onboarding inject', dbAfter6c?.approval_status === 'PENDING');

  // ═══════════════════════════════════════════
  // BYPASS ATTEMPT 7: Change role to fan then back to coach
  // ═══════════════════════════════════════════
  divider('BYPASS 7: Role flip attack — change to fan then back to coach');

  // Switch to fan (should get APPROVED as fan)
  const t7a = await api('PATCH', '/me/preferences', { role: 'fan' }, coachToken);
  const dbAfterFan = await prisma.user.findUnique({
    where: { id: coachId },
    select: { approval_status: true, preferences: true },
  });
  const fanPrefs = dbAfterFan?.preferences as any;
  console.log(`  After role→fan: approval_status=${dbAfterFan?.approval_status}, prefs.role=${fanPrefs?.role}`);

  // Switch back to coach (should be forced to PENDING)
  const t7b = await api('PATCH', '/me/preferences', { role: 'coach' }, coachToken);
  const dbAfterCoach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { approval_status: true, preferences: true },
  });
  const coachPrefs = dbAfterCoach?.preferences as any;
  console.log(`  After role→coach: approval_status=${dbAfterCoach?.approval_status}, prefs.role=${coachPrefs?.role}`);
  check('Role flip: coach→fan→coach forces PENDING', dbAfterCoach?.approval_status === 'PENDING');

  // Verify they're still blocked
  const t7c = await api('POST', '/posts', { content: 'After role flip' }, coachToken);
  check('Still blocked after role flip attack', t7c.status === 403);

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [coachId, ownerId] } } }).catch(() => {});
  console.log('🗑️  Cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  if (failed === 0) {
    console.log('  🔒 ALL GUARDS HELD — No bypass possible');
  } else {
    console.log('  ⚠️  SECURITY ISSUES FOUND — Review failed checks');
  }
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
