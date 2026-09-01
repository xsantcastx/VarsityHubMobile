/**
 * VERIFY — Coach join-request flow end to end (live API calls, no mocks)
 *
 * Canonical story:
 * 1. Register as fan
 * 2. Verify email + login
 * 3. Upgrade to coach
 * 4. Complete coach onboarding against an existing org
 * 5. Submit join request
 * 6. Confirm pending coach gates
 * 7. League owner approves the request
 * 8. Coach accepts the agreement
 * 9. /auth/me settles at coach_active
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = process.env.VERIFY_COACH_FLOW_BASE_URL || 'http://localhost:4000';
const prisma = new PrismaClient();
const RUN_ID = Date.now();
const REQUEST_TIMEOUT_MS = 10_000;
const REQUIRED_COACH_AGREEMENT_VERSION = Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1);

const COACH_EMAIL = `testcoach_${RUN_ID}@test.local`;
const OWNER_EMAIL = `testowner_${RUN_ID}@test.local`;
const PASSWORD = 'TestPass123!';
const COACH_USERNAME = `coach_${RUN_ID}`.slice(0, 20);
const OWNER_USERNAME = `owner_${RUN_ID}`.slice(0, 20);
const ORG_NAME = `Test League E2E ${RUN_ID}`;
const TEAM_NAME = `Test Team E2E ${RUN_ID}`;
const DOB = '1995-06-15';

let coachToken = '';
let coachId = '';
let ownerToken = '';
let ownerId = '';
let orgId = '';
let teamId = '';
let joinRequestId = '';
let coachVerificationCode = '';

function divider(label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  STEP: ${label}`);
  console.log('='.repeat(60));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function api(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  console.log(`\n→ ${method} ${path}`);
  if (body !== undefined) {
    console.log('  Body:', JSON.stringify(body, null, 2));
  }

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  console.log(`← ${res.status} ${res.statusText}`);
  console.log('  Response:', JSON.stringify(data, null, 2));

  return { status: res.status, data };
}

async function assertApiReachable() {
  try {
    const res = await fetch(`${BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`/health returned ${res.status}`);
    }
  } catch {
    throw new Error(
      `Local API is not reachable at ${BASE}. Start the server before running verify:coach-flow.`
    );
  }
}

async function showDbState(label: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      email_verified: true,
      approval_status: true,
      onboarding_completed: true,
      organization_id: true,
      proceeding_as_fan: true,
      coach_agreement_accepted_at: true,
      coach_agreement_version: true,
      paid_by_owner: true,
      preferences: true,
    },
  });
  console.log(`\n📋 DB State (${label}):`);
  console.log(JSON.stringify(user, null, 2));
}

async function cleanup() {
  if (coachId) {
    await prisma.notification.deleteMany({ where: { user_id: coachId } }).catch(() => {});
    await prisma.organizationJoinRequest
      .deleteMany({ where: { user_id: coachId } })
      .catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { user_id: coachId } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  }
  if (ownerId) {
    await prisma.teamMembership.deleteMany({ where: { user_id: ownerId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { user_id: ownerId } }).catch(() => {});
  }
  if (teamId) {
    await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
  }
  if (orgId) {
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  }
  await prisma.user
    .deleteMany({
      where: { email: { in: [COACH_EMAIL, OWNER_EMAIL] } },
    })
    .catch(() => {});
}

async function getMe(token: string) {
  const res = await api('GET', '/auth/me', undefined, token);
  assert(res.status === 200, `/auth/me failed with ${res.status}`);
  return res.data;
}

async function main() {
  console.log('🧪 VERIFY — Coach join-request flow end to end');

  divider('PREFLIGHT: Check local API availability');
  await assertApiReachable();
  console.log(`✅ API reachable at ${BASE}`);

  divider('SETUP: Create approved league owner + organization');
  const hashedPw = await bcrypt.hash(PASSWORD, 10);
  const owner = await prisma.user.create({
    data: {
      email: OWNER_EMAIL,
      password_hash: hashedPw,
      display_name: 'Test Owner',
      username: OWNER_USERNAME,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: REQUIRED_COACH_AGREEMENT_VERSION,
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'rookie',
        affiliation: 'school',
        coach_agreement_accepted_at: new Date().toISOString(),
        coach_agreement_version: REQUIRED_COACH_AGREEMENT_VERSION,
      },
    },
  });
  ownerId = owner.id;
  console.log(`✅ Owner created: ${ownerId}`);

  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      org_type: 'club',
      league_owner_id: ownerId,
      admin_approved: true,
      updated_at: new Date(),
    },
  });
  orgId = org.id;
  console.log(`✅ Org created: ${orgId}`);

  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
  });

  const team = await prisma.team.create({
    data: {
      name: TEAM_NAME,
      organization_id: orgId,
      sport: 'basketball',
    },
  });
  teamId = team.id;
  console.log(`✅ Team created: ${teamId}`);

  const ownerLogin = await api('POST', '/auth/login', { email: OWNER_EMAIL, password: PASSWORD });
  assert(ownerLogin.status === 200, `Owner login failed with ${ownerLogin.status}`);
  ownerToken = ownerLogin.data.access_token;
  assert(ownerToken, 'Owner login did not return an access token');

  divider('1. Register as fan');
  const register = await api('POST', '/auth/register', {
    email: COACH_EMAIL,
    password: PASSWORD,
    display_name: 'Test Coach',
    role: 'fan',
    dob: DOB,
  });
  assert(
    register.status === 200 || register.status === 201,
    `Register failed with ${register.status}`
  );
  coachToken = register.data.access_token;
  coachId = register.data.user?.id;
  coachVerificationCode = String(register.data.dev_verification_code || '');
  assert(coachToken && coachId, 'Register did not return coach credentials');
  await showDbState('after register', coachId);

  divider('2. Verify email');
  if (coachVerificationCode) {
    const verify = await api(
      'POST',
      '/auth/verify/confirm',
      { code: coachVerificationCode },
      coachToken
    );
    assert(verify.status === 200, `Email verify failed with ${verify.status}`);
  } else {
    await prisma.user.update({ where: { id: coachId }, data: { email_verified: true } });
  }
  await showDbState('after verify', coachId);

  divider('3. Login as fan');
  const login = await api('POST', '/auth/login', { email: COACH_EMAIL, password: PASSWORD });
  assert(login.status === 200, `Coach login failed with ${login.status}`);
  coachToken = login.data.access_token;
  assert(coachToken, 'Coach login did not return an access token');

  divider('4. Upgrade to coach');
  const upgrade = await api('POST', '/auth/upgrade-to-coach', { plan: 'rookie' }, coachToken);
  assert(upgrade.status === 200, `Upgrade to coach failed with ${upgrade.status}`);

  const meAfterUpgrade = await getMe(coachToken);
  assert(
    meAfterUpgrade.account_state === 'coach_basic_info_required',
    `Expected coach_basic_info_required after upgrade, got ${meAfterUpgrade.account_state}`
  );
  assert(
    meAfterUpgrade.next_step === '/onboarding/step-2-basic',
    `Expected /onboarding/step-2-basic after upgrade, got ${meAfterUpgrade.next_step}`
  );

  divider('5. Complete coach onboarding for existing organization');
  const onboarding = await api(
    'POST',
    '/auth/me/complete-onboarding',
    {
      role: 'coach',
      username: COACH_USERNAME,
      display_name: 'Test Coach',
      dob: DOB,
      zip_code: '06907',
      affiliation: 'school',
      organization_id: orgId,
      organization_name: ORG_NAME,
      join_request_pending: true,
    },
    coachToken
  );
  assert(onboarding.status === 200, `Complete onboarding failed with ${onboarding.status}`);

  divider('6. Submit organization join request');
  const joinReq = await api(
    'POST',
    '/organizations/join-requests',
    {
      organization_id: orgId,
      message: 'I want to coach basketball',
    },
    coachToken
  );
  assert(joinReq.status === 201, `Join request failed with ${joinReq.status}`);
  joinRequestId = String(joinReq.data?.request?.id || '');
  const joinRequestRow = await prisma.organizationJoinRequest.findFirst({
    where: { user_id: coachId, organization_id: orgId },
    select: { id: true, status: true },
  });
  assert(
    joinRequestRow?.status === 'pending',
    `Expected pending join request, got ${joinRequestRow?.status}`
  );
  if (!joinRequestId && joinRequestRow?.id) {
    joinRequestId = joinRequestRow.id;
  }
  assert(joinRequestId, 'Join request id was not recorded');

  const mePending = await getMe(coachToken);
  assert(
    mePending.account_state === 'coach_pending_approval',
    `Expected coach_pending_approval after join request, got ${mePending.account_state}`
  );
  assert(
    mePending.next_step === '/onboarding/pending-approval',
    `Expected /onboarding/pending-approval after join request, got ${mePending.next_step}`
  );
  await showDbState('after join request', coachId);

  divider('7. Confirm pending coach gates');
  const blockedTeam = await api(
    'POST',
    '/teams/create',
    {
      name: 'Coach Team Attempt',
      organization_id: orgId,
      club_type: 'sport',
    },
    coachToken
  );
  assert(blockedTeam.status === 403, `Expected team create 403, got ${blockedTeam.status}`);

  const blockedPost = await api(
    'POST',
    '/posts',
    { content: 'Pending coach blocked post' },
    coachToken
  );
  assert(blockedPost.status === 403, `Expected post create 403, got ${blockedPost.status}`);

  const nonOwnerView = await api(
    'GET',
    `/organizations/${orgId}/join-requests`,
    undefined,
    coachToken
  );
  assert(
    nonOwnerView.status === 403,
    `Expected join-request list 403 for coach, got ${nonOwnerView.status}`
  );

  divider('8. League owner approves join request');
  const ownerList = await api(
    'GET',
    `/organizations/${orgId}/join-requests`,
    undefined,
    ownerToken
  );
  assert(ownerList.status === 200, `Owner join-request list failed with ${ownerList.status}`);

  const approve = await api(
    'POST',
    `/organizations/join-requests/${joinRequestId}/approve`,
    {},
    ownerToken
  );
  assert(approve.status === 200, `Join request approval failed with ${approve.status}`);

  const meApproved = await getMe(coachToken);
  assert(
    meApproved.account_state === 'coach_active',
    `Expected coach_active after approval, got ${meApproved.account_state}`
  );
  assert(
    meApproved.next_step === '/(tabs)',
    `Expected /(tabs) after approval, got ${meApproved.next_step}`
  );

  const approvalNotification = await prisma.notification.findFirst({
    where: { user_id: coachId, type: 'JOIN_REQUEST_APPROVED' },
    orderBy: { created_at: 'desc' },
    select: { id: true, type: true, meta: true },
  });
  assert(approvalNotification, 'JOIN_REQUEST_APPROVED notification was not created');

  divider('9. Re-accept coach agreement idempotently');
  const agreement = await api(
    'PATCH',
    '/auth/me/preferences',
    {
      coach_agreement_accepted_at: new Date().toISOString(),
    },
    coachToken
  );
  assert(agreement.status === 200, `Agreement acceptance failed with ${agreement.status}`);

  const meActive = await getMe(coachToken);
  assert(
    meActive.account_state === 'coach_active',
    `Expected coach_active after agreement, got ${meActive.account_state}`
  );
  assert(
    meActive.next_step === '/(tabs)',
    `Expected /(tabs) after agreement, got ${meActive.next_step}`
  );
  await showDbState('after agreement', coachId);

  divider('RESULTS');
  console.log('✅ Canonical coach join-request flow verified');
  console.log(
    '   fan register → verify → upgrade-to-coach → onboarding → join request → owner approve → agreement → active'
  );
}

main()
  .catch(err => {
    console.error('💥 Script error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
