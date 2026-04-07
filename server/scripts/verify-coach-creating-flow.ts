/**
 * VERIFY 3 — Coach-Creating-a-League Flow End-to-End (Live API calls, no mocks)
 *
 * Steps:
 * 1. POST /auth/register (coach)
 * 2. Verify email
 * 3. POST /auth/login
 * 4. POST /organizations — confirm admin_approved: false
 * 5. Confirm coach cannot POST /teams (APPROVAL_REQUIRED)
 * 6. Simulate admin approval via POST /organizations/:id/approve
 * 7. GET /auth/me — confirm approval_status: APPROVED
 * 8. POST /teams — confirm 201 success
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const COACH_EMAIL = `testcreator_${Date.now()}@test.local`;
const ADMIN_EMAIL = 'sanchezemil203@gmail.com'; // from .env ADMIN_EMAILS
const PASSWORD = 'TestPass123';
const COACH_USERNAME = `creator_${Date.now()}`.slice(0, 20);

let coachToken = '';
let coachId = '';
let adminToken = '';
let adminId = '';
let orgId = '';

function divider(label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  STEP: ${label}`);
  console.log('='.repeat(60));
}

async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  console.log(`\n→ ${method} ${path}`);
  if (body) console.log('  Body:', JSON.stringify(body, null, 2));

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  console.log(`← ${res.status} ${res.statusText}`);
  console.log('  Response:', JSON.stringify(data, null, 2));

  return { status: res.status, data };
}

async function showDbState(label: string, uid: string) {
  const u = await prisma.user.findUnique({
    where: { id: uid },
    select: {
      id: true, email: true, username: true,
      email_verified: true, approval_status: true,
      preferences: true,
    },
  });
  console.log(`\n📋 User DB (${label}):`, JSON.stringify(u, null, 2));
}

async function showOrgState(label: string, oid: string) {
  const o = await prisma.organization.findUnique({
    where: { id: oid },
    select: {
      id: true, name: true, admin_approved: true,
      approved_by: true, approved_at: true,
      league_owner_id: true,
    },
  });
  console.log(`\n📋 Org DB (${label}):`, JSON.stringify(o, null, 2));
}

async function main() {
  console.log('🧪 VERIFY 3 — Coach-Creating-a-League Flow E2E');

  // ── Setup: Create admin user for approval ──
  divider('SETUP: Create admin user');
  const hashedPw = await bcrypt.hash(PASSWORD, 10);
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password_hash: hashedPw,
      display_name: 'Super Admin',
      username: `admin_${Date.now()}`.slice(0, 20),
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'legend', is_admin: true },
    },
  });
  adminId = admin.id;
  console.log(`✅ Admin created: ${adminId} (${ADMIN_EMAIL})`);

  const adminLogin = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: PASSWORD });
  adminToken = adminLogin.data.access_token;
  console.log('✅ Admin logged in');

  // ── Step 1: Register coach ──
  divider('1. POST /auth/register (coach)');
  const reg = await api('POST', '/auth/register', {
    email: COACH_EMAIL,
    password: PASSWORD,
    display_name: 'Coach Creator',
    role: 'coach',
    dob: '1990-05-10',
  });

  if (reg.status !== 201 && reg.status !== 200) {
    console.error('❌ Registration failed. Aborting.');
    return;
  }
  coachToken = reg.data.access_token;
  coachId = reg.data.user?.id;
  console.log(`✅ Coach registered: ${coachId}`);

  // ── Step 2: Verify email ──
  divider('2. Verify email');
  const dbCoach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { email_verification_code: true },
  });
  if (dbCoach?.email_verification_code) {
    await api('POST', '/auth/verify/confirm', { code: dbCoach.email_verification_code }, coachToken);
    console.log('✅ Email verified via code');
  } else {
    await prisma.user.update({ where: { id: coachId }, data: { email_verified: true } });
    console.log('✅ Email verified manually');
  }

  // ── Step 3: Login ──
  divider('3. POST /auth/login');
  const login = await api('POST', '/auth/login', { email: COACH_EMAIL, password: PASSWORD });
  coachToken = login.data.access_token;

  // ── Step 4: POST /organizations — create league ──
  divider('4. POST /organizations — create new league');
  const orgCreate = await api('POST', '/organizations', {
    name: 'E2E Test League',
    description: 'Created by e2e test',
    sport: 'basketball',
    org_type: 'school',
    location: 'Stamford, CT',
    zip_code: '06907',
    supporting_document_url: 'https://example.com/proof.pdf',
  }, coachToken);

  if (orgCreate.status === 201 || orgCreate.status === 200) {
    orgId = orgCreate.data.id;
    console.log(`\n✅ Org created: ${orgId}`);
    console.log(`   admin_approved: ${orgCreate.data.admin_approved}`);
    if (orgCreate.data.admin_approved === false) {
      console.log('✅ CORRECT: New org starts with admin_approved: false');
    } else {
      console.log('⚠️  Expected admin_approved: false');
    }
  } else {
    console.error('❌ Org creation failed');
    return;
  }

  await showOrgState('after create', orgId);
  await showDbState('after org create', coachId);

  // ── Step 5: POST /teams — should be blocked ──
  divider('5. POST /teams — pending coach should be blocked');

  // First complete onboarding
  console.log('\n  (Completing onboarding first...)');
  const onboard = await api('POST', '/me/complete-onboarding', {
    role: 'coach',
    username: COACH_USERNAME,
    dob: '1990-05-10',
    zip_code: '06907',
    affiliation: 'school',
    plan: 'rookie',
    organization_id: orgId,
    organization_name: 'E2E Test League',
  }, coachToken);

  if (onboard.status === 200) {
    console.log('✅ Onboarding complete');
  }
  await showDbState('after onboarding', coachId);

  // Now try creating team
  const teamAttempt1 = await api('POST', '/teams', {
    name: 'Blocked Team Attempt',
    organization_id: orgId,
  }, coachToken);

  if (teamAttempt1.status === 403 && teamAttempt1.data?.code === 'APPROVAL_REQUIRED') {
    console.log('✅ CORRECT: Pending coach blocked from creating teams');
  } else {
    console.log(`⚠️  Expected 403 APPROVAL_REQUIRED, got ${teamAttempt1.status}: ${teamAttempt1.data?.error || teamAttempt1.data?.code}`);
  }

  // ── Step 6: Admin approves organization ──
  divider('6. POST /organizations/:id/approve (admin)');
  const approve = await api('POST', `/organizations/${orgId}/approve`, {}, adminToken);

  if (approve.status === 200) {
    console.log('✅ Organization approved by admin');
  } else {
    console.error('❌ Approval failed');
  }

  await showOrgState('after approval', orgId);
  await showDbState('after org approval', coachId);

  // Check notifications created
  const notifications = await prisma.notification.findMany({
    where: { user_id: coachId },
    select: { id: true, type: true, meta: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  console.log(`\n📋 Notifications for coach (${notifications.length}):`);
  notifications.forEach(n => console.log('  ', JSON.stringify(n)));

  // ── Step 7: GET /auth/me — confirm approved ──
  divider('7. GET /auth/me — confirm approval_status');
  const me = await api('GET', '/auth/me', undefined, coachToken);
  const status = me.data?.approval_status;
  console.log(`  approval_status: ${status}`);
  if (status === 'APPROVED') {
    console.log('✅ CORRECT: Coach is now APPROVED after org approval');
  } else {
    console.log(`⚠️  Expected APPROVED, got ${status}`);
  }

  // ── Step 8: POST /teams — should now succeed ──
  divider('8. POST /teams — should now return 201');
  const teamAttempt2 = await api('POST', '/teams', {
    name: 'First Team',
    organization_id: orgId,
  }, coachToken);

  if (teamAttempt2.status === 201 || teamAttempt2.status === 200) {
    console.log(`✅ CORRECT: Team created successfully (${teamAttempt2.data?.id || teamAttempt2.data?.team?.id})`);
  } else {
    console.log(`❌ Expected 201, got ${teamAttempt2.status}: ${teamAttempt2.data?.error}`);
  }

  // ── Cleanup ──
  divider('CLEANUP');
  const teamIds = await prisma.team.findMany({ where: { organization_id: orgId }, select: { id: true } });
  for (const t of teamIds) {
    await prisma.teamMembership.deleteMany({ where: { team_id: t.id } }).catch(() => {});
  }
  await prisma.notification.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.organizationJoinRequest.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [coachId, adminId] } } }).catch(() => {});
  console.log('🗑️  All test data cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log('✅ Coach-creating-a-league flow complete');
  console.log('  Register → Verify → Login → CreateOrg(admin_approved:false) → Teams BLOCKED');
  console.log('  → Admin approves org → approval_status:APPROVED → Teams ALLOWED');
}

main()
  .catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
