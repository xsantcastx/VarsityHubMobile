/**
 * Confirms BOTH the approve AND deny email-link buttons work end-to-end for
 * coach, event, and game — token → review page → POST → correct DB transition.
 */
import { prisma } from '../src/lib/prisma.js';
import { signReviewToken } from '../src/lib/reviewTokens.js';

const BASE = 'http://localhost:4000';
let pass = 0, fail = 0;
const ok = (l: string, c: boolean, d?: unknown) => { console.log(`   ${c ? '✅' : '❌'} ${l}${d !== undefined ? ` — ${JSON.stringify(d)}` : ''}`); c ? pass++ : fail++; };

async function post(path: string, token: string) {
  const res = await fetch(`${BASE}${path}?token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'e2e', reason: 'e2e test' }),
  });
  return { status: res.status, text: await res.text() };
}

async function mkCoach() {
  const email = `bd_coach_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.app`;
  const reg = await (await fetch(`${BASE}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'TestPass123!', display_name: 'BD', role: 'fan' }) })).json();
  const id = reg.user.id;
  await prisma.user.update({ where: { id }, data: { email_verified: true, date_of_birth: new Date('1990-01-01'), dob_set_at: new Date() } });
  await fetch(`${BASE}/auth/me/preferences`, { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.access_token}` }, body: JSON.stringify({ role: 'coach' }) });
  return id;
}

async function main() {
  try {
    // ── COACH ──
    console.log('\n▶ COACH approve button');
    let id = await mkCoach();
    let r = await post(`/admin/coaches/${id}/approve`, signReviewToken({ coachId: id, action: 'approve_coach' }));
    ok('approve → 2xx + "Coach Approved"', r.status < 300 && /Coach Approved/i.test(r.text));
    ok('DB → APPROVED', (await prisma.user.findUnique({ where: { id }, select: { approval_status: true } }))?.approval_status === 'APPROVED');
    await prisma.adminActivityLog.deleteMany({ where: { target_id: id } }); await prisma.user.delete({ where: { id } }).catch(() => {});

    console.log('▶ COACH deny button');
    id = await mkCoach();
    r = await post(`/admin/coaches/${id}/reject`, signReviewToken({ coachId: id, action: 'reject_coach' }));
    ok('deny → 2xx + "Coach Rejected"', r.status < 300 && /Coach Rejected/i.test(r.text));
    ok('DB → REJECTED', (await prisma.user.findUnique({ where: { id }, select: { approval_status: true } }))?.approval_status === 'REJECTED');
    await prisma.adminActivityLog.deleteMany({ where: { target_id: id } }); await prisma.user.delete({ where: { id } }).catch(() => {});

    // ── EVENT ── (seed pending directly)
    console.log('▶ EVENT approve + deny buttons');
    for (const action of ['approve', 'reject'] as const) {
      const ev = await (prisma.event.create as any)({ data: { title: 'BD Event', date: new Date(Date.now() + 6e8), event_type: 'watch_party', approval_status: 'pending', status: 'draft' }, select: { id: true } });
      const tok = signReviewToken({ reviewId: ev.id, reviewKind: 'event', action: `${action}_event` });
      const res = await post(`/events/${ev.id}/${action}`, tok);
      const want = action === 'approve' ? 'approved' : 'rejected';
      ok(`event ${action} → 2xx`, res.status < 300);
      ok(`event DB → ${want}`, (await (prisma.event.findUnique as any)({ where: { id: ev.id }, select: { approval_status: true } }))?.approval_status === want);
      await (prisma.event.deleteMany as any)({ where: { id: ev.id } });
    }

    // ── GAME ──
    console.log('▶ GAME approve + deny buttons');
    for (const action of ['approve', 'reject'] as const) {
      const g = await (prisma.game.create as any)({ data: { title: 'BD Game', date: new Date(Date.now() + 6e8), approval_status: 'pending' }, select: { id: true } });
      const tok = signReviewToken({ reviewId: g.id, reviewKind: 'game', action: `${action}_game` });
      const res = await post(`/games/${g.id}/${action}`, tok);
      const want = action === 'approve' ? 'approved' : 'rejected';
      ok(`game ${action} → 2xx`, res.status < 300);
      ok(`game DB → ${want}`, (await (prisma.game.findUnique as any)({ where: { id: g.id }, select: { approval_status: true } }))?.approval_status === want);
      await (prisma.game.deleteMany as any)({ where: { id: g.id } });
    }
  } finally {
    console.log(`\n═══ APPROVE/DENY BUTTONS: ${pass} passed, ${fail} failed ═══`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}
main().catch(e => { console.error('ERR:', e); process.exit(1); });
