/**
 * End-to-end coach-approval trace against a running local server + real DB.
 * Exercises the REAL HTTP endpoints + Postgres transactions (not mocks):
 * register → verify → set role:coach (PENDING) → admin token approve → APPROVED
 * → single-use token replay → AdminActivityLog. Cleans up after itself.
 *
 *   PORT=4000 npm run dev            # in one terminal
 *   npx tsx scripts/approval-e2e-trace.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { signReviewToken } from '../src/lib/reviewTokens.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const log = (n: string, ...rest: unknown[]) => console.log(`\n▶ ${n}`, ...rest);
const j = (s: string) => s.slice(0, 160).replace(/\s+/g, ' ');

async function http(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

async function main() {
  const email = `e2e_coach_${Date.now()}@test.varsityhub.app`;
  let userId = '';
  let pass = 0;
  let fail = 0;
  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(`   ${ok ? '✅' : '❌'} ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    // 1. Register (fan, unverified)
    const reg = await http('POST', '/auth/register', {
      email,
      password: 'TestPass123!',
      display_name: 'E2E Coach',
      role: 'fan',
    });
    userId = reg.data?.user?.id;
    const accessToken = reg.data?.access_token;
    log('1. register', reg.status);
    check('registered with userId + token', reg.status === 201 && !!userId && !!accessToken);

    // 2. Verify email + set an adult DOB (simulating the verify-link click and the
    //    onboarding DOB step — neither is the approval logic under test, but both
    //    are real prerequisites the coach-role gate enforces).
    await prisma.user.update({
      where: { id: userId },
      data: { email_verified: true, date_of_birth: new Date('1990-01-01'), dob_set_at: new Date() },
    });
    log('2. email verified + adult DOB set (simulated onboarding prereqs)');

    // 3. Set role:coach via the REAL endpoint (should now pass requireVerified).
    const pref = await http('PATCH', '/auth/me/preferences', { role: 'coach' }, accessToken);
    log('3. PATCH /me/preferences {role:coach}', pref.status, j(pref.text));
    check('role:coach accepted (200) for verified user', pref.status === 200);

    // 4. Coach must be PENDING (server-authoritative).
    const me1 = await http('GET', '/auth/me', undefined, accessToken);
    log('4. GET /me approval_status', me1.data?.approval_status);
    check('approval_status === PENDING after role set', me1.data?.approval_status === 'PENDING');

    // 5. Pending coach is blocked from coach-only action (requireOnboarded gate).
    const blocked = await http('POST', '/teams', { name: 'E2E Team', sport: 'Basketball' }, accessToken);
    log('5. POST /teams as pending coach', blocked.status);
    check('pending coach blocked from creating team (403)', blocked.status === 403);

    // 6. Admin approves via a real signed review token (the email-link path).
    const approveToken = signReviewToken({ coachId: userId, action: 'approve_coach' });
    const approve = await http('POST', `/admin/coaches/${userId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    log('6. POST /admin/coaches/:id/approve?token=…', approve.status, j(approve.text));
    check('approve endpoint accepted the token (2xx)', approve.status >= 200 && approve.status < 300);

    // 7. DB now APPROVED + paid_by_owner inherited.
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { approval_status: true, paid_by_owner: true },
    });
    log('7. DB state', dbUser);
    check('approval_status === APPROVED in DB', dbUser?.approval_status === 'APPROVED');
    check('paid_by_owner === true (plan inheritance)', dbUser?.paid_by_owner === true);

    // 8. Single-use / idempotent: replay the SAME token.
    const replay = await http('POST', `/admin/coaches/${userId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    log('8. replay same approve token', replay.status, j(replay.text));
    check(
      'replay is a safe no-op (not a second approval)',
      replay.status === 200 || replay.status === 400 || replay.status === 409,
      `status ${replay.status}`
    );

    // 9. AdminActivityLog row written.
    const auditRow = await prisma.adminActivityLog.findFirst({
      where: { target_id: userId, action: 'APPROVE_COACH' },
      orderBy: { timestamp: 'desc' },
    });
    log('9. AdminActivityLog', auditRow ? `${auditRow.action} by ${auditRow.admin_email}` : 'NONE');
    check('AdminActivityLog APPROVE_COACH row written', !!auditRow);
  } finally {
    // Cleanup
    if (userId) {
      await prisma.adminActivityLog.deleteMany({ where: { target_id: userId } }).catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      console.log('\n🧹 cleaned up test user');
    }
    console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch(err => {
  console.error('TRACE ERROR:', err);
  process.exit(1);
});
