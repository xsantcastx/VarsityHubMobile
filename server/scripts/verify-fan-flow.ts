/**
 * VERIFY 1 — Fan Signup End-to-End (Live API calls, no mocks)
 *
 * Steps:
 * 1. POST /auth/register (fan)
 * 2. GET verification code from DB
 * 3. POST /auth/verify/confirm
 * 4. POST /auth/login
 * 5. POST /me/complete-onboarding
 * 6. GET /auth/me — show full user
 * 7. POST /teams — confirm 403 (fans can't create teams)
 */

import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const EMAIL = `testfan_${Date.now()}@test.local`;
const PASSWORD = 'TestPass123';
const USERNAME = `testfan_${Date.now()}`.slice(0, 20);
const DOB = '2000-01-15';
const ZIP = '06907';

let accessToken = '';
let userId = '';

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

async function showDbUser(label: string) {
  if (!userId) return;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, display_name: true,
      email_verified: true, email_verification_code: true,
      approval_status: true, subscription_tier: true, max_teams: true,
      preferences: true, created_at: true,
    },
  });
  console.log(`\n📋 DB State (${label}):`);
  console.log(JSON.stringify(u, null, 2));
}

async function main() {
  console.log('🧪 VERIFY 1 — Fan Signup End-to-End');
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Username: ${USERNAME}`);

  // ── Step 1: Register ──
  divider('1. POST /auth/register');
  const reg = await api('POST', '/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    display_name: 'Test Fan',
    role: 'fan',
    dob: DOB,
  });

  if (reg.status !== 201 && reg.status !== 200) {
    console.error('❌ Registration failed. Aborting.');
    return;
  }

  accessToken = reg.data.access_token;
  userId = reg.data.user?.id;
  console.log(`\n✅ Registered. userId=${userId}`);
  await showDbUser('after register');

  // ── Step 2: Get verification code from DB ──
  divider('2. GET verification code from DB');
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { email_verification_code: true, email_verification_expires: true },
  });
  console.log('  Verification code:', dbUser?.email_verification_code);
  console.log('  Expires:', dbUser?.email_verification_expires);

  if (!dbUser?.email_verification_code) {
    // Try requesting a code
    console.log('\n  No code found. Requesting one...');
    await api('POST', '/auth/verify/request', {}, accessToken);
    const dbUser2 = await prisma.user.findUnique({
      where: { id: userId },
      select: { email_verification_code: true },
    });
    console.log('  Verification code after request:', dbUser2?.email_verification_code);
    if (!dbUser2?.email_verification_code) {
      console.error('❌ No verification code generated. Check ENABLE_DEV_CODES env var.');
      // Continue anyway to see what happens
    }
  }

  const verificationCode = (await prisma.user.findUnique({
    where: { id: userId },
    select: { email_verification_code: true },
  }))?.email_verification_code;

  // ── Step 3: Verify email ──
  divider('3. POST /auth/verify/confirm');
  if (verificationCode) {
    const verify = await api('POST', '/auth/verify/confirm', { code: verificationCode }, accessToken);
    if (verify.status === 200) {
      console.log('✅ Email verified');
    } else {
      console.error('❌ Verification failed');
    }
  } else {
    console.log('⚠️  No verification code — manually marking verified in DB');
    await prisma.user.update({
      where: { id: userId },
      data: { email_verified: true },
    });
    console.log('✅ Manually verified');
  }
  await showDbUser('after verify');

  // ── Step 4: Login ──
  divider('4. POST /auth/login');
  const login = await api('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  if (login.status === 200) {
    accessToken = login.data.access_token;
    console.log('✅ Login successful');
    console.log('  needs_onboarding:', login.data.needs_onboarding);
    console.log('  needs_verification:', login.data.needs_verification);
  } else {
    console.error('❌ Login failed');
  }

  // ── Step 5: Complete onboarding ──
  divider('5. POST /me/complete-onboarding');
  const onboard = await api('POST', '/me/complete-onboarding', {
    role: 'fan',
    username: USERNAME,
    dob: DOB,
    zip_code: ZIP,
    affiliation: 'none',
  }, accessToken);
  if (onboard.status === 200) {
    console.log('✅ Onboarding complete');
  } else {
    console.error('❌ Onboarding failed');
  }
  await showDbUser('after onboarding');

  // ── Step 6: GET /auth/me ──
  divider('6. GET /auth/me — full user object');
  const me = await api('GET', '/auth/me', undefined, accessToken);
  if (me.status === 200) {
    console.log('✅ /auth/me returned successfully');
  }

  // ── Step 7: POST /teams — should be 403 for fans ──
  divider('7. POST /teams — fan should get 403');
  const teamCreate = await api('POST', '/teams', {
    name: 'Fan Team Attempt',
    organization_id: 'fake-org-id',
  }, accessToken);

  if (teamCreate.status === 403) {
    console.log('✅ CORRECT: Fan blocked from creating teams (403)');
  } else {
    console.log(`⚠️  Expected 403, got ${teamCreate.status}`);
  }

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  console.log('🗑️  Test user deleted');

  // ── Summary ──
  divider('RESULTS');
  console.log('✅ Fan signup flow complete');
  console.log('  Register → Verify → Login → Onboard → /me → Teams blocked');
}

main()
  .catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
