# Sport Programs — Phase 3 Implementation Plan (Public program pages with level folders)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One public page per sport program ("Stamford Girls Basketball") with varsity/JV/freshman as folder sections inside; old `/teams/:id` links keep working; program-native share URLs added.

**Architecture:** Level teams keep their ids, games, posts, chats, and `TeamFollow` rows — nothing is re-keyed. A new `GET /programs/:id/screen-summary` aggregates the program's level teams. **Follow semantics (reconciled — see Decision Note):** reads are a _union_ (you follow the program if you follow any of its level teams; the follower count is a `DISTINCT user_id` over them); the follow _action_ fans out `TeamFollow` rows across the program's current level teams, because `TeamFollow` is the only place a follow can be written. Both existing feed clauses therefore need **zero** changes. Old `/teams/:id` links resolve via a client redirect using `team.program_id`, which is already on the wire.

**Tech Stack:** Express + Prisma + Zod (server), Expo RN + react-query (client), jest.

## Decision Note (read before Task 2)

The chosen "read-time union" model is a **read** semantic. A Follow button must still write somewhere, and no program-follow table exists (deliberately — that option was rejected to avoid touching both feed clauses). So:

- **Read** (`is_following`, `followers_count`): union/distinct over the program's level teams. This is what makes a legacy follower of just "JV Girls Soccer" correctly appear as a program follower.
- **Write** (`POST /programs/:id/follow`): upsert a `TeamFollow` row for **every current level team**; `DELETE` removes them all. Idempotent (P2002 tolerated, matching `teams.ts` follow).
- **Consequence, accepted:** a level team added to a program _later_ does not retroactively gain the program's existing followers. Task 2 logs this; a sync is out of scope.
- **No feed change:** `feed.ts`'s `followedTeamIds` `in`-list and `posts.ts`'s `followers.some.user_id` relation filter both keep working because real `TeamFollow` rows exist.

## Global Constraints

- **Additive only.** No Prisma migration in this phase. `Team`, `TeamFollow`, `GroupChat`, `Post`, `Game` keep their existing keys and semantics. Per-level group chats are retained (no program chat).
- Server: errors via `sendError` (`npm run verify:error-envelope`); async routes wrapped in `asyncHandler` (`npm run verify:async-handlers`); every `findMany` carries `take` (`unbounded-queries.test.ts`).
- Server tests run via `cd server && npm test -- --testPathPattern=... --no-coverage` (ESM wrapper; bare `npx jest` breaks).
- Client: no hardcoded dark text colors — use `useColorScheme()`/theme constants. Screens must render loading, error, success, and empty states. No `fetch` in `app/` — go through `api/*`.
- Navigation: use `safeGoBack`; any `router.replace` needs a `// nav-safe: <reason>` comment (`npm run audit:navigation:fail` must show 0 REVIEW items). The team-page→program-page redirect IS a `replace` and MUST carry that comment.
- Branch stacks on `feat/sport-programs-phase-2`. Working tree has unrelated user WIP — every task stages ONLY its own files, never `git add -A`.
- New routes must pick an explicit authorization tier (role-barrier model). Program reads are public-authenticated (matching `GET /organizations/:id/programs`).
- **Privacy: private level teams must never leak through a program surface.** `GET /programs/:id/screen-summary` filters its `levels` with `isTeamHiddenFromViewer(teamId, viewerId)` (`server/src/lib/privacyUtils.ts:282`), exactly as `GET /teams/:id/screen-summary` does (`teams.ts:749-754`). Counts reflect only visible teams; `followers_count`/`is_following` are computed over all active level teams (follow state is not private, and the union must be viewer-stable). A program whose every level team is hidden returns `200` with `levels: []`, not `404` — the program itself is not private. The client (Task 5) therefore renders only what the server returns and must not assume `levels.length === counts.teams` from any other source.

---

### Task 1: `GET /programs/:id/screen-summary`

**Files:**

- Create: `server/src/routes/programs.ts`
- Modify: `server/src/app.ts` (mount `programsRouter` at `/programs`)
- Create: `server/src/__tests__/program-screen-summary.test.ts`

