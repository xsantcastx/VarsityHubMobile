/**
 * Live-API verification for the July 4th notes fix round (real HTTP against
 * localhost:4000 — no mocks):
 *
 *  A. Opponent linkage contract: POST /games with away_team_id (linked) and
 *     with away_team_name (display-only placeholder) → GET /games?team_id
 *     returns the fields team-page.tsx renders; placeholder creates NO Team row.
 *  B. Side-aware opponent data: the same game is returned when querying from
 *     the away team's side, with home_team populated (what team-page shows).
 *  C. Event title verbatim: POST /games with a non-competitive event payload
 *     (title = user-entered name) → stored/served verbatim.
 *  D. Manage Org legacy owner: league_owner_id-only org appears in
 *     /organizations/mine/review-summaries.
 *  E. Interactions author: GET /users/:id/interactions?type=like returns
 *     author.username (was null → "Anonymous" in the vertical viewer).
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = 'http://localhost:4000';
let pass = 0,
  fail = 0;
const ok = (l: string, c: boolean, d?: unknown) => {
  console.log(`   ${c ? '✅' : '❌'} ${l}${d !== undefined ? ` — ${JSON.stringify(d)}` : ''}`);
  c ? pass++ : fail++;
};

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: json };
}

async function mkUser(tag: string, role: 'fan' | 'coach' = 'fan') {
  const email = `j4_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.app`;
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'TestPass123!', display_name: `J4 ${tag}`, role: 'fan' }),
    })
  ).json();
  if (!reg?.user?.id) throw new Error(`register failed: ${JSON.stringify(reg)}`);
  await prisma.user.update({
    where: { id: reg.user.id },
    data: { email_verified: true, date_of_birth: new Date('1990-01-01'), dob_set_at: new Date() },
  });
  if (role === 'coach') {
    await fetch(`${BASE}/auth/me/preferences`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.access_token}` },
      body: JSON.stringify({ role: 'coach' }),
    });
    // Seed the approved+onboarded coach state directly (the interactive
    // upgrade → org → team → complete-onboarding flow is out of scope here).
    const row = await prisma.user.findUnique({
      where: { id: reg.user.id },
      select: { preferences: true },
    });
    const prefs = { ...((row?.preferences as any) || {}), role: 'coach', onboarding_completed: true };
    await prisma.user.update({
      where: { id: reg.user.id },
      data: {
        approval_status: 'APPROVED',
        preferences: prefs,
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
      },
    });
    // Bust the me-cache through the real invalidation path so requireOnboarded
    // sees the fresh row (direct prisma writes bypass invalidateMeCacheForUser).
    await fetch(`${BASE}/auth/me/preferences`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${reg.access_token}` },
      body: JSON.stringify({ favorite_sport: 'soccer' }),
    });
  }
  return { id: reg.user.id as string, token: reg.access_token as string, email };
}

async function main() {
  const cleanupIds = {
    users: [] as string[],
    teams: [] as string[],
    orgs: [] as string[],
    games: [] as string[],
    posts: [] as string[],
  };
  try {
    // ── Setup: coach owner + org + two teams (mine + opponent) ──
    const coach = await mkUser('coach', 'coach');
    cleanupIds.users.push(coach.id);
    const org = await prisma.organization.create({
      data: {
        name: `J4 Org ${Date.now()}`,
        league_owner_id: coach.id,
        admin_approved: true,
        approved_at: new Date(),
      },
      select: { id: true },
    });
    cleanupIds.orgs.push(org.id);
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: coach.id, role: 'owner', status: 'active' },
    });
    await prisma.user.update({
      where: { id: coach.id },
      data: { approval_status: 'APPROVED' },
    });
    const myTeam = await prisma.team.create({
      data: { name: `J4 Home FC ${Date.now()}`, organization_id: org.id, status: 'active' },
      select: { id: true, name: true },
    });
    const oppTeam = await prisma.team.create({
      data: { name: `J4 Rivals ${Date.now()}`, organization_id: org.id, status: 'active' },
      select: { id: true, name: true },
    });
    cleanupIds.teams.push(myTeam.id, oppTeam.id);
    await prisma.teamMembership.create({
      data: { team_id: myTeam.id, user_id: coach.id, role: 'coach', status: 'active' },
    });

    // ── A1. Linked opponent (away_team_id) ──
    console.log('\n▶ A1. POST /games with away_team_id (opponent on VarsityHub)');
    const linked = await api('POST', '/games', coach.token, {
      title: `${myTeam.name} vs ${oppTeam.name}`,
      home_team: myTeam.name,
      away_team: oppTeam.name,
      home_team_id: myTeam.id,
      away_team_id: oppTeam.id,
      date: new Date(Date.now() + 5 * 864e5).toISOString(),
      location: '123 Test Field, Stamford CT',
      description: `Home game: ${myTeam.name} vs ${oppTeam.name}`,
    });
    ok('create → 2xx', linked.status < 300, linked.status < 300 ? linked.status : linked.body);
    const linkedId = linked.body?.id || linked.body?.game?.id;
    if (linkedId) cleanupIds.games.push(linkedId);
    ok('response has id', !!linkedId, linkedId);

    const listHome = await api('GET', `/games?team_id=${myTeam.id}&limit=20`, coach.token);
    const gHome = (Array.isArray(listHome.body) ? listHome.body : listHome.body?.games || []).find(
      (g: any) => g.id === linkedId
    );
    ok('GET /games?team_id=<home> returns the game', !!gHome);
    ok('game.away_team_id links opponent team', gHome?.away_team_id === oppTeam.id, {
      away_team_id: gHome?.away_team_id,
    });
    ok('game.away_team display name present', gHome?.away_team === oppTeam.name, gHome?.away_team);

    // ── B. Side-aware: query from the opponent's side ──
    console.log('\n▶ B. Same game from the AWAY side (team-page side-aware display)');
    const listAway = await api('GET', `/games?team_id=${oppTeam.id}&limit=20`, coach.token);
    const gAway = (Array.isArray(listAway.body) ? listAway.body : listAway.body?.games || []).find(
      (g: any) => g.id === linkedId
    );
    ok('game appears when querying by away team id', !!gAway);
    ok(
      'home_team populated (what away-side page shows as opponent)',
      gAway?.home_team === myTeam.name,
      gAway?.home_team
    );

    // ── A2. Placeholder opponent (away_team_name) ──
    console.log('\n▶ A2. POST /games with away_team_name placeholder (opponent NOT on VarsityHub)');
    const placeholderName = 'Crosstown Prep (placeholder)';
    const teamCountBefore = await prisma.team.count();
    const manual = await api('POST', '/games', coach.token, {
      title: `${myTeam.name} vs ${placeholderName}`,
      home_team: myTeam.name,
      away_team: placeholderName,
      home_team_id: myTeam.id,
      away_team_name: placeholderName,
      date: new Date(Date.now() + 6 * 864e5).toISOString(),
      location: '123 Test Field, Stamford CT',
      description: `Home game: ${myTeam.name} vs ${placeholderName}`,
    });
    ok('create → 2xx', manual.status < 300, manual.status);
    const manualId = manual.body?.id || manual.body?.game?.id;
    if (manualId) cleanupIds.games.push(manualId);

    const listHome2 = await api('GET', `/games?team_id=${myTeam.id}&limit=20`, coach.token);
    const gManual = (
      Array.isArray(listHome2.body) ? listHome2.body : listHome2.body?.games || []
    ).find((g: any) => g.id === manualId);
    ok('GET returns placeholder game', !!gManual);
    const displayed =
      gManual?.opponent_name || gManual?.away_team || gManual?.away_team_name || 'TBD';
    ok('team-page fallback chain resolves placeholder (not TBD)', displayed === placeholderName, {
      displayed,
    });
    ok('no linked away_team_id for placeholder', !gManual?.away_team_id, gManual?.away_team_id);
    const teamCountAfter = await prisma.team.count();
    ok(
      '🔍 NO fake Team account created for placeholder',
      teamCountAfter === teamCountBefore,
      { before: teamCountBefore, after: teamCountAfter }
    );

    // ── C. Event title verbatim (non-competitive payload as the fixed client sends it) ──
    console.log('\n▶ C. Non-competitive event: title stored verbatim');
    const eventTitle = 'Watch party';
    const ev = await api('POST', '/games', coach.token, {
      title: eventTitle, // fixed client sends the typed name verbatim
      date: new Date(Date.now() + 7 * 864e5).toISOString(),
      description: eventTitle,
      event_type: 'watch_party',
      home_team_id: myTeam.id,
      location: '230 Tresser Blvd, Stamford, CT 06901, USA',
    });
    ok('create → 2xx', ev.status < 300, ev.status);
    const evId = ev.body?.id || ev.body?.game?.id;
    if (evId) cleanupIds.games.push(evId);
    const evRow = evId
      ? await (prisma.game.findUnique as any)({ where: { id: evId }, select: { title: true } })
      : null;
    ok('stored title === "Watch party" (no "<title> Event" mangling)', evRow?.title === eventTitle, evRow?.title);

    // ── D. Manage Org: legacy league_owner_id-only owner ──
    console.log('\n▶ D. Manage Org — legacy owner (league_owner_id only, no membership row)');
    const legacyOwner = await mkUser('legacy');
    cleanupIds.users.push(legacyOwner.id);
    const legacyOrg = await prisma.organization.create({
      data: {
        name: `J4 Legacy Org ${Date.now()}`,
        league_owner_id: legacyOwner.id,
        admin_approved: true,
        approved_at: new Date(),
      },
      select: { id: true },
    });
    cleanupIds.orgs.push(legacyOrg.id);
    const sums = await api('GET', '/organizations/mine/review-summaries', legacyOwner.token);
    ok('review-summaries → 200', sums.status === 200, sums.status);
    const foundLegacy =
      Array.isArray(sums.body) && sums.body.some((s: any) => s?.organization?.id === legacyOrg.id);
    ok('legacy org included → Manage Org navigates', foundLegacy);
    const legacyEntry = Array.isArray(sums.body)
      ? sums.body.find((s: any) => s?.organization?.id === legacyOrg.id)
      : null;
    ok(
      '🔍 legacy entry reports owner-level permissions',
      legacyEntry?.permissions?.can_manage === true &&
        legacyEntry?.permissions?.membership_role === 'owner',
      legacyEntry?.permissions
    );

    // ── E. Interactions username (was "Anonymous" in vertical viewer) ──
    console.log('\n▶ E. /users/:id/interactions returns author.username');
    const poster = await mkUser('poster');
    const liker = await mkUser('liker');
    cleanupIds.users.push(poster.id, liker.id);
    const posterUsername = `j4p${Date.now() % 100000000}`;
    await prisma.user.update({ where: { id: poster.id }, data: { username: posterUsername } });
    // Poster needs onboarding to create posts — seed the post directly instead.
    const post = await (prisma.post.create as any)({
      data: {
        author_id: poster.id,
        content: 'What a legend caption',
        media_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      },
      select: { id: true },
    });
    cleanupIds.posts.push(post.id);
    await prisma.postUpvote.create({ data: { post_id: post.id, user_id: liker.id } });
    await prisma.post.update({ where: { id: post.id }, data: { upvotes_count: 1 } });

    const inter = await api('GET', `/users/${liker.id}/interactions?type=like&limit=10`, liker.token);
    ok('interactions → 200', inter.status === 200, inter.status);
    const item = inter.body?.items?.[0];
    ok('item present', !!item, inter.body?.items?.length);
    ok(
      'author.username populated (no more "Anonymous")',
      item?.author?.username === posterUsername,
      { got: item?.author?.username, expected: posterUsername }
    );
    ok('caption served for vertical-feed preview', item?.caption === 'What a legend caption', item?.caption);
  } finally {
    // Cleanup (reverse dependency order)
    await prisma.postUpvote.deleteMany({ where: { post_id: { in: cleanupIds.posts } } }).catch(() => {});
    await prisma.post.deleteMany({ where: { id: { in: cleanupIds.posts } } }).catch(() => {});
    await (prisma.event.deleteMany as any)({ where: { game_id: { in: cleanupIds.games } } }).catch(() => {});
    await (prisma.game.deleteMany as any)({ where: { id: { in: cleanupIds.games } } }).catch(() => {});
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: cleanupIds.teams } } }).catch(() => {});
    await prisma.team.deleteMany({ where: { id: { in: cleanupIds.teams } } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: { in: cleanupIds.orgs } } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: cleanupIds.orgs } } }).catch(() => {});
    await prisma.adminActivityLog.deleteMany({ where: { target_id: { in: cleanupIds.users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } }).catch(() => {});
    await prisma.$disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
