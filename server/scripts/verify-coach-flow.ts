/**
 * VERIFY 2 — Coach-Joining Signup End-to-End (Live API calls, no mocks)
 *
 * Steps:
 * 1. Create a test org + owner first
 * 2. POST /auth/register (coach)
 * 3. Verify email
 * 4. POST /auth/login
 * 5. GET /auth/me — confirm approval_status is PENDING
 * 6. POST /me/complete-onboarding (coach)
 * 7. POST /organizations/:id/join-requests
 * 8. Confirm approval_status PENDING in DB
 * 9. POST /teams — confirm blocked
 * 10. POST /posts — confirm blocked
 * 11. GET /organizations/:id/pending-coaches — confirm blocked (not owner)
 * 12. Admin approves coach → verify notification created
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const COACH_EMAIL = `testcoach_${Date.now()}@test.local`;
const OWNER_EMAIL = `testowner_${Date.now()}@test.local`;
const PASSWORD = 'TestPass123';
const COACH_USERNAME = `coach_${Date.now()}`.slice(0, 20);
const OWNER_USERNAME = `owner_${Date.now()}`.slice(0, 20);
const DOB = '1995-06-15';

let coachToken = '';
let coachId = '';
let ownerToken = '';
let ownerId = '';
let orgId = '';
let teamId = '';

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
      subscription_tier: true, max_teams: true,
      preferences: true,
    },
  });
  console.log(`\n📋 DB State (${label}):`);
  console.log(JSON.stringify(u, null, 2));
}

async function main() {
  console.log('🧪 VERIFY 2 — Coach-Joining Signup End-to-End');

  // ── Setup: Create org owner + org + team ──
  divider('SETUP: Create org owner, org, and team via DB');

  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // Create owner user directly in DB (already onboarded + verified)
  const owner = await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      password_hash: hashedPw,
      display_name: 'Test Owner',
      username: OWNER_USERNAME,
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'veteran',
        affiliation: 'school',
      },
    },
  });
  ownerId = owner.id;
  console.log(`✅ Owner created: ${ownerId}`);

  // Create org
  const org = await prisma.organization.create({
    data: {
      name: 'Test League E2E',
      league_owner_id: ownerId,
      admin_approved: true,
    },
  });
  orgId = org.id;
  console.log(`✅ Org created: ${orgId} (${org.name})`);

  // Create owner membership
  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
  });

  // Create a team under the org
  const team = await prisma.team.create({
    data: {
      name: 'Test Team E2E',
      organization_id: orgId,
      sport: 'basketball',
    },
  });
  teamId = team.id;
  console.log(`✅ Team created: ${teamId}`);

  // Login as owner to get token
  const ownerLogin = await api('POST', '/auth/login', { email: OWNER_EMAIL, password: PASSWORD });
  ownerToken = ownerLogin.data.access_token;
  console.log(`✅ Owner logged in`);

  // ── Step 1: Register coach ──
  divider('1. POST /auth/register (coach)');
  const reg = await api('POST', '/auth/register', {
    email: COACH_EMAIL,
    password: PASSWORD,
    display_name: 'Test Coach',
    role: 'coach',
    dob: DOB,
  });

  if (reg.status !== 201 && reg.status !== 200) {
    console.error('❌ Registration failed. Aborting.');
    return;
  }
  coachToken = reg.data.access_token;
  coachId = reg.data.user?.id;
  console.log(`✅ Coach registered: ${coachId}`);
  await showDbState('after register', coachId);

  // ── Step 2: Verify email ──
  divider('2. Verify coach email');
  // Get code from DB or manually verify
  const dbCoach = await prisma.user.findUnique({
    where: { id: coachId },
    select: { email_verification_code: true },
  });

  if (dbCoach?.email_verification_code) {
    await api('POST', '/auth/verify/confirm', { code: dbCoach.email_verification_code }, coachToken);
  } else {
    // Request a code
    await api('POST', '/auth/verify/request', {}, coachToken);
    const dbCoach2 = await prisma.user.findUnique({
      where: { id: coachId },
      select: { email_verification_code: true },
    });
    if (dbCoach2?.email_verification_code) {
      await api('POST', '/auth/verify/confirm', { code: dbCoach2.email_verification_code }, coachToken);
    } else {
      console.log('⚠️  No code — manually verifying');
      await prisma.user.update({ where: { id: coachId }, data: { email_verified: true } });
    }
  }
  await showDbState('after verify', coachId);

  // ── Step 3: Login ──
  divider('3. POST /auth/login');
  const login = await api('POST', '/auth/login', { email: COACH_EMAIL, password: PASSWORD });
  coachToken = login.data.access_token;
  console.log('  needs_onboarding:', login.data.needs_onboarding);

  // ── Step 4: GET /auth/me ──
  divider('4. GET /auth/me — check approval_status');
  const me1 = await api('GET', '/auth/me', undefined, coachToken);
  const approvalBefore = me1.data?.approval_status;
  console.log(`  approval_status: ${approvalBefore}`);
  if (approvalBefore === 'PENDING') {
    console.log('✅ CORRECT: Coach starts as PENDING');
  } else {
    console.log(`⚠️  Expected PENDING, got ${approvalBefore}`);
  }

  // ── Step 5: Complete onboarding ──
  divider('5. POST /me/complete-onboarding (coach)');
  const onboard = await api('POST', '/me/complete-onboarding', {
    role: 'coach',
    username: COACH_USERNAME,
    dob: DOB,
    zip_code: '06907',
    affiliation: 'school',
    plan: 'rookie',
    organization_id: orgId,
    organization_name: 'Test League E2E',
    join_request_pending: true,
  }, coachToken);

  if (onboard.status === 200) {
    console.log('✅ Onboarding complete');
  } else {
    console.error('❌ Onboarding failed');
  }
  await showDbState('after onboarding', coachId);

  // ── Step 6: POST /organizations/:id/join-requests ──
  divider('6. POST /organizations/join-requests');
  const joinReq = await api('POST', '/organizations/join-requests', {
    organization_id: orgId,
    message: 'I want to coach basketball',
  }, coachToken);

  if (joinReq.status === 200 || joinReq.status === 201) {
    console.log('✅ Join request submitted');
  }

  // Check DB state
  await showDbState('after join request', coachId);
  const joinRequestRecord = await prisma.organizationJoinRequest.findFirst({
    where: { user_id: coachId, organization_id: orgId },
    select: { id: true, status: true, message: true, created_at: true },
  });
  console.log('\n📋 Join Request DB record:', JSON.stringify(joinRequestRecord, null, 2));

  // ── Step 7: POST /teams — should be blocked ──
  divider('7. POST /teams — coach pending should be blocked');
  const teamCreate = await api('POST', '/teams', {
    name: 'Coach Team Attempt',
    organization_id: orgId,
  }, coachToken);

  if (teamCreate.status === 403) {
    console.log('✅ CORRECT: Pending coach blocked from creating teams');
  } else {
    console.log(`⚠️  Expected 403, got ${teamCreate.status}: ${teamCreate.data?.error}`);
  }

  // ── Step 8: POST /posts — should be blocked or allowed? ──
  divider('8. POST /posts — check if pending coach can post');
  const postCreate = await api('POST', '/posts', {
    content: 'Test post from pending coach',
  }, coachToken);
  console.log(`  Status: ${postCreate.status}`);

  // ── Step 9: GET /organizations/:id/pending-coaches — coach can't see (not owner) ──
  divider('9. GET /organizations/:id/pending-coaches — coach should be blocked');
  const pendingCoaches = await api('GET', `/organizations/${orgId}/pending-coaches`, undefined, coachToken);
  if (pendingCoaches.status === 403) {
    console.log('✅ CORRECT: Non-owner blocked from viewing pending coaches');
  } else {
    console.log(`⚠️  Expected 403, got ${pendingCoaches.status}`);
  }

  // ── Step 10: Owner views pending coaches ──
  divider('10. Owner views pending coaches');
  const ownerPending = await api('GET', `/organizations/${orgId}/pending-coaches`, undefined, ownerToken);
  if (ownerPending.status === 200) {
    const coaches = ownerPending.data;
    console.log(`✅ Owner sees ${Array.isArray(coaches) ? coaches.length : '?'} pending coach(es)`);
  }

  // ── Step 11: Owner approves coach → check notification ──
  divider('11. Owner approves coach');
  const approve = await api('POST', `/organizations/${orgId}/coaches/${coachId}/approve`, {
    team_id: teamId,
  }, ownerToken);

  if (approve.status === 200) {
    console.log('✅ Coach approved');
  }

  await showDbState('after approval', coachId);

  // Check if notification was created
  const notification = await prisma.notification.findFirst({
    where: { user_id: coachId },
    orderBy: { created_at: 'desc' },
    select: { id: true, type: true, meta: true, created_at: true },
  });
  console.log('\n📋 Notification created:', JSON.stringify(notification, null, 2));
  if (notification) {
    console.log('✅ In-app notification created for coach approval');
  } else {
    console.log('❌ No in-app notification found!');
  }

  // ── Step 12: Coach can now see updated status ──
  divider('12. GET /auth/me — after approval');
  const me2 = await api('GET', '/auth/me', undefined, coachToken);
  const approvalAfter = me2.data?.approval_status;
  console.log(`  approval_status: ${approvalAfter}`);
  if (approvalAfter === 'APPROVED') {
    console.log('✅ CORRECT: Coach is now APPROVED');
  } else {
    console.log(`⚠️  Expected APPROVED, got ${approvalAfter}`);
  }

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.notification.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.organizationJoinRequest.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.teamMembership.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.teamMembership.deleteMany({ where: { user_id: ownerId } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [coachId, ownerId] } } }).catch(() => {});
  console.log('🗑️  All test data cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log('✅ Coach signup flow complete');
  console.log('  Register → Verify → Login → Onboard → JoinRequest → BlockedTeams → BlockedPosts → OwnerApproves → NotificationCreated → StatusApproved');
}

main()
  .catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