**Interfaces (produced):**

```
GET /programs/:id/screen-summary   (requireAuth)
200 {
  program: { id, organization_id, sport, gender, name, logo_url, created_at,
             followers_count, is_following,
             organization: { id, name } | null },
  levels: [ { level: string|null,
              team: <serializeTeam baseline + counts>,
              games: [<GAME_SUMMARY_SELECT>] } ],
  counts: { levels: number, teams: number, games: number }
}
404 'Program not found'
```

`levels` are ordered by the canonical level order (`varsity, jv, freshman, middle_school, unified, other`, then `null` last). Tasks 4–6 consume this exact shape.

- [ ] **Step 1: Write the failing test**

`server/src/__tests__/program-screen-summary.test.ts` — model fixtures on `server/src/__tests__/sport-programs.test.ts` (bcrypt user with `preferences.coach_agreement_accepted_at`, org + membership, then `prisma.sportProgram.create` + two teams with levels `varsity`/`jv`, one `teamFollow` row on the JV team by a second user):

```ts
it('returns the program, its levels in canonical order, and a distinct follower count', async () => {
  const res = await request(app)
    .get(`/programs/${programId}/screen-summary`)
    .set('Authorization', `Bearer ${followerToken}`);
  expect(res.status).toBe(200);
  expect(res.body.program.sport).toBe('basketball');
  expect(res.body.program.gender).toBe('girls');
  expect(res.body.levels.map((l: any) => l.level)).toEqual(['varsity', 'jv']);
  expect(res.body.levels[0].team.id).toBe(varsityTeamId);
  // follower of ONE level team counts once, and reads as following the program
  expect(res.body.program.followers_count).toBe(1);
  expect(res.body.program.is_following).toBe(true);
  expect(res.body.counts.teams).toBe(2);
});

it('a viewer who follows no level team is not following the program', async () => {
  const res = await request(app)
    .get(`/programs/${programId}/screen-summary`)
    .set('Authorization', `Bearer ${strangerToken}`);
  expect(res.body.program.is_following).toBe(false);
  expect(res.body.program.followers_count).toBe(1);
});

it('404s an unknown program', async () => {
  await request(app)
    .get('/programs/does-not-exist/screen-summary')
    .set('Authorization', `Bearer ${followerToken}`)
    .expect(404);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd server && npm test -- --testPathPattern="program-screen-summary" --no-coverage`
Expected: FAIL — 404 (route does not exist).

- [ ] **Step 3: Implement**

`server/src/routes/programs.ts` — mirror `teams.ts:744`'s screen-summary structure; reuse `serializeTeam`/`buildTeamSerializeSelect` and `GAME_SUMMARY_SELECT` (exported from `teams.ts` — if it is not exported, import it from wherever it is defined rather than re-declaring it; if it is module-private, export it in the same commit and say so in your report).

