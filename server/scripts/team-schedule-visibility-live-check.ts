/**
 * Live-API check for the show_pending fix (PR #103): a coach's
 * GET /games?show_pending=true&team_id=X must return BOTH approved and
 * pending games — the Team Schedule contract. Real HTTP against
 * localhost:4000, real Postgres, cleans up after itself.
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = 'http://localhost:4000';
let pass = 0,
  fail = 0;
const ok = (l: string, c: boolean, d?: unknown) => {
  console.log(`   ${c ? '✅' : '❌'} ${l}${d !== undefined ? ` — ${JSON.stringify(d)}` : ''}`);
  c ? pass++ : fail++;
};

async function main() {
  const stamp = Date.now();
  const email = `sched_${stamp}@test.app`;
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'TestPass123!',
        display_name: 'Sched Coach',
        role: 'fan',
      }),
    })
  ).json();
  const userId = reg?.user?.id as string;
  const token = (reg?.access_token ?? reg?.token) as string;
  if (!userId || !token) throw new Error(`register failed: ${JSON.stringify(reg)}`);
  await prisma.user.update({
    where: { id: userId },
    data: { email_verified: true, date_of_birth: new Date('1990-01-01'), dob_set_at: new Date() },
  });

  const org = await prisma.organization.create({
    data: { name: `Sched Org ${stamp}`, status: 'active', admin_approved: true },
  });
  const team = await prisma.team.create({
    data: { name: `Sched Team ${stamp}`, organization_id: org.id },
  });
  await prisma.teamMembership.create({
    data: { user_id: userId, team_id: team.id, role: 'coach', status: 'active' },
  });

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const approved = await prisma.game.create({
    data: {
      title: 'Approved Game',
      date: tomorrow,
      location: 'Field A',
      approval_status: 'approved',
      home_team_id: team.id,
    },
  });
  const pending = await prisma.game.create({
    data: {
      title: 'Pending Game',
      date: tomorrow,
      location: 'Field B',
      approval_status: 'pending',
      home_team_id: team.id,
    },
  });

  try {
    const res = await fetch(
      `${BASE}/games?show_pending=true&team_id=${team.id}&limit=100&sort=-date`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    ok('GET /games?show_pending=true&team_id → 200', res.status === 200, res.status);
    const body: any = await res.json();
    const games: any[] = body?.games ?? (Array.isArray(body) ? body : []);
    const ids = games.map(g => g.id);
    ok('APPROVED game returned (the drift regression)', ids.includes(approved.id));
    ok('pending game still returned', ids.includes(pending.id));

    const pendingOnly = await fetch(
      `${BASE}/games?approval_status=pending&team_id=${team.id}&limit=100`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const pBody: any = await pendingOnly.json();
    const pIds: string[] = (pBody?.games ?? []).map((g: any) => g.id);
    ok(
      'approval_status=pending stays pending-only (approvals contract)',
      pIds.includes(pending.id) && !pIds.includes(approved.id)
    );
  } finally {
    await prisma.game.deleteMany({ where: { id: { in: [approved.id, pending.id] } } });
    await prisma.teamMembership.deleteMany({ where: { team_id: team.id } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await prisma.user.delete({ where: { id: userId } });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

void main();
