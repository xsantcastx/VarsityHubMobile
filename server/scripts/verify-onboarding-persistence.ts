/**
 * VERIFY 8 — Confirm onboarding state survives app crash
 *
 * Tests that onboarding progress is stored server-side, not just in memory.
 */

import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const EMAIL = `crash_${ts}@test.local`;
const PASSWORD = 'TestPass123';
const USERNAME = `crash_${ts}`.slice(0, 20);

let token = '';
let userId = '';
let passed = 0;
let failed = 0;

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
  if (body) console.log(`    Body: ${JSON.stringify(body).substring(0, 150)}`);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`  ← ${res.status}`);
  return { status: res.status, data };
}

function showPrefs(label: string, prefs: any) {
  console.log(`\n  📋 Preferences (${label}):`);
  const keys = ['role', 'onboarding_completed', 'affiliation', 'dob', 'zip_code', 'plan',
    'organization_id', 'organization_name', 'sports_interests', 'primary_intents'];
  for (const k of keys) {
    if (prefs?.[k] !== undefined) console.log(`    ${k}: ${JSON.stringify(prefs[k])}`);
  }
}

async function main() {
  console.log('🧪 VERIFY 8 — Onboarding State Survives App Crash');
  console.log('  Tests that server-side preferences persist through "crashes"');

  // ═══════════════════════════════════════════
  // STEP 1: Register new coach
  // ═══════════════════════════════════════════
  divider('STEP 1: Register new user');
  const reg = await api('POST', '/auth/register', {
    email: EMAIL,
    password: PASSWORD,
    display_name: 'Crash Test',
    role: 'coach',
    dob: '1995-01-15',
  });
  token = reg.data?.access_token;
  userId = reg.data?.user?.id;

  const regPrefs = reg.data?.user?.preferences;
  showPrefs('after registration', regPrefs);
  check('Role set to coach at registration', regPrefs?.role === 'coach');
  check('onboarding_completed is false', regPrefs?.onboarding_completed === false);

  // Verify email
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { email_verification_code: true } });
  if (dbUser?.email_verification_code) {
    await api('POST', '/auth/verify/confirm', { code: dbUser.email_verification_code }, token);
  } else {
    await prisma.user.update({ where: { id: userId }, data: { email_verified: true } });
  }

  // ═══════════════════════════════════════════
  // STEP 2: Save partial onboarding progress (role + preferences)
  // ═══════════════════════════════════════════
  divider('STEP 2: Save partial onboarding progress via PATCH /me/preferences');
  const partialSave = await api('PATCH', '/me/preferences', {
    affiliation: 'school',
    dob: '1995-01-15',
    zip_code: '06907',
    sports_interests: ['basketball', 'soccer'],
    primary_intents: ['manage_team', 'share_highlights'],
  }, token);

  showPrefs('after partial save', partialSave.data?.preferences);
  check('Affiliation saved', partialSave.data?.preferences?.affiliation === 'school');
  check('Sports interests saved', Array.isArray(partialSave.data?.preferences?.sports_interests));

  // Verify it's in the database
  const dbAfterSave = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const savedPrefs = dbAfterSave?.preferences as any;
  check('DB has affiliation', savedPrefs?.affiliation === 'school');
  check('DB has sports_interests', Array.isArray(savedPrefs?.sports_interests));
  check('DB onboarding_completed still false', savedPrefs?.onboarding_completed !== true);

  // ═══════════════════════════════════════════
  // STEP 3: SIMULATE APP CRASH — discard all local state
  // ═══════════════════════════════════════════
  divider('STEP 3: 💥 SIMULATE APP CRASH — discard all local state');
  console.log('  Discarding: token, userId, all local variables');
  console.log('  Simulates: AsyncStorage cleared, app killed, device restarted');
  console.log('  The ONLY thing that survives is the email/password (user memory)');

  // Clear everything
  const savedEmail = EMAIL;
  const savedPassword = PASSWORD;
  token = '';
  // userId stays for cleanup only

  console.log('  ✅ All local state cleared');

  // ═══════════════════════════════════════════
  // STEP 4: Login again (simulates app restart)
  // ═══════════════════════════════════════════
  divider('STEP 4: Login again after "crash"');
  const login = await api('POST', '/auth/login', { email: savedEmail, password: savedPassword });
  token = login.data?.access_token;

  check('Login succeeded', login.status === 200);
  check('needs_onboarding flag set', login.data?.needs_onboarding === true);

  const loginPrefs = login.data?.user?.preferences;
  showPrefs('from login response', loginPrefs);
  check('Role survived crash', loginPrefs?.role === 'coach');
  check('onboarding_completed still false (not done yet)', loginPrefs?.onboarding_completed !== true);

  // ═══════════════════════════════════════════
  // STEP 5: GET /auth/me — confirm all onboarding state survived
  // ═══════════════════════════════════════════
  divider('STEP 5: GET /auth/me — verify all saved state');
  const me = await api('GET', '/auth/me', undefined, token);
  const mePrefs = me.data?.preferences;
  showPrefs('from /me after crash', mePrefs);

  check('Role persisted: coach', mePrefs?.role === 'coach');
  check('Affiliation persisted: school', mePrefs?.affiliation === 'school');
  check('DOB persisted', mePrefs?.dob === '1995-01-15');
  check('Zip persisted: 06907', mePrefs?.zip_code === '06907');
  check('Sports interests persisted', mePrefs?.sports_interests?.length === 2);
  check('Primary intents persisted', mePrefs?.primary_intents?.length === 2);
  check('onboarding_completed still false', mePrefs?.onboarding_completed !== true);

  // ═══════════════════════════════════════════
  // STEP 6: Verify frontend would resume from correct step
  // ═══════════════════════════════════════════
  divider('STEP 6: Frontend resume logic simulation');
  console.log('  Simulating nextIncompleteStep() from onboardingReducer.ts:');
  console.log('');

  // Step 1: Role check — role is set
  const step1Complete = !!mePrefs?.role;
  console.log(`  Step 1 (Role): ${step1Complete ? '✅ Complete' : '❌ Incomplete'} — role=${mePrefs?.role}`);

  // Step 2: Basic info — check step_2_visited or key fields
  // The frontend uses step_2_visited flag which is local-only, BUT
  // the key fields (dob, affiliation, zip_code) are on the server
  const hasBasicInfo = !!(mePrefs?.dob && mePrefs?.affiliation);
  console.log(`  Step 2 (Basic Info): Fields present=${hasBasicInfo ? 'yes' : 'no'}`);
  console.log(`    Note: step_2_visited is local-only (lost in crash)`);
  console.log(`    Frontend will show step 2 again but fields will pre-fill from server`);

  // Step 3: League (coach only) — check organization_id
  const hasLeague = !!mePrefs?.organization_id;
  console.log(`  Step 3 (League): ${hasLeague ? '✅ Complete' : '⏳ Not yet started'} — org_id=${mePrefs?.organization_id || 'none'}`);

  console.log('');
  console.log('  Frontend behavior after crash:');
  console.log('  1. AuthProvider.checkAuth() → GET /me → sees onboarding_completed=false');
  console.log('  2. Routes to onboarding screen');
  console.log('  3. OnboardingContext dispatches INIT_FROM_PROFILE with server prefs');
  console.log('  4. nextIncompleteStep() calculates: step 1 done (role=coach)');
  console.log('  5. Step 2 shows with fields PRE-FILLED from server (dob, zip, affiliation)');
  console.log('  6. User just taps Continue — no data re-entry needed');

  check('Server has all data needed to resume onboarding', step1Complete && !!mePrefs?.dob);

  // ═══════════════════════════════════════════
  // STEP 7: Complete onboarding and verify final state
  // ═══════════════════════════════════════════
  divider('STEP 7: Complete onboarding (finish the flow)');
  const complete = await api('POST', '/me/complete-onboarding', {
    role: 'coach',
    username: USERNAME,
    dob: '1995-01-15',
    zip_code: '06907',
    affiliation: 'school',
    plan: 'rookie',
    organization_id: 'test-org-placeholder',
    organization_name: 'Test League',
    join_request_pending: true,
  }, token);

  const finalPrefs = complete.data?.user?.preferences;
  showPrefs('final state', finalPrefs);
  check('Onboarding now complete', finalPrefs?.onboarding_completed === true);
  check('All fields preserved through full flow', finalPrefs?.affiliation === 'school' && finalPrefs?.zip_code === '06907');

  // ═══════════════════════════════════════════
  // STEP 8: Crash AGAIN — verify completed state survives
  // ═══════════════════════════════════════════
  divider('STEP 8: 💥 SECOND CRASH — verify completed state survives');
  token = '';

  const login2 = await api('POST', '/auth/login', { email: savedEmail, password: savedPassword });
  token = login2.data?.access_token;

  check('Login succeeded after second crash', login2.status === 200);
  check('needs_onboarding is FALSE (completed)', login2.data?.needs_onboarding === false || login2.data?.needs_onboarding === undefined);

  const me2 = await api('GET', '/auth/me', undefined, token);
  const me2Prefs = me2.data?.preferences;
  check('onboarding_completed still true after second crash', me2Prefs?.onboarding_completed === true);
  check('Role still coach', me2Prefs?.role === 'coach');
  check('Plan persisted', me2Prefs?.plan === 'rookie');

  console.log('\n  Frontend would skip onboarding entirely and go straight to /(tabs)');

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.refreshToken.deleteMany({ where: { user_id: userId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
  console.log('🗑️  Cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  if (failed === 0) {
    console.log('  🔒 ONBOARDING STATE IS SERVER-SIDE — Survives any crash');
    console.log('  → Role, preferences, onboarding_completed all in PostgreSQL');
    console.log('  → Only step_2_visited (visit tracking) is local-only');
    console.log('  → Fields pre-fill from server so user doesn\'t re-enter data');
  } else {
    console.log('  ⚠️  ISSUES FOUND');
  }
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