```ts
import { Router } from 'express';
import { sendError } from '../lib/http/sendError.js';
import { prisma } from '../lib/prisma.js';
import { serializeTeam, buildTeamSerializeSelect } from '../lib/serializeTeam.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { AuthedRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { registerIdValidation } from '../middleware/validateParams.js';

export const programsRouter = Router();
registerIdValidation(programsRouter);

const LEVEL_ORDER = ['varsity', 'jv', 'freshman', 'middle_school', 'unified', 'other'];
function levelRank(level: string | null): number {
  if (!level) return LEVEL_ORDER.length; // nulls last
  const i = LEVEL_ORDER.indexOf(level);
  return i === -1 ? LEVEL_ORDER.length : i;
}

programsRouter.get(
  '/:id/screen-summary',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    const programId = String(req.params.id);
    const viewerId = req.user?.id ?? null;

    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      include: {
        organization: { select: { id: true, name: true } },
        teams: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
          take: 25,
          select: {
            ...buildTeamSerializeSelect({ includeCounts: true }),
            status: true,
          },
        },
      },
    });
    if (!program) return sendError(res, 404, 'Program not found');

    const teamIds = program.teams.map(t => t.id);

    // Read-time union: distinct followers across the program's level teams.
    const [followerRows, viewerFollow, games] = await Promise.all([
      teamIds.length
        ? prisma.teamFollow.groupBy({ by: ['user_id'], where: { team_id: { in: teamIds } } })
        : Promise.resolve([] as { user_id: string }[]),
      viewerId && teamIds.length
        ? prisma.teamFollow.findFirst({
            where: { user_id: viewerId, team_id: { in: teamIds } },
            select: { team_id: true },
          })
        : Promise.resolve(null),
      teamIds.length
        ? prisma.game.findMany({
            where: {
              approval_status: 'approved',
              opponent_approval_status: { in: ['not_required', 'approved'] },
              OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
            },
            orderBy: { date: 'desc' },
            take: 100,
            select: GAME_SUMMARY_SELECT,
          })
        : Promise.resolve([] as any[]),
    ]);

    const gamesByTeam = new Map<string, any[]>();
    for (const g of games) {
      for (const tid of [g.home_team_id, g.away_team_id]) {
        if (!tid || !teamIds.includes(tid)) continue;
        const list = gamesByTeam.get(tid) ?? [];
        if (list.length < 20) list.push(g);
        gamesByTeam.set(tid, list);
      }
    }

    const levels = [...program.teams]
      .sort((a, b) => levelRank(a.level) - levelRank(b.level))
      .map(team => ({
        level: team.level ?? null,
        team: serializeTeam(team, { includeCounts: true }),
        games: (gamesByTeam.get(team.id) ?? []).map(g => ({
          ...g,
          date: g.date instanceof Date ? g.date.toISOString() : String(g.date),
        })),
      }));

    return res.json({
      program: {
        id: program.id,
        organization_id: program.organization_id,
        sport: program.sport,
        gender: program.gender,
        name: program.name,
        logo_url: program.logo_url,
        created_at: program.created_at.toISOString(),
        followers_count: followerRows.length,
        is_following: !!viewerFollow,
        organization: program.organization ?? null,
      },
      levels,
      counts: {
        levels: levels.length,
        teams: program.teams.length,
        games: games.length,
      },
    });
  })
);
```

Mount in `server/src/app.ts` next to the other routers: `app.use('/programs', programsRouter);` (import at the top with the sibling route imports).

- [ ] **Step 4:** `cd server && npm test -- --testPathPattern="program-screen-summary" --no-coverage` → PASS (3 tests).
- [ ] **Step 5:** Gates: `npx tsc --noEmit --project server/tsconfig.json` → 0 errors; `npm run verify:error-envelope && npm run verify:async-handlers` → clean; `cd server && npm test -- --testPathPattern="unbounded-queries" --no-coverage` → PASS.
- [ ] **Step 6: Commit**

```bash
git add server/src/routes/programs.ts server/src/app.ts server/src/__tests__/program-screen-summary.test.ts
git commit -m "feat(programs): GET /programs/:id/screen-summary with level folders + union follower count"
```

---

### Task 2: Program follow / unfollow (fan-out write, union read)

**Files:**

- Modify: `server/src/routes/programs.ts`
- Modify: `server/src/__tests__/program-screen-summary.test.ts`

**Interfaces (produced):**

```
POST   /programs/:id/follow   (requireAuth, followLimiter) → 200 { ok: true, followed_team_ids: string[] }
DELETE /programs/:id/follow   (requireAuth)                → 200 { ok: true, unfollowed: number }
```

Both idempotent. Follow upserts a `TeamFollow` row per active level team; unfollow deletes them all.

- [ ] **Step 1: Write the failing tests**

