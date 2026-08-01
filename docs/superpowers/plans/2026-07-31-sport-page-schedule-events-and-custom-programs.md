# Sport Page: Schedule Merge, Visibility Fix & Custom-Sport Programs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the sport page's Events tab show every event a coach creates (Games + standalone Events), route game visibility through the canonical rule, and give each custom sport its own program page.

**Architecture:** A single new server helper `teamScheduleFeed` becomes the one source of truth for a team's public schedule (games filtered via `isGamePubliclyVisible` + standalone events, merged and date-sorted). Both `screen-summary` endpoints emit an additive `schedule` array; the client renders game vs. event rows by `kind`. Custom sports get a stable per-name program slug instead of the shared `'other'`.

**Tech Stack:** Express + Prisma + PostgreSQL (server); React Native / Expo Router + react-query (client); Jest (both). Design spec: `docs/superpowers/specs/2026-07-31-sport-page-schedule-events-and-custom-programs-design.md`.

## Global Constraints

- Server tests run ONLY via `cd server && npm test` (wraps jest with `node --experimental-vm-modules`). Single suite: `cd server && npm test -- --testPathPattern="<name>" --no-coverage`. Bare `npx jest` on the full suite fails.
- Every Prisma `findMany` MUST have a `take` limit.
- No DB schema change / no migration in this plan. Uses existing columns only.
- Client text colors use theme constants — never hardcode `#000`/`#111`/etc. (not expected to arise here).
- Client changes are NOT live until an OTA publish to BOTH runtimes (1.0.4 override + 1.0.5). Server changes deploy on merge to `main` (Railway). Do NOT push to `main` without explicit user approval.
- Branch: `fix/sport-page-schedule-events-and-custom-programs` (already created off `main` @ `f2297333`).
- `isGamePubliclyVisible(record)` lives in `server/src/lib/gameApproval.ts` and reads `{ approval_status, opponent_approval_status, date }` — the game query MUST select `opponent_approval_status` (GAME_SUMMARY_SELECT omits it).
- `buildEventDetailRoute(eventId)` (`utils/eventRoutes.ts`) is the ONLY correct way to navigate to an event/game detail — it routes both to `/game/[id]`.

## File Structure

- Create `server/src/lib/teamScheduleFeed.ts` — pure `buildScheduleItems` + DB `getTeamScheduleFeed`.
- Create `server/src/__tests__/team-schedule-feed.test.ts` — unit tests for the pure core.
- Modify `server/src/lib/sportsTaxonomy.ts` — add `customSportSlug`.
- Create `server/src/__tests__/custom-sport-slug.test.ts`.
- Modify `server/src/routes/teams.ts` — program-slug resolution + `schedule` in screen-summary.
- Modify `server/src/routes/programs.ts` — `levels[].schedule`.
- Modify `constants/programs.ts` — `buildProgramSubTeams` emits `schedule`.
- Modify `app/team-page.tsx` — read `schedule`, render by `kind`.
- Create `server/scripts/split-other-sport-programs.ts` — optional dry-run backfill.

---

## Task 1: `customSportSlug` helper (Part D core)

**Files:**

- Modify: `server/src/lib/sportsTaxonomy.ts` (add export near `normalizeSportToSlug`, line ~82)
- Test: `server/src/__tests__/custom-sport-slug.test.ts` (create)

**Interfaces:**

- Produces: `customSportSlug(name: string | null | undefined): string` — a stable `custom:<slug>` for a non-blank name, else `'other'`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/custom-sport-slug.test.ts
import { customSportSlug } from '../lib/sportsTaxonomy.js';

