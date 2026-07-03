/**
 * Seeds demo data for on-simulator visual verification of the July 4th fixes,
 * then prints the team id to deep-link. Cleanup: july4-notes-seed-demo.ts --clean <marker>
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = 'http://localhost:4000';
const MARKER = 'J4DEMO';

async function main() {
  if (process.argv.includes('--clean')) {
    const teams = await prisma.team.findMany({
      where: { name: { contains: MARKER } },
      select: { id: true },
      take: 50,
    });
    const teamIds = teams.map(t => t.id);
    const games = await (prisma.game.findMany as any)({
      where: {
        OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
      },
      select: { id: true },
      take: 200,
    });
    const gameIds = games.map((g: any) => g.id);
    await (prisma.event.deleteMany as any)({ where: { game_id: { in: gameIds } } });
    await (prisma.game.deleteMany as any)({ where: { id: { in: gameIds } } });
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    const orgs = await prisma.organization.findMany({
      where: { name: { contains: MARKER } },
      select: { id: true },
      take: 50,
    });
    const orgIds = orgs.map(o => o.id);
    await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    const users = await prisma.user.findMany({
      where: { email: { contains: 'j4demo_' } },
      select: { id: true },
      take: 50,
    });
    await prisma.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } });
    console.log(`cleaned: ${gameIds.length} games, ${teamIds.length} teams, ${orgIds.length} orgs`);
    await prisma.$disconnect();
    return;
  }

  // Coach user via API (same recipe as july4-notes-verification.ts)
  const email = `j4demo_${Date.now()}@test.app`;
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'TestPass123!', display_name: 'J4 Demo Coach', role: 'fan' }),
    })
  ).json();
  const uid = reg.user.id as string;
  const token = reg.access_token as string;
  await prisma.user.update({
    where: { id: uid },
    data: { email_verified: true, date_of_birth: new Date('1990-01-01'), dob_set_at: new Date() },
  });
  await fetch(`${BASE}/auth/me/preferences`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: 'coach' }),
  });
  const row = await prisma.user.findUnique({ where: { id: uid }, select: { preferences: true } });
  await prisma.user.update({
    where: { id: uid },
    data: {
      approval_status: 'APPROVED',
      onboarding_completed: true,
      preferences: { ...((row?.preferences as any) || {}), role: 'coach', onboarding_completed: true },
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
    },
  });
  await fetch(`${BASE}/auth/me/preferences`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ favorite_sport: 'soccer' }),
  });

  const org = await prisma.organization.create({
    data: { name: `${MARKER} Org`, league_owner_id: uid, admin_approved: true, approved_at: new Date() },
    select: { id: true },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: uid, role: 'owner', status: 'active' },
  });
  const myTeam = await prisma.team.create({
    data: { name: `${MARKER} Eagles`, organization_id: org.id, status: 'active' },
    select: { id: true, name: true },
  });
  const rivals = await prisma.team.create({
    data: { name: `${MARKER} Rivals`, organization_id: org.id, status: 'active' },
    select: { id: true, name: true },
  });
  await prisma.teamMembership.create({
    data: { team_id: myTeam.id, user_id: uid, role: 'coach', status: 'active' },
  });

  const mk = (body: Record<string, unknown>) =>
    fetch(`${BASE}/games`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));

  // 1. Linked opponent — home game
  const g1 = await mk({
    title: `${myTeam.name} vs ${rivals.name}`,
    home_team: myTeam.name,
    away_team: rivals.name,
    home_team_id: myTeam.id,
    away_team_id: rivals.id,
    date: new Date(Date.now() + 5 * 864e5).toISOString(),
    location: 'Demo Stadium, Stamford CT',
    description: `Home game: ${myTeam.name} vs ${rivals.name}`,
  });
  // 2. Placeholder opponent (not on VarsityHub)
  const g2 = await mk({
    title: `${myTeam.name} vs Crosstown Prep`,
    home_team: myTeam.name,
    away_team: 'Crosstown Prep',
    home_team_id: myTeam.id,
    away_team_name: 'Crosstown Prep',
    date: new Date(Date.now() + 8 * 864e5).toISOString(),
    location: 'Demo Stadium, Stamford CT',
    description: `Home game vs placeholder opponent`,
  });
  // 3. Away game — viewed team is the AWAY side (side-aware display)
  const g3 = await mk({
    title: `${rivals.name} vs ${myTeam.name}`,
    home_team: rivals.name,
    away_team: myTeam.name,
    home_team_id: rivals.id,
    away_team_id: myTeam.id,
    date: new Date(Date.now() + 11 * 864e5).toISOString(),
    location: 'Rivals Park, Stamford CT',
    description: `Away game at ${rivals.name}`,
  });

  console.log(
    JSON.stringify(
      {
        teamId: myTeam.id,
        games: [g1.status, g2.status, g3.status],
        ids: [g1.body?.id, g2.body?.id, g3.body?.id],
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
}

void main();