```ts
it('following a program follows every current level team, idempotently', async () => {
  const first = await request(app)
    .post(`/programs/${programId}/follow`)
    .set('Authorization', `Bearer ${strangerToken}`);
  expect(first.status).toBe(200);
  expect(first.body.followed_team_ids.sort()).toEqual([varsityTeamId, jvTeamId].sort());

  // second call must not throw on the unique (user_id, team_id) constraint
  await request(app)
    .post(`/programs/${programId}/follow`)
    .set('Authorization', `Bearer ${strangerToken}`)
    .expect(200);

  const rows = await prisma.teamFollow.count({
    where: { user_id: strangerId, team_id: { in: [varsityTeamId, jvTeamId] } },
  });
  expect(rows).toBe(2);
});

it('unfollowing a program removes every level-team follow', async () => {
  await request(app)
    .delete(`/programs/${programId}/follow`)
    .set('Authorization', `Bearer ${strangerToken}`)
    .expect(200);
  const rows = await prisma.teamFollow.count({
    where: { user_id: strangerId, team_id: { in: [varsityTeamId, jvTeamId] } },
  });
  expect(rows).toBe(0);
});

it('404s follow on an unknown program', async () => {
  await request(app)
    .post('/programs/does-not-exist/follow')
    .set('Authorization', `Bearer ${strangerToken}`)
    .expect(404);
});
```

- [ ] **Step 2:** Run → FAIL (404, routes missing).
- [ ] **Step 3: Implement** in `programs.ts`. Reuse the `followLimiter` that `teams.ts` uses for `POST /teams/:id/follow` (import it from wherever `teams.ts` gets it). Tolerate P2002 exactly as the team follow route does.

```ts
programsRouter.post(
  '/:id/follow',
  requireAuth as any,
  followLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const programId = String(req.params.id);
    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      select: { id: true, teams: { where: { status: 'active' }, select: { id: true }, take: 25 } },
    });
    if (!program) return sendError(res, 404, 'Program not found');

    const teamIds = program.teams.map(t => t.id);
    // createMany + skipDuplicates keeps this idempotent under the
    // (user_id, team_id) composite PK without a P2002 round-trip.
    if (teamIds.length) {
      await prisma.teamFollow.createMany({
        data: teamIds.map(team_id => ({ team_id, user_id: req.user!.id })),
        skipDuplicates: true,
      });
    }
    return res.json({ ok: true, followed_team_ids: teamIds });
  })
);

programsRouter.delete(
  '/:id/follow',
  requireAuth as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return sendError(res, 401, 'Unauthorized');
    const programId = String(req.params.id);
    const program = await prisma.sportProgram.findUnique({
      where: { id: programId },
      select: { id: true, teams: { select: { id: true }, take: 25 } },
    });
    if (!program) return sendError(res, 404, 'Program not found');
    const teamIds = program.teams.map(t => t.id);
    const removed = teamIds.length
      ? await prisma.teamFollow.deleteMany({
          where: { user_id: req.user.id, team_id: { in: teamIds } },
        })
      : { count: 0 };
    return res.json({ ok: true, unfollowed: removed.count });
  })
);
```

Note in your report: unlike `POST /teams/:id/follow`, this does **not** send `TEAM_FOLLOWED` notifications (a program follow would fan out N notifications to the same staff). That is deliberate; state it.

Also note the accepted consequence from the Decision Note: a level team added later does not inherit existing program followers.

- [ ] **Step 4:** tests PASS (6 total in the file).
- [ ] **Step 5:** Gates as Task 1 Step 5. Commit:

```bash
git add server/src/routes/programs.ts server/src/__tests__/program-screen-summary.test.ts
git commit -m "feat(programs): program follow/unfollow fans out across level teams"
```

---

### Task 3: Program share landing, deep links, AASA

**Files:**

- Modify: `server/src/routes/shareLanding.ts` (add `programLanding`, register `GET /programs/:id`, add `/programs` to `SHAREABLE_PATHS`)
- Modify: `server/src/routes/well-known.ts` (add `/programs/*` to `IOS_PATHS`)
- Modify: `utils/links.ts` (add `AppLinks.program`)
- Modify: `utils/deepLinks.ts` (`ROUTE_MAP`: `program`/`programs` → `/program-page`; add `/program-page` to the public routes set)
- Modify: `server/src/__tests__/share-landing.test.ts` if it exists; else create `server/src/__tests__/program-share-landing.test.ts`
- Modify: `__tests__/deep-links.test.ts` if it exists (search for the existing deep-link test file first)

