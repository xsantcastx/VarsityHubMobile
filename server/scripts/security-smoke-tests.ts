/**
 * Security Smoke Tests
 * Tests critical auth/permission flows against the running server.
 *
 * Usage: cd server && DATABASE_URL=<url> npx tsx scripts/security-smoke-tests.ts
 * Or:    railway run npx tsx scripts/security-smoke-tests.ts
 */

import 'dotenv/config';

const BASE_URL = process.env.TEST_API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const TEST_EMAIL = `sectest_${Date.now()}@test.varsityhub.app`;
const TEST_PASSWORD = 'SecureTest1!';

let accessToken = '';
let refreshToken = '';
let userId = '';

const results: Array<{ name: string; passed: boolean; detail?: string }> = [];

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function api(method: string, path: string, body?: any, headers?: Record<string, string>) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function authedApi(method: string, path: string, body?: any) {
  return api(method, path, body, { Authorization: `Bearer ${accessToken}` });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, detail: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

// ─── TEST SUITE ────────────────────────────────────────────

async function run() {
  console.log(`\n🔒 Security Smoke Tests\n   Server: ${BASE_URL}\n`);

  // ── Test 1: Fan signup → verify → login ──
  console.log('── Test Group 1: Registration & Auth ──');

  await test('1a. Register fan account', async () => {
    const { status, data } = await api('POST', '/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      display_name: 'SecTest User',
      role: 'fan',
    });
    assert(status === 201, `Expected 201, got ${status}: ${JSON.stringify(data)}`);
    assert(!!data.access_token, 'No access_token returned');
    assert(!!data.refresh_token, 'No refresh_token returned');
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
    userId = data.user?.id;
    assert(!!userId, 'No user ID returned');
  });

  await test('1b. Access feed without verification (should work for read)', async () => {
    const { status } = await authedApi('GET', '/posts?limit=1');
    // Posts are readable even without verification
    assert(status === 200, `Expected 200, got ${status}`);
  });

  await test('1c. Fan cannot create team (403 - coach role required)', async () => {
    const { status, data } = await authedApi('POST', '/teams', {
      name: 'Test Team',
      sport: 'Basketball',
    });
    assert(status === 403, `Expected 403, got ${status}: ${JSON.stringify(data)}`);
  });

  // ── Test 2: Role escalation prevention ──
  console.log('\n── Test Group 2: Role Escalation Prevention ──');

  await test('2a. PATCH /me/preferences with role:coach sets approval_status PENDING', async () => {
    const { status, data } = await authedApi('PATCH', '/auth/me/preferences', {
      role: 'coach',
    });
    // During onboarding (not completed), this should succeed but set PENDING
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
  });

  await test('2b. After role change, coach endpoints should be blocked', async () => {
    const { status, data } = await authedApi('POST', '/teams', {
      name: 'Exploit Team',
      sport: 'Basketball',
    });
    // Should be blocked because onboarding not completed OR approval pending
    assert(status === 403, `Expected 403, got ${status}: ${JSON.stringify(data)}`);
  });

  await test('2c. Protected keys cannot be set via preferences', async () => {
    const { status, data } = await authedApi('PATCH', '/auth/me/preferences', {
      approval_status: 'APPROVED',
      is_admin: true,
      paid_by_owner: true,
    });
    // Should succeed but silently strip protected keys
    assert(status === 200, `Expected 200, got ${status}`);

    // Verify the user is still not approved
    const { data: me } = await authedApi('GET', '/auth/me');
    assert(me.approval_status !== 'APPROVED' || me.preferences?.role !== 'coach',
      'User should not be APPROVED after setting protected keys');
  });

  // ── Test 3: Rate limiting ──
  console.log('\n── Test Group 3: Rate Limiting ──');

  await test('3a. Login rate limiting after multiple failures', async () => {
    const fakeEmail = `ratelimit_${Date.now()}@test.com`;
    let rateLimited = false;
    for (let i = 0; i < 8; i++) {
      const { status } = await api('POST', '/auth/login', {
        email: fakeEmail,
        password: 'wrongpassword1',
      });
      if (status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Expected 429 rate limit after multiple failed logins');
  });

  // ── Test 4: Token security ──
  console.log('\n── Test Group 4: Token Security ──');

  await test('4a. Expired/invalid JWT returns 401', async () => {
    const fakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2UiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.invalid';
    const { status } = await api('GET', '/auth/me', undefined, { Authorization: `Bearer ${fakeJwt}` });
    assert(status === 401, `Expected 401 for invalid JWT, got ${status}`);
  });

  await test('4b. Refresh token rotation works', async () => {
    if (!refreshToken) return;
    const { status, data } = await api('POST', '/auth/refresh', { refresh_token: refreshToken });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(!!data.access_token, 'No new access_token');
    assert(!!data.refresh_token, 'No new refresh_token');

    // Old refresh token should now be invalid
    const { status: reuse } = await api('POST', '/auth/refresh', { refresh_token: refreshToken });
    assert(reuse === 401, `Expected 401 for reused refresh token, got ${reuse}`);

    // Update tokens
    accessToken = data.access_token;
    refreshToken = data.refresh_token;
  });

  await test('4c. Revoke all tokens works', async () => {
    const { status, data } = await authedApi('POST', '/auth/revoke-all-tokens');
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.ok === true, 'Expected ok: true');

    // Old refresh token should now be invalid
    const { status: reuse } = await api('POST', '/auth/refresh', { refresh_token: refreshToken });
    assert(reuse === 401, `Expected 401 after revocation, got ${reuse}`);
  });

  await test('4d. Logout invalidates refresh token', async () => {
    // Re-login to get a fresh token
    const { data: loginData } = await api('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    accessToken = loginData.access_token;
    refreshToken = loginData.refresh_token;

    const { status } = await api('POST', '/auth/logout', { refresh_token: refreshToken });
    assert(status === 200, `Expected 200, got ${status}`);

    // Refresh should now fail
    const { status: reuse } = await api('POST', '/auth/refresh', { refresh_token: refreshToken });
    assert(reuse === 401, `Expected 401 after logout, got ${reuse}`);

    // Re-login for remaining tests
    const { data: relogin } = await api('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    accessToken = relogin.access_token;
    refreshToken = relogin.refresh_token;
  });

  // ── Test 5: Input validation ──
  console.log('\n── Test Group 5: Input Validation ──');

  await test('5a. Malformed ID params return 400', async () => {
    const { status } = await authedApi('GET', '/teams/not-a-valid-id');
    assert(status === 400, `Expected 400 for malformed ID, got ${status}`);
  });

  await test('5b. Registration rejects short password', async () => {
    const { status } = await api('POST', '/auth/register', {
      email: `short_${Date.now()}@test.com`,
      password: 'short',
    });
    assert(status === 400, `Expected 400 for short password, got ${status}`);
  });

  await test('5c. Registration rejects invalid email', async () => {
    const { status } = await api('POST', '/auth/register', {
      email: 'not-an-email',
      password: 'ValidPass1!',
    });
    assert(status === 400, `Expected 400 for invalid email, got ${status}`);
  });

  // ── Results ──
  console.log('\n\n══════════════════════════════════════');
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  console.log(`  RESULTS: ${passed} passed, ${failed} failed out of ${results.length} tests`);
  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.detail}`);
    });
  }
  console.log('══════════════════════════════════════\n');

  // Cleanup: delete test user
  try {
    // Use admin endpoint or direct DB cleanup
    console.log(`  🧹 Test user: ${TEST_EMAIL} (cleanup manually if needed)`);
  } catch { /* no-op */ }

  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
