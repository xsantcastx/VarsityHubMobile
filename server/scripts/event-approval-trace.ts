/**
 * End-to-end EVENT approval trace against the real server + Postgres.
 * Fan pitches an event (PENDING) → admin approves via signed token → APPROVED
 * → idempotent replay. Exercises the shipped reviewPage.ts for the event entity.
 *
 *   PORT=4000 npm run dev
 *   npx tsx scripts/event-approval-trace.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { signReviewToken } from '../src/lib/reviewTokens.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const j = (s: string) => s.slice(0, 140).replace(/\s+/g, ' ');

async function http(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, text };
}

async function main() {
  const email = `e2e_event_${Date.now()}@test.varsityhub.app`;
  let userId = '';
  let eventId = '';
  let pass = 0, fail = 0;
  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(`   ${ok ? '✅' : '❌'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    const reg = await http('POST', '/auth/register', { email, password: 'TestPass123!', display_name: 'E2E Event User', role: 'fan' });
    userId = reg.data?.user?.id;
    const token = reg.data?.access_token;
    await prisma.user.update({ where: { id: userId }, data: { email_verified: true, onboarding_completed: true } });
    console.log(`\n▶ setup: fan ${userId} (verified, onboarded)`);

    // Fan pitches an event (no home team → not auto-approved → PENDING).
    const futureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
    const create = await http('POST', '/events', {
      title: 'E2E Community Meetup', date: futureDate, location: 'Test Park', event_type: 'watch_party',
    }, token);
    eventId = create.data?.id;
    console.log('▶ pitch event', create.status, j(create.text));
    check('event created (201) with id', create.status === 201 && !!eventId);

    const dbPending = await prisma.event.findUnique({ where: { id: eventId }, select: { approval_status: true } });
    console.log('▶ DB approval_status after pitch:', dbPending?.approval_status);
    check('event is PENDING (fan pitch needs review)', dbPending?.approval_status === 'pending');

    // Admin approves via a real signed review token (the email-link path).
    const approveToken = signReviewToken({ reviewId: eventId, reviewKind: 'event', action: 'approve_event' });
    const approve = await http('POST', `/events/${eventId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    console.log('▶ approve via token', approve.status, j(approve.text));
    check('approve endpoint accepted token (2xx)', approve.status >= 200 && approve.status < 300);
    check('rendered the Event review/result page', /Event Approved|Approved/i.test(approve.text));

    const dbApproved = await prisma.event.findUnique({ where: { id: eventId }, select: { approval_status: true } });
    console.log('▶ DB approval_status after approve:', dbApproved?.approval_status);
    check('event APPROVED in DB', dbApproved?.approval_status === 'approved');

    // Idempotent replay.
    const replay = await http('POST', `/events/${eventId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    console.log('▶ replay token', replay.status, j(replay.text));
    check('replay is a safe no-op (Already Approved)', /Already Approved/i.test(replay.text) || replay.status === 400);
  } finally {
    if (eventId) await prisma.event.deleteMany({ where: { id: eventId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    console.log('\n🧹 cleaned up');
    console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch(err => { console.error('TRACE ERROR:', err); process.exit(1); });