- [ ] **Step 1:** Read `shareLanding.ts:273-297` (`teamLanding`) and `:371`. Write `programLanding` in the same shape: fetch `sportProgram.findUnique({ select: { id, sport, gender, name, logo_url, organization: { select: { name } } } })`, then `renderLanding` with a title built as `name ?? "{Gender} {Sport}"` prefixed by the org name (e.g. "Stamford High — Girls Basketball"). Do NOT import client constants; write a small local label helper in this file and keep it beside `programLanding`.
      **Not-found behavior — match the siblings exactly.** A well-formed id with no matching row must fall back to `genericLanding(req)` (the branded page with store buttons), the `program ? {…} : genericLanding(req)` shape `teamLanding` uses at `:285-292`. `next()` is reserved for the `!wantsHtml(req)` / empty-id guards, as in the siblings. **Do not `next()` on a missing program** — no `GET /programs/:id` route exists downstream, so it falls through to Express's default handler and renders a raw `Cannot GET` page to anyone tapping a dead share link. Any test for this must exercise the real app's routing, not a hand-rolled stub route.
- [ ] **Step 2:** Register `shareLandingRouter.get('/programs/:id', programLanding);` next to the teams route, add `'/programs'` to `SHAREABLE_PATHS` (`:45`), and `'/programs/*'` to `IOS_PATHS` in `well-known.ts`.
- [ ] **Step 3:** Client links — in `utils/links.ts`, beside `team:` (`:83-89`):

```ts
  /**
   * Generate shareable link for a sport program (e.g. "Girls Basketball").
   */
  program: (id: string, programName?: string): ShareableLink => {
    const webUrl = `${WEB_BASE_URL}/programs/${id}`;
    const deepLink = `${APP_SCHEME}://program/${id}`;
    const shareMessage = programName
      ? `Follow ${programName} on VarsityHub!\n${webUrl}`
      : `Check out this program on VarsityHub!\n${webUrl}`;
    return { webUrl, deepLink, shareMessage };
  },
```

- [ ] **Step 4:** `utils/deepLinks.ts` — add `program: '/program-page'` and `programs: '/program-page'` to `ROUTE_MAP` (beside `team`/`teams` at `:139-140`), and add `'/program-page'` to the public deep-link routes set (`:49`). Confirm the universal `id` param allowlist covers it (it does — resource routes fall through).
- [ ] **Step 5:** Tests — assert `ROUTE_MAP.program === '/program-page'` and that `buildRouteParams('/program-page', { id: 'x', evil: '1' })` drops `evil`. Server: assert `GET /programs/:id` returns 200 HTML containing the program label and 404s an unknown id.
- [ ] **Step 6:** Gates: server tsc, client `npx tsc --noEmit`, `npm run audit:navigation` clean. Commit:

```bash
git add server/src/routes/shareLanding.ts server/src/routes/well-known.ts utils/links.ts utils/deepLinks.ts server/src/__tests__/program-share-landing.test.ts
git commit -m "feat(programs): program share landing, deep links, AASA paths"
```

---

### Task 4: Client API surface for programs

**Files:**

- Modify: `api/entities.ts` (new `Program` entity)
- Modify: `api/schemas/team.ts` OR create `api/schemas/program.ts` (prefer a new file — one responsibility)
- Create: `hooks/useProgramScreenSummary.ts`

**Interfaces (produced):**

```ts
// api/entities.ts
export const Program = {
  screenSummary: (id: string) =>
    httpGet(`/programs/${encodeURIComponent(id)}/screen-summary`).then(r =>
      validateProgramScreenSummary('program.screenSummary', r)
    ),
  follow: (id: string) => httpPost(`/programs/${encodeURIComponent(id)}/follow`, {}),
  unfollow: (id: string) => httpDelete(`/programs/${encodeURIComponent(id)}/follow`),
};

// api/schemas/program.ts
export type ProgramScreenSummary = {
  program: {
    id: string;
    organization_id: string;
    sport: string;
    gender: 'boys' | 'girls' | 'coed';
    name: string | null;
    logo_url: string | null;
    created_at: string;
    followers_count: number;
    is_following: boolean;
    organization: { id: string; name: string } | null;
  };
  levels: { level: string | null; team: any; games: any[] }[];
  counts: { levels: number; teams: number; games: number };
};
export function validateProgramScreenSummary(context: string, data: unknown): ProgramScreenSummary;

