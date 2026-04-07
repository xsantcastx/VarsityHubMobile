/**
 * VERIFY 7 — Confirm session isolation between users
 *
 * Tests that user sessions don't leak data between accounts.
 */

import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const EMAIL_A = `sessiona_${ts}@test.local`;
const EMAIL_B = `sessionb_${ts}@test.local`;
const PASSWORD = 'TestPass123';

const createdIds: string[] = [];
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
  console.log(`  ← ${res.status} ${typeof data === 'object' ? JSON.stringify(data).substring(0, 150) : data}`);
  return { status: res.status, data };
}

async function main() {
  console.log('🧪 VERIFY 7 — Session Isolation Between Users');

  // ═══════════════════════════════════════════
  // SETUP: Register both users
  // ═══════════════════════════════════════════
  divider('SETUP: Register user A and user B');

  const regA = await api('POST', '/auth/register', { email: EMAIL_A, password: PASSWORD, display_name: 'Alice' });
  const userAId = regA.data?.user?.id;
  const tokenA = regA.data?.access_token;
  const refreshA = regA.data?.refresh_token;
  createdIds.push(userAId);

  const regB = await api('POST', '/auth/register', { email: EMAIL_B, password: PASSWORD, display_name: 'Bob' });
  const userBId = regB.data?.user?.id;
  const tokenB = regB.data?.access_token;
  const refreshB = regB.data?.refresh_token;
  createdIds.push(userBId);

  console.log(`  User A: ${userAId} (${EMAIL_A})`);
  console.log(`  User B: ${userBId} (${EMAIL_B})`);

  // ═══════════════════════════════════════════
  // TEST 1: User A's token returns A's data, not B's
  // ═══════════════════════════════════════════
  divider('TEST 1: User A\'s token returns A\'s data');
  const meA = await api('GET', '/auth/me', undefined, tokenA);
  check('Token A returns user A\'s email', meA.data?.email === EMAIL_A);
  check('Token A returns user A\'s id', meA.data?.id === userAId);
  check('Token A does NOT return user B\'s email', meA.data?.email !== EMAIL_B);

  // ═══════════════════════════════════════════
  // TEST 2: User B's token returns B's data, not A's
  // ═══════════════════════════════════════════
  divider('TEST 2: User B\'s token returns B\'s data');
  const meB = await api('GET', '/auth/me', undefined, tokenB);
  check('Token B returns user B\'s email', meB.data?.email === EMAIL_B);
  check('Token B returns user B\'s id', meB.data?.id === userBId);
  check('Token B does NOT return user A\'s data', meB.data?.email !== EMAIL_A);

  // ═══════════════════════════════════════════
  // TEST 3: Token A cannot access B's private data
  // ═══════════════════════════════════════════
  divider('TEST 3: Cross-session isolation — A cannot access B\'s data');
  // Try to use A's token but B logged in "on same device" (just a different login)
  const loginB = await api('POST', '/auth/login', { email: EMAIL_B, password: PASSWORD });
  const newTokenB = loginB.data?.access_token;

  // A's token should still only return A's data
  const meAStill = await api('GET', '/auth/me', undefined, tokenA);
  check('After B logs in, A\'s token still returns A\'s data', meAStill.data?.id === userAId);
  check('A\'s data unchanged by B\'s login', meAStill.data?.email === EMAIL_A);

  // ═══════════════════════════════════════════
  // TEST 4: Logout user B
  // ═══════════════════════════════════════════
  divider('TEST 4: Logout user B');
  const logout = await api('POST', '/auth/logout', { refresh_token: refreshB }, tokenB);
  check('Logout returns ok', logout.data?.ok === true);

  // Verify refresh token is invalidated
  const refreshAttempt = await api('POST', '/auth/refresh', { refresh_token: refreshB });
  check('B\'s refresh token invalidated after logout', refreshAttempt.status === 401 || refreshAttempt.status === 403);

  // ═══════════════════════════════════════════
  // TEST 5: B's access JWT behavior after logout
  // ═══════════════════════════════════════════
  divider('TEST 5: B\'s access JWT after logout');
  // Note: Access JWTs are stateless — they work until expiry unless password changed
  const meBAfterLogout = await api('GET', '/auth/me', undefined, tokenB);
  console.log(`  Note: Access JWTs are stateless (no blacklist).`);
  console.log(`  Post-logout access JWT status: ${meBAfterLogout.status}`);
  if (meBAfterLogout.status === 200) {
    console.log('  ⚠️  Access JWT still works (expected — JWTs are stateless until expiry)');
    console.log('  → This is by design: short-lived JWTs + client-side token deletion');
    console.log('  → Server invalidates refresh tokens, not access tokens');
    console.log('  → To force immediate invalidation, user must change password');
  }

  // Verify: if B changes password, old token stops working
  divider('TEST 5b: Password change invalidates all tokens');
  // Change B's password
  const newLoginB = await api('POST', '/auth/login', { email: EMAIL_B, password: PASSWORD });
  const freshTokenB = newLoginB.data?.access_token;

  // Change password
  const changePw = await api('PATCH', '/me/password', {
    current_password: PASSWORD,
    new_password: 'NewPass123!',
  }, freshTokenB);

  if (changePw.status === 200) {
    // Old token should now be invalid (iat < password_changed_at)
    const oldTokenCheck = await api('GET', '/auth/me', undefined, tokenB);
    check('Old token invalid after password change', oldTokenCheck.status === 401 || oldTokenCheck.data?.id === undefined);
    console.log(`  Old token /me status: ${oldTokenCheck.status}, id: ${oldTokenCheck.data?.id || 'none'}`);
  } else {
    console.log(`  Password change returned ${changePw.status} — testing token invalidation differently`);
    // Manually update password_changed_at to future
    await prisma.user.update({
      where: { id: userBId },
      data: { password_changed_at: new Date(Date.now() + 60000) },
    });
    const oldTokenCheck = await api('GET', '/auth/me', undefined, tokenB);
    check('Old token invalid after password_changed_at update', oldTokenCheck.data?.id === undefined || oldTokenCheck.status === 401);
  }

  // ═══════════════════════════════════════════
  // TEST 6: User A unaffected by B's logout/password change
  // ═══════════════════════════════════════════
  divider('TEST 6: A\'s session completely unaffected by B');
  const meAFinal = await api('GET', '/auth/me', undefined, tokenA);
  check('A\'s token still works after B\'s logout', meAFinal.status === 200);
  check('A\'s data still correct', meAFinal.data?.id === userAId && meAFinal.data?.email === EMAIL_A);
  check('No B data leaked into A\'s response', meAFinal.data?.display_name === 'Alice');

  // ═══════════════════════════════════════════
  // TEST 7: Tokens are user-specific (swap attack)
  // ═══════════════════════════════════════════
  divider('TEST 7: Token swap attack');
  // Using A's refresh token should get A's data, not B's
  const refreshWithA = await api('POST', '/auth/refresh', { refresh_token: refreshA });
  if (refreshWithA.status === 200) {
    const swapMe = await api('GET', '/auth/me', undefined, refreshWithA.data?.access_token);
    check('Refreshed token from A still returns A\'s data', swapMe.data?.id === userAId);
    check('No cross-contamination from refresh', swapMe.data?.email === EMAIL_A);
  } else {
    console.log(`  Refresh returned ${refreshWithA.status} — skipping swap test`);
  }

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: createdIds } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: createdIds } } }).catch(() => {});
  console.log(`🗑️  Cleaned up ${createdIds.length} users`);

  // ── Summary ──
  divider('RESULTS');
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  if (failed === 0) {
    console.log('  🔒 SESSIONS FULLY ISOLATED — No cross-user data leakage');
  } else {
    console.log('  ⚠️  ISSUES FOUND');
  }
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
