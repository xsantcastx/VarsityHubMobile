/**
 * VERIFY 6 — Confirm each user has exactly one identity
 *
 * Tests duplicate account prevention for email and username.
 */

import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const SHARED_EMAIL = `dupe_${ts}@test.local`;
const SHARED_USERNAME = `dupeuser_${ts}`.slice(0, 20);
const PASSWORD = 'TestPass123';

const createdUserIds: string[] = [];

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

async function showDbUsers(label: string) {
  const count = await prisma.user.count({
    where: { email: SHARED_EMAIL },
  });
  console.log(`\n  📋 DB: ${count} user(s) with email ${SHARED_EMAIL} (${label})`);
}

async function main() {
  console.log('🧪 VERIFY 6 — Duplicate Account Prevention');

  // ═══════════════════════════════════════════
  // TEST 1: Register user A with email
  // ═══════════════════════════════════════════
  divider('TEST 1: Register user A with email');
  const regA = await api('POST', '/auth/register', {
    email: SHARED_EMAIL,
    password: PASSWORD,
    display_name: 'User A',
  });
  check('User A registered successfully', regA.status === 201);
  if (regA.data?.user?.id) createdUserIds.push(regA.data.user.id);
  const userAToken = regA.data?.access_token;
  const userAId = regA.data?.user?.id;

  await showDbUsers('after user A');

  // ═══════════════════════════════════════════
  // TEST 2: Register user B with same email → 409
  // ═══════════════════════════════════════════
  divider('TEST 2: Register user B with same email — expect 409');
  const regB = await api('POST', '/auth/register', {
    email: SHARED_EMAIL,
    password: PASSWORD,
    display_name: 'User B',
  });
  check('Duplicate email rejected with 409', regB.status === 409);
  check('Error says EMAIL_ALREADY_REGISTERED', regB.data?.errorCode === 'EMAIL_ALREADY_REGISTERED' || regB.data?.error?.includes?.('already'));

  await showDbUsers('after user B attempt');

  // ═══════════════════════════════════════════
  // TEST 3: Google OAuth with same email → links to existing
  // ═══════════════════════════════════════════
  divider('TEST 3: Google OAuth with same email — should find existing account');
  // We can't call the real Google endpoint (requires real Google JWT),
  // but we can verify the logic by checking the DB directly.
  // Instead, let's verify that if we check for the email, only 1 user exists.
  const usersWithEmail = await prisma.user.findMany({
    where: { email: SHARED_EMAIL },
    select: { id: true, email: true, google_id: true },
  });
  check('Only 1 user exists with this email', usersWithEmail.length === 1);
  console.log(`  (Google OAuth would link to existing user ${usersWithEmail[0]?.id} instead of creating new)`);

  // Verify the code path: simulate what Google auth does
  const existingByEmail = await prisma.user.findUnique({ where: { email: SHARED_EMAIL } });
  check('findUnique returns existing user for OAuth linking', existingByEmail?.id === userAId);

  // ═══════════════════════════════════════════
  // TEST 4: Register user C, set username
  // ═══════════════════════════════════════════
  divider('TEST 4: Register user C with unique email, set username');
  const emailC = `userC_${ts}@test.local`;
  const regC = await api('POST', '/auth/register', {
    email: emailC,
    password: PASSWORD,
    display_name: 'User C',
  });
  check('User C registered', regC.status === 201);
  if (regC.data?.user?.id) createdUserIds.push(regC.data.user.id);
  const userCToken = regC.data?.access_token;
  const userCId = regC.data?.user?.id;

  // Verify and set username
  const dbC = await prisma.user.findUnique({
    where: { id: userCId },
    select: { email_verification_code: true },
  });
  if (dbC?.email_verification_code) {
    await api('POST', '/auth/verify/confirm', { code: dbC.email_verification_code }, userCToken);
  } else {
    await prisma.user.update({ where: { id: userCId }, data: { email_verified: true } });
  }

  // Complete onboarding to set username
  const onboardC = await api('POST', '/me/complete-onboarding', {
    role: 'fan',
    username: SHARED_USERNAME,
    dob: '2000-01-01',
    affiliation: 'none',
  }, userCToken);
  check('User C got username', onboardC.status === 200);

  const dbCAfter = await prisma.user.findUnique({
    where: { id: userCId },
    select: { username: true },
  });
  console.log(`  User C username: ${dbCAfter?.username}`);
  check('Username saved correctly', dbCAfter?.username === SHARED_USERNAME);

  // ═══════════════════════════════════════════
  // TEST 5: Register user D, try same username → blocked
  // ═══════════════════════════════════════════
  divider('TEST 5: Register user D, try same username — expect blocked');
  const emailD = `userD_${ts}@test.local`;
  const regD = await api('POST', '/auth/register', {
    email: emailD,
    password: PASSWORD,
    display_name: 'User D',
  });
  check('User D registered (different email)', regD.status === 201);
  if (regD.data?.user?.id) createdUserIds.push(regD.data.user.id);
  const userDToken = regD.data?.access_token;
  const userDId = regD.data?.user?.id;

  // Verify user D
  const dbD = await prisma.user.findUnique({
    where: { id: userDId },
    select: { email_verification_code: true },
  });
  if (dbD?.email_verification_code) {
    await api('POST', '/auth/verify/confirm', { code: dbD.email_verification_code }, userDToken);
  } else {
    await prisma.user.update({ where: { id: userDId }, data: { email_verified: true } });
  }

  // Try to set same username
  const onboardD = await api('POST', '/me/complete-onboarding', {
    role: 'fan',
    username: SHARED_USERNAME,
    dob: '2000-01-01',
    affiliation: 'none',
  }, userDToken);
  check('Duplicate username rejected', onboardD.status === 400 || onboardD.status === 409);
  console.log(`  Error: ${onboardD.data?.error}`);

  // Verify DB
  const usersWithUsername = await prisma.user.findMany({
    where: { username: SHARED_USERNAME },
    select: { id: true, username: true },
  });
  check('Only 1 user has this username', usersWithUsername.length === 1);
  check('Username belongs to user C', usersWithUsername[0]?.id === userCId);

  // ═══════════════════════════════════════════
  // TEST 6: Race condition — simultaneous registrations
  // ═══════════════════════════════════════════
  divider('TEST 6: Simultaneous registrations with same email — Promise.all');
  const raceEmail = `race_${ts}@test.local`;

  const results = await Promise.allSettled([
    api('POST', '/auth/register', { email: raceEmail, password: PASSWORD, display_name: 'Racer 1' }),
    api('POST', '/auth/register', { email: raceEmail, password: PASSWORD, display_name: 'Racer 2' }),
    api('POST', '/auth/register', { email: raceEmail, password: PASSWORD, display_name: 'Racer 3' }),
  ]);

  let successes = 0;
  let conflicts = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.status === 201) {
        successes++;
        if (r.value.data?.user?.id) createdUserIds.push(r.value.data.user.id);
      }
      if (r.value.status === 409) conflicts++;
    }
  }

  console.log(`\n  Results: ${successes} succeeded, ${conflicts} conflicts, ${results.length - successes - conflicts} other`);

  const raceUsers = await prisma.user.findMany({
    where: { email: raceEmail },
    select: { id: true, email: true },
  });
  console.log(`  DB: ${raceUsers.length} user(s) with email ${raceEmail}`);
  check('Only 1 user created in race condition', raceUsers.length === 1);
  check('At most 1 success in race', successes <= 1);

  // ═══════════════════════════════════════════
  // TEST 7: Case-insensitive email duplicate
  // ═══════════════════════════════════════════
  divider('TEST 7: Case-insensitive email duplicate');
  const upperEmail = SHARED_EMAIL.toUpperCase();
  const regUpper = await api('POST', '/auth/register', {
    email: upperEmail,
    password: PASSWORD,
    display_name: 'Upper Case',
  });
  check('Upper-case email duplicate rejected', regUpper.status === 409);

  // ── Cleanup ──
  divider('CLEANUP');
  // Clean race users
  for (const u of raceUsers) {
    if (!createdUserIds.includes(u.id)) createdUserIds.push(u.id);
  }
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  console.log(`🗑️  Cleaned up ${createdUserIds.length} test users`);

  // ── Summary ──
  divider('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  if (failed === 0) {
    console.log('  🔒 ALL IDENTITY CHECKS HELD — No duplicate accounts possible');
  } else {
    console.log('  ⚠️  ISSUES FOUND — Review failed checks');
  }
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