// hooks/useProgramScreenSummary.ts
export function useProgramScreenSummary(
  programId?: string | null
): UseQueryResult<ProgramScreenSummary>; // queryKey ['program-page', programId]
```

Model `validateProgramScreenSummary` on `validateTeamScreenSummary` (`api/schemas/team.ts:181-189`) — passthrough object, same failure behavior. Model the hook on `useOrgProgramsQuery`.

- [ ] **Step 1:** Write `__tests__/program-schema.test.ts` asserting `validateProgramScreenSummary` accepts the Task 1 response shape and passes through unknown extra fields.
- [ ] **Step 2:** Run → FAIL. Implement all three files. Run → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit** `feat(programs): client Program entity, schema, and screen-summary hook` (only the three files + the test).

---

### Task 5: `app/program-page.tsx` — the public program page with level folders

**Files:**

- Create: `app/program-page.tsx`
- Create: `app/__tests__/program-page.smoke.test.tsx`

**Behavior:**

- Route param `id` = program id. Data via `useProgramScreenSummary(id)`.
- **All four states required:** `isPending` → spinner; error → message + retry (`safeGoBack` back button always present); success; empty (a program with zero level teams → "No teams in this program yet").
- Header: program logo (`program.logo_url`, falls back to the first level team's logo), title = `formatProgramLabel({ sport, gender, name })` from `constants/programs.ts` (reuse — do not re-derive), org name row linking to `/organization?id=…`, stats row: `counts.teams` Teams · `program.followers_count` Followers · `counts.games` Games.
- Follow button: `Program.follow/unfollow`, optimistic toggle off `program.is_following`, invalidate `['program-page', id]` on settle. Mirrors team-page's follow button styling.
- **Level folders:** one collapsible section per `levels[]` entry, header = `formatLevelLabel(level) ?? 'Team'` + game count; expanded content = that level's games list, reusing team-page's game row renderer shape (date badge, `gameRowTitle`, score) and tapping to `/game/[id]`. Default: the **first** folder expanded; the others collapsed.
- Each folder header has a "Team page" affordance pushing `/team-page?id={team.id}&from=program` — the level team's own page remains reachable (and `from=program` suppresses the redirect added in Task 6).
- No posts tab in this task (deferred — see Out of scope).

- [ ] **Step 1: failing smoke test** — mock `Program.screenSummary` with a two-level fixture; assert the program title renders, both level headers render, the first folder's game title is visible, and the collapsed second folder's game title is not. Assert the empty state renders for `levels: []`.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npm run audit:navigation` → 0 REVIEW; grep the new file for hardcoded dark colors (`grep -nE "'#000|'#111|'#374151|black" app/program-page.tsx` → only `backgroundColor`/`shadowColor`/`// audit:` hits).
- [ ] **Step 4: Commit** `feat(programs): public program page with level folders`.

---

### Task 6: Redirect old team links to the program page

**Files:**

- Modify: `app/team-page.tsx`
- Modify: `app/__tests__/team-page-redirect.test.tsx` (create)

