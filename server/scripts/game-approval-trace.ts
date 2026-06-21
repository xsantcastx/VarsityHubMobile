/**
 * End-to-end GAME approval trace against the real server + Postgres.
 * Seeds a PENDING game, approves via signed token → APPROVED → idempotent replay.
 * Exercises the shipped reviewPage.ts for the game entity (the 3rd entity type).
 *
 *   PORT=4000 npm run dev
 *   npx tsx scripts/game-approval-trace.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { signReviewToken } from '../src/lib/reviewTokens.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const j = (s: string) => s.slice(0, 140).replace(/\s+/g, ' ');

async function http(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  let gameId = '';
  let pass = 0, fail = 0;
  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(`   ${ok ? '✅' : '❌'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    // Seed a pending game directly (game CREATION isn't under test; the APPROVAL
    // review-page + token + idempotency is).
    const game = await (prisma.game.create as any)({
      data: {
        title: 'E2E Test Game',
        date: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        approval_status: 'pending',
      },
      select: { id: true, approval_status: true },
    });
    gameId = game.id;
    console.log(`\n▶ seeded pending game ${gameId} (${game.approval_status})`);
    check('game seeded as pending', game.approval_status === 'pending');

    // Approve via a real signed review token (the email-link path).
    const approveToken = signReviewToken({ reviewId: gameId, reviewKind: 'game', action: 'approve_game' });
    const approve = await http('POST', `/games/${gameId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    console.log('▶ approve via token', approve.status, j(approve.text));
    check('approve endpoint accepted token (2xx)', approve.status >= 200 && approve.status < 300);
    check('rendered the Game review/result page', /Game Approved|Approved/i.test(approve.text));

    const dbApproved = await (prisma.game.findUnique as any)({ where: { id: gameId }, select: { approval_status: true } });
    console.log('▶ DB approval_status after approve:', dbApproved?.approval_status);
    check('game APPROVED in DB', dbApproved?.approval_status === 'approved');

    // Idempotent replay.
    const replay = await http('POST', `/games/${gameId}/approve?token=${encodeURIComponent(approveToken)}`, {});
    console.log('▶ replay token', replay.status, j(replay.text));
    check('replay is a safe no-op (Already Approved)', /Already Approved/i.test(replay.text));
  } finally {
    if (gameId) await (prisma.game.deleteMany as any)({ where: { id: gameId } }).catch(() => {});
    console.log('\n🧹 cleaned up');
    console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch(err => { console.error('TRACE ERROR:', err); process.exit(1); });
