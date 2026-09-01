# Discover `following` Discovery Scope — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `/event-discovery` with a `following` scope (viewer's followed+managed teams, future-only unbounded window) reusing the card serializer, and migrate Discover's calendar to consume it through `validateEventCards`.

**Architecture:** Server adds `scope: 'public' | 'following'` to `listEventDiscoveryItems` + a `getViewerTeamScope` resolver; the public path stays byte-identical. Client adds a pure `EventCard[] → calendar rows` projection and swaps Discover's three calendar queries for one scoped call.

**Tech Stack:** Express + Prisma (server), React Native / Expo + react-query + zod (client), Jest.

**Spec:** `docs/superpowers/specs/2026-09-01-discover-following-scope-design.md`

## Global Constraints

- Run tooling under **nvm Node 20**. Server tests: `cd server && npm test -- --testPathPattern="..."` (ESM wrapper). Client: `npx jest ...`.
- `following` window is **future-only, UNBOUNDED** (`from = now`, `to = now + 365d`), NOT the public 5-day clamp. Regressing to 5 days is the #1 bug to avoid.
- Managed-teams semantics MUST match `/teams/managed`: reuse `TEAM_STAFF_ROLES` and `ORG_ADMIN_ROLES` from `server/src/lib/teamAuthorization.ts` (staff `TeamMembership` OR org-admin of the team's org). Do not invent a new role list.
- Every Prisma `findMany` carries a `take`.
- `scope=following` never 500s: null viewer or empty scope → `{ items: [], meta }`.
- `scope=public` output byte-identical: the existing `event-discovery-contract.test.ts` must stay green **unchanged**.
- Discover keeps its followed/managed **scope** and calendar UI; only the data source changes.
- **Integration base required** (see spec Branching): this lane needs both the server serializer (`refactor/server-serialize-event-card`) and client `validateEventCards` (`feat/event-card-contract`). Confirm the base branch contains both before starting.

---

### Task 1: `getViewerTeamScope` resolver

**Files:**

- Create: `server/src/lib/viewerTeamScope.ts`
- Test: `server/src/__tests__/viewer-team-scope.test.ts`

**Interfaces:**

- Produces: `getViewerTeamScope(db, viewerId: string | null | undefined): Promise<Set<string>>` — union of followed + managed team ids.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { getViewerTeamScope } from '../lib/viewerTeamScope.js';

function makeDb(overrides: any = {}) {
  return {
    teamFollow: { findMany: jest.fn(async () => [{ team_id: 'followed-1' }]) },
    teamMembership: { findMany: jest.fn(async () => [{ team_id: 'staff-1' }]) },
    organizationMembership: { findMany: jest.fn(async () => [{ organization_id: 'org-1' }]) },
    team: { findMany: jest.fn(async () => [{ id: 'orgteam-1' }]) },
    ...overrides,
  } as any;
}

describe('getViewerTeamScope', () => {
  it('returns empty set for a null viewer without querying', async () => {
    const db = makeDb();
    const scope = await getViewerTeamScope(db, null);
    expect(scope.size).toBe(0);
    expect(db.teamFollow.findMany).not.toHaveBeenCalled();
  });

  it('unions followed, staff-managed, and org-admin teams', async () => {
    const scope = await getViewerTeamScope(makeDb(), 'viewer-1');
    expect([...scope].sort()).toEqual(['followed-1', 'orgteam-1', 'staff-1']);
  });

  it('skips the org-team query when the viewer administers no orgs', async () => {
    const db = makeDb({ organizationMembership: { findMany: jest.fn(async () => []) } });
    const scope = await getViewerTeamScope(db, 'viewer-1');
    expect(db.team.findMany).not.toHaveBeenCalled();
    expect([...scope].sort()).toEqual(['followed-1', 'staff-1']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npm test -- --testPathPattern="viewer-team-scope" --no-coverage`
Expected: FAIL — `Cannot find module '../lib/viewerTeamScope.js'`.

- [ ] **Step 3: Implement**

```ts
import type { PrismaClient } from '@prisma/client';
import { ORG_ADMIN_ROLES, TEAM_STAFF_ROLES } from './teamAuthorization.js';

const SCOPE_TAKE = 5000;

/**
 * The set of team ids a viewer follows or manages. "Manages" mirrors
 * /teams/managed: an active staff TeamMembership (TEAM_STAFF_ROLES) OR being an
 * org admin (ORG_ADMIN_ROLES) of the team's organization. Query-builder based
 * (not the route's raw SQL) so it composes with the discovery pipeline and is
 * mockable in the same style as eventDiscovery's tests.
 */
export async function getViewerTeamScope(
  db: PrismaClient,
  viewerId: string | null | undefined
): Promise<Set<string>> {
  if (!viewerId) return new Set();
  const [follows, staff, orgAdmin] = await Promise.all([
    db.teamFollow.findMany({
      where: { user_id: viewerId },
      select: { team_id: true },
      take: SCOPE_TAKE,
    }),
    db.teamMembership.findMany({
      where: { user_id: viewerId, status: 'active', role: { in: [...TEAM_STAFF_ROLES] } as any },
      select: { team_id: true },
      take: SCOPE_TAKE,
    }),
    db.organizationMembership.findMany({
      where: { user_id: viewerId, status: 'active', role: { in: [...ORG_ADMIN_ROLES] } as any },
      select: { organization_id: true },
      take: SCOPE_TAKE,
    }),
  ]);

  const teamIds = new Set<string>();
  for (const row of follows) teamIds.add(row.team_id);
  for (const row of staff) teamIds.add(row.team_id);

  const orgIds = orgAdmin.map((row: any) => row.organization_id).filter(Boolean);
  if (orgIds.length > 0) {
    const orgTeams = await db.team.findMany({
      where: { organization_id: { in: orgIds }, status: 'active' },
      select: { id: true },
      take: SCOPE_TAKE,
    });
    for (const row of orgTeams) teamIds.add(row.id);
  }
  return teamIds;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd server && npm test -- --testPathPattern="viewer-team-scope" --no-coverage`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
cd server && npx tsc --noEmit 2>&1 | tail -3; cd ..
git add server/src/lib/viewerTeamScope.ts server/src/__tests__/viewer-team-scope.test.ts
git commit -m "feat(server): getViewerTeamScope resolver (followed + managed teams)"
```

---

### Task 2: `following` scope in discovery + route

**Files:**

- Modify: `server/src/lib/eventDiscovery.ts`
- Modify: `server/src/routes/eventDiscovery.ts`
- Test: `server/src/__tests__/event-discovery-following-scope.test.ts`

**Interfaces:**

- Consumes: `getViewerTeamScope` (Task 1), `serializeGameCard`/`serializeEventCard`.
- Produces: `listEventDiscoveryItems(db, { ...existing, scope?: 'public' | 'following' })`; route accepts `?scope=following`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, jest } from '@jest/globals';
import { listEventDiscoveryItems } from '../lib/eventDiscovery.js';

const now = new Date('2026-09-01T12:00:00.000Z');

function db(followedTeamId: string) {
  return {
    teamFollow: { findMany: jest.fn(async () => [{ team_id: followedTeamId }]) },
    teamMembership: { findMany: jest.fn(async () => []) },
    organizationMembership: { findMany: jest.fn(async () => []) },
    team: { findMany: jest.fn(async () => []) },
    game: {
      findMany: jest.fn(async () => [
        {
          id: 'g-followed',
          title: 'Mine',
          date: new Date('2026-09-25T00:00:00Z'),
          latitude: 1,
          longitude: 1,
          home_team_id: 'team-X',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'soccer' },
          awayTeam: null,
        },
        {
          id: 'g-other',
          title: 'Not mine',
          date: new Date('2026-09-03T00:00:00Z'),
          latitude: 1,
          longitude: 1,
          home_team_id: 'team-Y',
          away_team_id: null,
          events: [],
          homeTeam: { sport: 'soccer' },
          awayTeam: null,
        },
      ]),
    },
    event: { findMany: jest.fn(async () => []) },
    eventDesignatedPoster: { findMany: jest.fn(async () => []) },
    eventPostingUnlock: { findMany: jest.fn(async () => []) },
  } as any;
}

describe('event discovery — following scope', () => {
  it("returns only the viewer's followed/managed teams, unclamped to 5 days", async () => {
    const result = await listEventDiscoveryItems(db('team-X'), {
      scope: 'following',
      viewerId: 'viewer-1',
      now,
    });
    // team-Y game excluded; team-X game 24 days out still present (not 5-day clamped)
    expect(result.items.map((i: any) => i.id)).toEqual(['g-followed']);
  });

  it('returns empty items for a null viewer, without 500', async () => {
    const result = await listEventDiscoveryItems(db('team-X'), {
      scope: 'following',
      viewerId: null,
      now,
    });
    expect(result.items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd server && npm test -- --testPathPattern="event-discovery-following-scope" --no-coverage`
Expected: FAIL — `scope` unsupported; the `team-Y` game leaks and/or the 24-day game is clamped out.

- [ ] **Step 3: Implement in `eventDiscovery.ts`**

1. Add the import and a lookahead constant near the top:

```ts
import { getViewerTeamScope } from './viewerTeamScope.js';

const FOLLOWING_LOOKAHEAD_MS = 365 * 24 * 60 * 60 * 1000;
```

2. Extend the params type:

```ts
export type EventDiscoveryParams = {
  surface?: DiscoverySurface;
  scope?: 'public' | 'following';
  from?: Date | null;
  to?: Date | null;
  limit?: number;
  viewerId?: string | null;
  now?: Date;
};
```

3. At the top of `listEventDiscoveryItems`, branch the window and resolve the team scope for `following`. Replace the current window block:

```ts
const now = params.now ?? new Date();
const surface = params.surface ?? 'all';
const scope = params.scope ?? 'public';

let from: Date;
let to: Date;
if (scope === 'following') {
  from = now;
  to = new Date(now.getTime() + FOLLOWING_LOOKAHEAD_MS); // future-only, effectively unbounded
} else {
  const defaults = defaultWindow(surface, now);
  ({ from, to } = clampWindow(
    surface,
    params.from ?? defaults.from,
    params.to ?? defaults.to,
    now
  ));
}

// For following scope, an empty team set means nothing to show.
const followingTeamIds =
  scope === 'following' ? await getViewerTeamScope(db, params.viewerId) : null;
if (scope === 'following' && (!followingTeamIds || followingTeamIds.size === 0)) {
  return {
    items: [],
    meta: {
      surface,
      from: from.toISOString(),
      to: to.toISOString(),
      limit: Math.max(1, Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT)),
      sources: { games: 0, events: 0 },
      filtered: { private_team_items: 0 },
    },
  };
}
```

4. After computing `visibleGames`/`visibleEvents` (the private-team filter), narrow to the followed set when scope is `following`:

```ts
const inFollowScope = (teamId: string | null | undefined) =>
  !followingTeamIds || (!!teamId && followingTeamIds.has(teamId));

const scopedGames =
  scope === 'following'
    ? visibleGames.filter(
        (g: any) => inFollowScope(g.home_team_id) || inFollowScope(g.away_team_id)
      )
    : visibleGames;
const scopedEvents =
  scope === 'following'
    ? visibleEvents.filter((e: any) => inFollowScope(e.team_id))
    : visibleEvents;
```

Then use `scopedGames`/`scopedEvents` where `visibleGames`/`visibleEvents` currently feed `eventIds`, the `serializeGameCard`/`serializeEventCard` maps, and the meta `sources` counts. (Rename the two `.map` inputs; nothing else changes.)

- [ ] **Step 4: Add the route param in `routes/eventDiscovery.ts`**

After the `surface` parse block, add:

```ts
const scopeRaw = String(req.query.scope ?? 'public')
  .trim()
  .toLowerCase();
if (!['public', 'following'].includes(scopeRaw)) {
  return sendError(res, 400, 'Invalid scope');
}
```

and pass `scope: scopeRaw as 'public' | 'following'` into the `listEventDiscoveryItems` call.

- [ ] **Step 5: Run both suites**

Run: `cd server && npm test -- --testPathPattern="event-discovery-following-scope|event-discovery-contract" --no-coverage`
Expected: new following tests PASS; existing contract tests PASS unchanged (public path byte-identical).

- [ ] **Step 6: Typecheck + commit**

```bash
cd server && npx tsc --noEmit 2>&1 | tail -3; cd ..
git add server/src/lib/eventDiscovery.ts server/src/routes/eventDiscovery.ts server/src/__tests__/event-discovery-following-scope.test.ts
git commit -m "feat(server): /event-discovery following scope (followed+managed, unbounded window)"
```

---

### Task 3: Client card → calendar projection

**Files:**

- Create: `utils/discoverCalendar.ts`
- Test: `utils/__tests__/discoverCalendar.test.ts`

**Interfaces:**

- Consumes: `EventCard` from `@/api/schemas/eventCard`.
- Produces: `splitCalendarCards(cards: EventCard[]): { games: CalendarRow[]; events: CalendarRow[] }` where `CalendarRow` carries `{ id, event_id, game_id, source_type, title, date, location }` — the fields Discover's calendar filters/renders use.

- [ ] **Step 1: Write the failing test**

```ts
import { splitCalendarCards } from '../discoverCalendar';
import type { EventCard } from '@/api/schemas/eventCard';

const cards: EventCard[] = [
  {
    id: 'g1',
    source_type: 'game',
    game_id: 'g1',
    event_id: 'e-linked',
    title: 'Game',
    date: '2026-09-10T00:00:00.000Z',
    location: 'Field',
  },
  {
    id: 'e1',
    source_type: 'event',
    game_id: null,
    event_id: 'e1',
    title: 'Event',
    date: '2026-09-11T00:00:00.000Z',
    location: 'Arena',
  },
];

describe('splitCalendarCards', () => {
  it('splits cards into game and event rows by source_type', () => {
    const { games, events } = splitCalendarCards(cards);
    expect(games.map(r => r.id)).toEqual(['g1']);
    expect(events.map(r => r.id)).toEqual(['e1']);
    expect(games[0]).toMatchObject({
      source_type: 'game',
      game_id: 'g1',
      event_id: 'e-linked',
      title: 'Game',
      date: '2026-09-10T00:00:00.000Z',
      location: 'Field',
    });
  });

  it('tolerates an empty or null input', () => {
    expect(splitCalendarCards([])).toEqual({ games: [], events: [] });
    expect(splitCalendarCards(null as any)).toEqual({ games: [], events: [] });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest utils/__tests__/discoverCalendar.test.ts --no-coverage`
Expected: FAIL — `Cannot find module '../discoverCalendar'`.

- [ ] **Step 3: Implement**

```ts
import type { EventCard } from '@/api/schemas/eventCard';

export interface CalendarRow {
  id: string;
  event_id: string | null;
  game_id: string | null;
  source_type: 'game' | 'event';
  title: string;
  date: string | null;
  location: string | null;
}

function toRow(card: EventCard): CalendarRow {
  return {
    id: String(card.id),
    event_id: card.event_id ?? null,
    game_id: card.game_id ?? null,
    source_type: card.source_type,
    title: card.title || (card.source_type === 'game' ? 'Game' : 'Event'),
    date: card.date ?? null,
    location: card.location ?? null,
  };
}

/** Split discovery cards into the game/event rows Discover's calendar renders. */
export function splitCalendarCards(cards: EventCard[] | null | undefined): {
  games: CalendarRow[];
  events: CalendarRow[];
} {
  if (!Array.isArray(cards)) return { games: [], events: [] };
  const games: CalendarRow[] = [];
  const events: CalendarRow[] = [];
  for (const card of cards) {
    (card.source_type === 'game' ? games : events).push(toRow(card));
  }
  return { games, events };
}
```

- [ ] **Step 4: Run to verify it passes + typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20 && npx jest utils/__tests__/discoverCalendar.test.ts --no-coverage && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: PASS; 0 tsc errors.

- [ ] **Step 5: Commit**

```bash
git add utils/discoverCalendar.ts utils/__tests__/discoverCalendar.test.ts
git commit -m "feat(discover): EventCard -> calendar row projection"
```

---

### Task 4: Migrate Discover's calendar to the scoped endpoint

**Files:**

- Modify: `app/(tabs)/discover/mobile-community.tsx`

**Interfaces:**

- Consumes: `validateEventCards` (`@/api/schemas/eventCard`), `splitCalendarCards` (`@/utils/discoverCalendar`), `httpGet` (`@/api/http`).

This is a delicate edit in a large screen. There is no clean unit test for the screen; the gate is tsc + the existing Discover contract tests staying green + the Task 3 projection test + a manual parity read. Keep the change surgical.

- [ ] **Step 1: Add imports** (top of the file, with the other `@/` imports)

```ts
import { validateEventCards } from '@/api/schemas/eventCard';
import { splitCalendarCards } from '@/utils/discoverCalendar';
```

- [ ] **Step 2: Replace the three calendar-source queries with one scoped query**

Replace the `discover-followed-games`, `discover-followed-events`, and `discover-managed-calendar` `useQuery` blocks (around lines 504–604) with a single query:

```ts
const { data: followingCalendarData } = useQuery({
  queryKey: ['discover-following-calendar', user?.id ?? 'guest'],
  enabled: interactionsDone && !!user,
  queryFn: async () => {
    const res: unknown = await httpGet('/event-discovery?scope=following');
    const cards = validateEventCards('/event-discovery?scope=following', res);
    return splitCalendarCards(cards);
  },
});
const calendarGames = useMemo(() => followingCalendarData?.games ?? [], [followingCalendarData]);
const calendarEvents = useMemo(() => followingCalendarData?.events ?? [], [followingCalendarData]);
```

- [ ] **Step 3: Remove now-dead symbols**

Delete the now-unused `followedGames`, `followedEvents`, `managedCalendarGames`, `managedCalendarEvents` memos and the old `calendarGames`/`calendarEvents` derivations (they are replaced above). If `mergeDiscoverEvents` is now unused, remove its import; if still used elsewhere, leave it. Grep before deleting:

```bash
grep -n "followedGames\|followedEvents\|managedCalendar\|mergeDiscoverEvents\|followedGamesPending\|followedEventsPending" "app/(tabs)/discover/mobile-community.tsx"
```

Resolve each remaining reference (e.g. loading flags folded into the new query's state, or removed).

- [ ] **Step 4: Verify downstream unchanged**

`getSelectedDateGames`/`getSelectedDateEvents` and the day-count strip already read `calendarGames`/`calendarEvents` and the row fields (`id`, `event_id`, `game_id`, `source_type`, `title`, `date`, `location`) — all provided by `CalendarRow`. Confirm no other consumer of the removed memos remains.

- [ ] **Step 5: Typecheck, lint, tests**

```bash
source ~/.nvm/nvm.sh && nvm use 20
npx tsc --noEmit 2>&1 | grep -c "error TS"        # expect 0
npx eslint "app/(tabs)/discover/mobile-community.tsx"  # expect clean
npx jest utils/__tests__/discoverCalendar.test.ts __tests__/discover-map-no-calendar.test.ts __tests__/discover-result-screen-contracts.test.ts --no-coverage
```

Expected: 0 tsc errors; eslint clean; tests pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/discover/mobile-community.tsx"
git commit -m "feat(discover): calendar consumes /event-discovery?scope=following via EventCard"
```

---

## Self-Review

**1. Spec coverage:**

- Team-scope resolver (followed ∪ managed, `/teams/managed` semantics) → Task 1. ✓
- Scope-aware windowing (following = future-only unbounded, not 5-day) + team filter + route → Task 2. ✓
- Card → calendar projection → Task 3. ✓
- Discover migration (3 queries → 1 scoped) → Task 4. ✓
- Pinning: `getViewerTeamScope` test, following-scope server test (incl. unclamped-window + null-viewer + public unchanged), projection test, Discover contracts. ✓
- Error handling (null viewer/empty scope → `[]`) → Task 2 Step 3 + test. ✓
- Non-goals (public path, /games, /events, feed untouched) → default scope path unchanged. ✓

**2. Placeholder scan:** No TBD/TODO; server + projection code is complete. Task 4 is inherently a guided edit of a large existing file (exact source lines shift), so it is expressed as precise find/replace + grep steps rather than a full file paste.

**3. Type consistency:** `getViewerTeamScope`, `scope: 'public' | 'following'`, `splitCalendarCards`, `CalendarRow`, `validateEventCards`, `EventCard` used consistently across tasks. `FOLLOWING_LOOKAHEAD_MS` defined once in Task 2.