describe('customSportSlug', () => {
  it('gives different custom sports different slugs', () => {
    expect(customSportSlug('Rowing')).toBe('custom:rowing');
    expect(customSportSlug('Fencing')).toBe('custom:fencing');
    expect(customSportSlug('Rowing')).not.toBe(customSportSlug('Fencing'));
  });
  it('normalizes case, whitespace, and punctuation stably', () => {
    expect(customSportSlug('  Rock Climbing  ')).toBe('custom:rock-climbing');
    expect(customSportSlug('rock climbing')).toBe('custom:rock-climbing');
  });
  it('falls back to "other" for blank/nullish names', () => {
    expect(customSportSlug('')).toBe('other');
    expect(customSportSlug('   ')).toBe('other');
    expect(customSportSlug(null)).toBe('other');
    expect(customSportSlug(undefined)).toBe('other');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="custom-sport-slug" --no-coverage`
Expected: FAIL — `customSportSlug is not a function` / import error.

- [ ] **Step 3: Implement the helper**

Add to `server/src/lib/sportsTaxonomy.ts` (after `normalizeSportToSlug`):

```ts
/**
 * Stable program slug for a non-canonical ("Other") sport, keyed on the name so
 * two different custom sports in one org do NOT collapse into a single 'other'
 * program (unique constraint is (organization_id, sport)). The `custom:` prefix
 * guarantees no collision with a future canonical slug of the same word. A
 * blank name has nothing to key on, so it falls back to the shared 'other'.
 */
export function customSportSlug(name: string | null | undefined): string {
  const slug = (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `custom:${slug}` : 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="custom-sport-slug" --no-coverage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/sportsTaxonomy.ts server/src/__tests__/custom-sport-slug.test.ts
git commit -m "feat(programs): customSportSlug — stable per-name slug for custom sports"
```

---

## Task 2: Wire custom slug into team creation (Part D)

**Files:**

- Modify: `server/src/routes/teams.ts` (create transaction, ~line 1886–1896)
- Test: manual audit + typecheck (the pure logic is covered by Task 1; a DB-backed create test needs the full auth+DB harness and runs in CI)

**Interfaces:**

- Consumes: `customSportSlug` (Task 1), existing `normalizeSportToSlug`.

- [ ] **Step 1: Audit every program-slug fallback site**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && grep -rn "?? 'other'" server/src && grep -rn "normalizeSportToSlug" server/src/routes`
Expected: the primary site is `server/src/routes/teams.ts` create transaction. Note any others (e.g. a team-move/PUT path) to update identically in Step 2.

- [ ] **Step 2: Replace the constant fallback + set the display name**

In `server/src/routes/teams.ts`, import `customSportSlug` alongside `normalizeSportToSlug`, then change the resolver block (currently):

```ts
const sportSlug = normalizeSportToSlug(data.sport) ?? 'other';
const program = await tx.sportProgram.upsert({
  where: {
    organization_id_sport: { organization_id: organizationId, sport: sportSlug },
  },
  create: { organization_id: organizationId, sport: sportSlug },
  update: {},
  select: { id: true },
});
```

to:

```ts
const canonicalSlug = normalizeSportToSlug(data.sport);
const sportSlug = canonicalSlug ?? customSportSlug(data.sport);
// Custom (non-canonical) sports carry a display name so the program
// label reads "Rowing", not "custom:rowing". Canonical sports keep the
// taxonomy label and set no name (avoids churn on existing programs).
const programName = !canonicalSlug && data.sport?.trim() ? data.sport.trim() : null;
const program = await tx.sportProgram.upsert({
  where: {
    organization_id_sport: { organization_id: organizationId, sport: sportSlug },
  },
  create: {
    organization_id: organizationId,
    sport: sportSlug,
    ...(programName ? { name: programName } : {}),
  },
  update: {},
  select: { id: true },
});
```

Apply the same `normalizeSportToSlug(...) ?? customSportSlug(...)` change to any other site found in Step 1.

- [ ] **Step 3: Confirm `formatProgramLabel` prefers `SportProgram.name`**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && sed -n '42,66p' constants/programs.ts`
Expected: `formatProgramLabel` uses `name` when present. If it does NOT prefer `name`, adjust it to fall back to `name` before the slug. (Verify — do not assume.)

- [ ] **Step 4: Typecheck**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/teams.ts constants/programs.ts
git commit -m "fix(programs): distinct program per custom sport (no more 'other' collision)"
```

---

## Task 3: `teamScheduleFeed` helper (Part A — fixes #1 + #3)

**Files:**

- Create: `server/src/lib/teamScheduleFeed.ts`
- Test: `server/src/__tests__/team-schedule-feed.test.ts` (create)

**Interfaces:**

- Consumes: `GAME_SUMMARY_SELECT` (`server/src/lib/serializeGame.ts`), `isGamePubliclyVisible` (`server/src/lib/gameApproval.ts`), `prisma` (`server/src/lib/prisma.js`).
- Produces:
  - `type ScheduleItem` — discriminated `{ kind: 'game' | 'event', ... }`.
  - `buildScheduleItems(games: any[], events: any[]): ScheduleItem[]` — pure filter+merge+sort.
  - `getTeamScheduleFeed(teamIds: string[], viewerId: string | null, opts?: { limit?: number }): Promise<ScheduleItem[]>`.

- [ ] **Step 1: Write the failing test (pure core)**

```ts
// server/src/__tests__/team-schedule-feed.test.ts
import { buildScheduleItems } from '../lib/teamScheduleFeed.js';

const PAST = new Date(Date.now() - 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

describe('buildScheduleItems', () => {
  it('includes an approved game with a consenting opponent', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g1',
          date: FUTURE,
          approval_status: 'approved',
          opponent_approval_status: 'approved',
        },
      ],
      []
    );
    expect(items.map(i => i.id)).toEqual(['g1']);
    expect(items[0].kind).toBe('game');
  });

  it('hides an UPCOMING game whose opponent has not consented', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g2',
          date: FUTURE,
          approval_status: 'approved',
          opponent_approval_status: 'pending',
        },
      ],
      []
    );
    expect(items).toEqual([]);
  });

  it('shows a PAST game even if the opponent never consented (canonical rule / #3)', () => {
    const items = buildScheduleItems(
      [{ id: 'g3', date: PAST, approval_status: 'approved', opponent_approval_status: 'declined' }],
      []
    );
    expect(items.map(i => i.id)).toEqual(['g3']);
  });

  it('includes a standalone event and tags it kind:event (#1)', () => {
    const items = buildScheduleItems(
      [],
      [{ id: 'e1', title: 'Practice', date: FUTURE, event_type: 'practice' }]
    );
    expect(items[0]).toMatchObject({ kind: 'event', id: 'e1', title: 'Practice' });
  });

  it('sorts games and events together by date, most recent first', () => {
    const items = buildScheduleItems(
      [
        {
          id: 'g',
          date: PAST,
          approval_status: 'approved',
          opponent_approval_status: 'not_required',
        },
      ],
      [{ id: 'e', title: 'x', date: FUTURE, event_type: 'bbq' }]
    );
    expect(items.map(i => i.id)).toEqual(['e', 'g']); // future before past
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="team-schedule-feed" --no-coverage`
Expected: FAIL — module `team-schedule-feed` not found.

- [ ] **Step 3: Implement the helper**

```ts
// server/src/lib/teamScheduleFeed.ts
import { prisma } from './prisma.js';
import { GAME_SUMMARY_SELECT } from './serializeGame.js';
import { isGamePubliclyVisible } from './gameApproval.js';

export type ScheduleItem =
  | {
      kind: 'game';
      id: string;
      title: string | null;
      date: string;
      location: string | null;
      home_team: string | null;
      away_team: string | null;
      home_team_id: string | null;
      away_team_id: string | null;
      event_type: string | null;
    }
  | {
      kind: 'event';
      id: string;
      title: string;
      date: string;
      location: string | null;
      event_type: string | null;
      banner_url: string | null;
    };

const toIso = (d: Date | string): string => (d instanceof Date ? d.toISOString() : String(d));

/**
 * Pure: filter games through the canonical public-visibility rule, tag events,
 * merge, and sort date-desc. The ONE place a team's public schedule is decided.
 * Events passed in are assumed already query-filtered (approved, not cancelled,
 * standalone game_id=null) — see getTeamScheduleFeed.
 */
export function buildScheduleItems(games: any[], events: any[]): ScheduleItem[] {
  const gameItems: ScheduleItem[] = games
    .filter(g => isGamePubliclyVisible(g))
    .map(g => ({
      kind: 'game',
      id: String(g.id),
      title: g.title ?? null,
      date: toIso(g.date),
      location: g.location ?? null,
      home_team: g.home_team ?? null,
      away_team: g.away_team ?? null,
      home_team_id: g.home_team_id ?? null,
      away_team_id: g.away_team_id ?? null,
      event_type: g.event_type ?? null,
    }));
  const eventItems: ScheduleItem[] = events.map(e => ({
    kind: 'event',
    id: String(e.id),
    title: e.title,
    date: toIso(e.date),
    location: e.location ?? null,
    event_type: e.event_type ?? null,
    banner_url: e.banner_url ?? null,
  }));
  return [...gameItems, ...eventItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * The team's public schedule: approved+visible games (home OR away) merged with
 * standalone approved, non-cancelled events (game_id=null so a game-type event
 * isn't double-listed). `viewerId` is reserved for future viewer-aware rules;
 * today this is the public projection, matching the screen-summaries it feeds.
 */
export async function getTeamScheduleFeed(
  teamIds: string[],
  _viewerId: string | null,
  opts: { limit?: number } = {}
): Promise<ScheduleItem[]> {
  if (teamIds.length === 0) return [];
  const limit = opts.limit ?? 20;
  const [games, events] = await Promise.all([
    prisma.game.findMany({
      where: { OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }] },
      orderBy: { date: 'desc' },
      take: 100,
      select: { ...GAME_SUMMARY_SELECT, opponent_approval_status: true },
    }),
    prisma.event.findMany({
      where: {
        team_id: { in: teamIds },
        game_id: null,
        approval_status: 'approved',
        status: { not: 'cancelled' },
      },
      orderBy: { date: 'desc' },
      take: 100,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        event_type: true,
        banner_url: true,
      },
    }),
  ]);
  return buildScheduleItems(games, events).slice(0, limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="team-schedule-feed" --no-coverage`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/teamScheduleFeed.ts server/src/__tests__/team-schedule-feed.test.ts
git commit -m "feat(schedule): teamScheduleFeed — merge games+events via canonical visibility"
```

---

## Task 4: Emit `schedule` from the team screen-summary (Part B)

**Files:**

- Modify: `server/src/routes/teams.ts` (`GET /:id/screen-summary`, ~line 965–1034)

**Interfaces:**

- Consumes: `getTeamScheduleFeed` (Task 3).

- [ ] **Step 1: Import and call the helper**

In `server/src/routes/teams.ts`, add `import { getTeamScheduleFeed } from '../lib/teamScheduleFeed.js';`. Inside the `/:id/screen-summary` handler, after the existing `approvedGames` fetch, add:

```ts
const schedule = await getTeamScheduleFeed([teamId], viewerId);
```

- [ ] **Step 2: Add `schedule` to the response**

In the `res.json({ ... })` for this handler, add `schedule,` alongside the existing `games:` key (leave `games` and `counts` unchanged):

```ts
      games: approvedGames.map(game => ({
        ...game,
        date: game.date instanceof Date ? game.date.toISOString() : String(game.date),
      })),
      schedule,
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/teams.ts
git commit -m "feat(teams): screen-summary emits merged schedule[] (games+events)"
```

---

## Task 5: Emit `levels[].schedule` from the program screen-summary (Part B)

**Files:**

- Modify: `server/src/routes/programs.ts` (`GET /:id/screen-summary`, ~line 102–121)

**Interfaces:**

- Consumes: `getTeamScheduleFeed` (Task 3).

- [ ] **Step 1: Import the helper**

Add to `server/src/routes/programs.ts`: `import { getTeamScheduleFeed } from '../lib/teamScheduleFeed.js';`

- [ ] **Step 2: Attach per-team schedule in the `levels` build**

Change the `levels` construction (currently a synchronous `.map`) to await a per-team schedule. Replace:

```ts
const levels = [...visibleTeams]
  .sort((a, b) => levelRank(a.level) - levelRank(b.level))
  .map(team => ({
    level: team.level ?? null,
    team: serializeTeam(team, { includeCounts: true }),
    games: (gamesByTeam.get(team.id) ?? []).map(g => ({
      ...g,
      date: g.date instanceof Date ? g.date.toISOString() : String(g.date),
    })),
  }));
```

with:

```ts
const levels = await Promise.all(
  [...visibleTeams]
    .sort((a, b) => levelRank(a.level) - levelRank(b.level))
    .map(async team => ({
      level: team.level ?? null,
      team: serializeTeam(team, { includeCounts: true }),
      games: (gamesByTeam.get(team.id) ?? []).map(g => ({
        ...g,
        date: g.date instanceof Date ? g.date.toISOString() : String(g.date),
      })),
      schedule: await getTeamScheduleFeed([team.id], viewerId),
    }))
);
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 4: Run the existing program API suite to confirm no regression**

Run: `cd server && npm test -- --testPathPattern="programs|api-posts" --no-coverage 2>&1 | tail -15`
Expected: PASS (existing suites still green; `schedule` is additive).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/programs.ts
git commit -m "feat(programs): screen-summary levels carry merged schedule[]"
```

---

## Task 6: `buildProgramSubTeams` surfaces `schedule` (Part C — pure)

**Files:**

- Modify: `constants/programs.ts` (`ProgramSubTeam` type + `buildProgramSubTeams`, ~line 122)
- Test: `__tests__/program-labels.test.ts` (add a case; this file already pins program helpers)

**Interfaces:**

- Consumes: server `levels[].schedule` (Task 5).
- Produces: `ProgramSubTeam.schedule: any[]` — the merged, kind-tagged items for that sub-team.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/program-labels.test.ts`:

```ts
import { buildProgramSubTeams } from '@/constants/programs';

describe('buildProgramSubTeams schedule passthrough', () => {
  it('carries the server schedule array for each sub-team', () => {
    const subs = buildProgramSubTeams([
      {
        level: 'varsity',
        team: { id: 't1', gender: 'boys' },
        games: [],
        schedule: [
          { kind: 'event', id: 'e1', title: 'Practice', date: '2026-08-01T00:00:00.000Z' },
        ],
      },
    ] as any);
    expect(subs[0].schedule).toEqual([
      { kind: 'event', id: 'e1', title: 'Practice', date: '2026-08-01T00:00:00.000Z' },
    ]);
  });

  it('falls back to games when schedule is absent (old server response)', () => {
    const subs = buildProgramSubTeams([
      {
        level: 'jv',
        team: { id: 't2', gender: 'boys' },
        games: [{ id: 'g1', date: '2026-08-01' }],
      },
    ] as any);
    expect(subs[0].schedule.map((s: any) => s.id)).toEqual(['g1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx jest __tests__/program-labels.test.ts -t "schedule" 2>&1 | tail -15`
Expected: FAIL — `schedule` is undefined on the result.

- [ ] **Step 3: Add `schedule` to the type and the builder**

In `constants/programs.ts`, add `schedule: any[]` to the `ProgramSubTeam` type, add an optional `schedule?: any[]` to `ProgramLevelInput`, and in `buildProgramSubTeams`'s `.map(e => ({ ... }))` add:

```ts
      schedule: Array.isArray((e as any).schedule)
        ? (e as any).schedule
        : sortGamesAscending(Array.isArray(e.games) ? e.games : []),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx jest __tests__/program-labels.test.ts 2>&1 | tail -10`
Expected: PASS (whole file, including new cases).

- [ ] **Step 5: Commit**

```bash
git add constants/programs.ts __tests__/program-labels.test.ts
git commit -m "feat(programs): buildProgramSubTeams surfaces merged schedule (games fallback)"
```

---

## Task 7: team-page renders the merged schedule by `kind` (Part C — client)

**Files:**

- Modify: `app/team-page.tsx` (`fetchTeamData`, the `eventsGames` derivation, and the Events `FlatList` `renderItem`)

**Interfaces:**

- Consumes: `summary.schedule` / `activeSubTeam.schedule`, `buildEventDetailRoute` (`utils/eventRoutes.ts`).

- [ ] **Step 1: Import the event route helper**

Add to `app/team-page.tsx` imports: `import { buildEventDetailRoute } from '@/utils/eventRoutes';`

- [ ] **Step 2: Read `schedule` in `fetchTeamData`**

In `fetchTeamData`, where it reads `summary.games`, also capture schedule and prefer it. Change the summary branch so the returned `games` is `summary.schedule ?? summary.games` (kept under the existing `games` field to avoid a wider refactor); each item may be a game OR a `{ kind: 'event' }`:

```ts
const summarySchedule = Array.isArray(summary.schedule)
  ? (summary.schedule as GameItem[])
  : Array.isArray(summary.games)
    ? (summary.games as GameItem[])
    : [];
```

and assign `summaryGames = summarySchedule;` (the variable already flows into the returned `games`).

- [ ] **Step 3: Prefer `schedule` for the program sub-team path**

Where `eventsGames` is derived (`const eventsGames = isProgramTeam && activeSubTeam ? activeSubTeam.games : games;`), change `activeSubTeam.games` to `activeSubTeam.schedule` (Task 6 guarantees it is populated with a games fallback):

```ts
const eventsGames = isProgramTeam && activeSubTeam ? activeSubTeam.schedule : games;
```

- [ ] **Step 4: Branch the Events `renderItem` on `kind`**

In the Events `FlatList` `renderItem`, at the top add an event-row short-circuit before the existing game-row logic:

```ts
          const g = item as any;
          if (g.kind === 'event') {
            const rawDate = g.date;
            const dateStr = rawDate
              ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'TBD';
            const label = g.event_type
              ? String(g.event_type).replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
              : 'Event';
            return (
              <Pressable
                onPress={() => router.push(buildEventDetailRoute(String(g.id)))}
                accessibilityRole="button"
                accessibilityLabel={`Open event ${g.title} on ${dateStr}`}
                style={({ pressed }) => [
                  styles.eventRow,
                  { backgroundColor: theme.card, borderColor: theme.border },
                  pressed ? { opacity: 0.6 } : null,
                ]}
              >
                <View style={[styles.eventDateBadge, { backgroundColor: theme.tint + '22' }]}>
                  <Text style={[styles.eventDate, { color: theme.tint }]}>{dateStr}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={[styles.eventTypeText, { color: theme.mutedText }]}>{label}</Text>
                </View>
              </Pressable>
            );
          }
          // ...existing game-row logic continues unchanged...
```

Also update the list's `sort` comparator (it already sorts by `scheduled_date || date` desc) — event items have `date`, so no change is needed, but confirm the comparator reads `(a as any).date` for items lacking `scheduled_date`.

- [ ] **Step 5: Typecheck the client**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add app/team-page.tsx
git commit -m "feat(team-page): Events tab renders games + standalone events by kind"
```

---

## Task 8: (Optional, owner-run) backfill to split existing `'other'` programs (Part E)

**Files:**

- Create: `server/scripts/split-other-sport-programs.ts` (dry-run by default; mirrors `server/scripts/backfill-sport-programs.ts`)

**Interfaces:**

- Consumes: `customSportSlug` (Task 1), `programFollowFanout.ts` semantics (read before any live run).

- [ ] **Step 1: Read the existing backfill script for the established pattern**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && sed -n '1,60p' server/scripts/backfill-sport-programs.ts`
Expected: understand its dry-run flag, logging, and how it reassigns `program_id`.

- [ ] **Step 2: Write the split script (dry-run default)**

Create `server/scripts/split-other-sport-programs.ts` that: finds every `SportProgram` with `sport = 'other'`; groups its active teams by `customSportSlug(team.sport)`; for each group beyond the first, upserts a `(organization_id, <customSlug>)` program (set `name` = the team's display sport) and reassigns those teams' `program_id`; logs every intended change; only writes when invoked with `--commit`. Because `program_id` reassignment interacts with `ProgramFollow`/`TeamFollow` fan-out, print a warning to review `programFollowFanout.ts` and re-run follow reconciliation after a live run.

- [ ] **Step 3: Dry-run against local/staging (no writes)**

Run: `cd server && npx tsx scripts/split-other-sport-programs.ts`
Expected: prints planned splits (or "no 'other' programs with >1 custom sport") and exits without writing.

- [ ] **Step 4: Commit the script (do NOT run --commit against prod without owner sign-off)**

```bash
git add server/scripts/split-other-sport-programs.ts
git commit -m "chore(programs): dry-run backfill to split legacy 'other' sport programs"
```

---

## Task 9: Final verification & rollout

**Files:** none (verification only)

- [ ] **Step 1: Full server regression battery**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npm run test:regressions 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 2: Both typechecks**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx tsc --noEmit 2>&1 | tail -3 && npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -3`
Expected: no errors.

- [ ] **Step 3: Client consolidation tests still green**

Run: `cd /Users/varsityhub/Code/VarsityHubMobile && npx jest app/__tests__/team-page-redirect.test.tsx app/__tests__/program-page.smoke.test.tsx __tests__/navigation-history-contracts.test.ts 2>&1 | tail -15`
Expected: PASS.

- [ ] **Step 4: Open a PR (server auto-deploys on merge; do NOT push to main directly)**

```bash
git push -u origin fix/sport-page-schedule-events-and-custom-programs
```

Then open a PR. In the description, call out the **intended visibility change** (#3): past games vs. an unconfirmed opponent now appear on the sport page (canonical `isGamePubliclyVisible` behavior).

- [ ] **Step 5: After merge — OTA both runtimes (client changes are not live until this)**

Publish `eas update --branch production` for 1.0.5 (auto) AND dispatch the 1.0.4 override workflow. Remind the user; users need two cold starts. See `docs/release` / the OTA memory notes. Provide the exact commands for the user to run — do NOT run `eas build`.

- [ ] **Step 6: (Optional) run the #2 backfill**

Only if Step 3 of Task 8's dry-run showed collisions: review with the owner, then run with `--commit` and reconcile follows.

---

## Self-Review

- **Spec coverage:** #1 → Tasks 3,4,5,6,7. #3 → Task 3 (`isGamePubliclyVisible` in `buildScheduleItems`), wired in 4,5. #2 → Tasks 1,2 (+8 backfill). #4 → intentionally no task (known-accepted). Client rendering → 6,7. Rollout/OTA → 9. All spec sections covered.
- **Placeholder scan:** every code step has concrete code; the only "verify" steps (Task 2 Step 3 `formatProgramLabel`; Task 8 script body) are explicit audit/authoring instructions with exact commands, not deferred logic.
- **Type consistency:** `ScheduleItem`/`buildScheduleItems`/`getTeamScheduleFeed` names match across Tasks 3→4→5; `schedule` field name consistent across server (4,5), `buildProgramSubTeams` (6), and team-page (7); `customSportSlug` signature identical in Tasks 1→2→8.