**Behavior:** After team data loads, if `team.program_id` is set AND `params.from !== 'program'`, `router.replace({ pathname: '/program-page', params: { id: team.program_id } })`. Guard so it fires once (a `useRef` latch), never during `isPending`, and never when `program_id` is null (legacy/ungrouped teams keep their own page — that is the OTA-safe default when the server hasn't deployed Phase 0+1).

The `replace` MUST carry: `// nav-safe: canonical program page supersedes the level-team page; from=program bypasses`.

- [ ] **Step 1: failing test** — mock `Team.screenSummary` returning `program_id: 'prog1'` → assert `router.replace` called with `/program-page` and `id: 'prog1'`. Second case: `program_id: null` → assert no replace and the team page renders. Third: `params.from === 'program'` → no replace.
- [ ] **Step 2:** Run → FAIL. Implement. Run → PASS.
- [ ] **Step 3:** `npm run audit:navigation:fail` → 0 REVIEW items. `npx tsc --noEmit` clean.
- [ ] **Step 4: Commit** `feat(programs): team pages redirect to their canonical program page`.

---

### Task 7: Org pages list programs, not level teams

**Files:**

- Modify: `app/(tabs)/organization.tsx` (teams section ~:829-867, `handleTeamPress` ~:305)

> **Do NOT touch `app/organizations/[id].tsx`.** Its team list is unreachable in production: real orgs hit `<Redirect href="/organization?id=…">` at `:241` before render, and the only payload that reaches it (`seedOrganizationToPayload`) sets `_count.teams` as a number and never a `teams` array. Both its program branch and its legacy "Group X" grouping are dead. Adding grouping there is speculative dead code (repo Working Style: don't build for scenarios that can't happen).

- Modify: `app/__tests__/` — extend whichever smoke tests cover these screens; if none exist, create `app/__tests__/organization-programs.smoke.test.tsx` covering the grouped render.

**Behavior:** Both screens already receive teams carrying `program_id`/`level`. Group with `groupTeamsByProgram` (from `constants/programs.ts`) and fetch program metadata via the existing `useOrgProgramsQuery(orgId)`. Render **one row per program** (title `formatProgramLabel`, subtitle "{n} teams · Varsity, JV") pushing `/program-page?id={programId}`; ungrouped teams keep their existing per-team rows pushing `/team-page`. When no team has a `program_id`, render exactly today's list (no behavior change) — this is the OTA-safe path.

Note: `app/organizations/[id].tsx` currently groups by a `"Group X"` prefix in `description` (`:120-142`). Leave that fallback intact for orgs with no programs; program grouping takes precedence when present.

- [ ] **Step 1: failing test** → grouped fixture renders one program row and no per-level rows; ungrouped fixture renders today's rows.
- [ ] **Step 2:** implement → PASS → `npx tsc --noEmit` clean.
- [ ] **Step 3: Commit** `feat(programs): org pages list sport programs`.

---

### Task 8: Docs, gates, PR

**Files:** `CLAUDE.md`, `AGENTS.md` (same pass — shared-facts rule), `docs/ARCHITECTURE.md`

- [ ] **Step 1:** Document in all three: the program page is the canonical public surface; level teams keep their pages but redirect when they belong to a program; **follow reads are a union, writes fan out to level teams; no ProgramFollow table and no feed-clause change**; per-level group chats retained; `GET /programs/:id/screen-summary`, `POST/DELETE /programs/:id/follow`, `GET /programs/:id` (share landing). Keep CLAUDE.md and AGENTS.md byte-identical for the shared paragraph. Do **not** run `npm run format` over `docs/ARCHITECTURE.md` (its markdown round-trips unstably — see the `pg_trgm` incident).
- [ ] **Step 2: Full battery.** `npx tsc --noEmit`; `npx tsc --noEmit --project server/tsconfig.json`; `npm run test:regressions`; `cd server && npm test` (triage: only the 4 known pre-existing failures — `auth-screen-snapshot-contract`, `ad-ux-guards`, `remaining-auth-canonical-state-contracts`, `video-trim-native-patch.contract` — are acceptable, and reproduce them on the base branch before accepting); `npm run audit:navigation:fail`; `npm run verify:error-envelope`; `npm run verify:async-handlers`.
- [ ] **Step 3: Commit** `docs(programs): record public program pages + union follow semantics` and open the PR.

PR body must state: no migration; follow-write fan-out consequence (later-added level teams don't inherit followers); OTA posture (a client with program-page against a server without `/programs/*` → `useProgramScreenSummary` errors → the page shows its error state, but **team-page's redirect only fires when `program_id` is present**, which requires the Phase 0+1 server, so old clients and old servers never reach the broken path); deploy server-first.

---

## Out of scope (deliberate, → Phase 4 or later)

Aggregated cross-level post feed on the program page (posts stay on level-team pages this phase); program-level group chat (`GroupChat.program_id`); search returning a program bucket (`search.ts`); program logo upload/edit UI; `team-hub`/`team-admin` default-team behavior in a program world; Phase 2's deferred minors (TeamCard JSX dedup, ungrouped-level display, single-org header inference, silent-ungrouped-fallback feedback).
