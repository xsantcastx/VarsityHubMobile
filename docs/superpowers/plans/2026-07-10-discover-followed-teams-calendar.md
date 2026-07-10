# Discover Followed-Teams Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope the Discover calendar dots and its tap-a-date list to upcoming games of teams the signed-in user follows, leaving the map, "near you" list, zip chips, and search on the existing global feed.

**Architecture:** Add a `following=true` query param to the existing `GET /games` handler that constrains results to the viewer's `TeamFollow` teams (home OR away). The Discover screen gains a second react-query (`discover-followed-games`, ascending from today, limit 100) that feeds only the calendar `markedDates` memo and the selected-date list; every other consumer keeps the global `games` array.

**Tech Stack:** Express + Prisma (server), React Native + Expo Router + react-query (client), Jest + supertest (server tests).

## Global Constraints

- Every Prisma `findMany` MUST carry a `take` limit (`teamFollow.findMany` uses `take: 500` with an `// audit-allow` note).
- Screens never call `fetch` directly — data goes through `api/*` (`Game.list`).
- Text colors MUST use theme constants (`Colors[colorScheme].*`) — never hardcode dark hex.
- Return values that mean "empty" use `res.json([])` (200), never an error envelope.
- Program follows already write `TeamFollow` rows (Phase 3); org follows are intentionally excluded from calendar scope.
- Client changes are NOT live until `eas update --branch production`; server changes deploy on push to `main` via Railway.

---

### Task 1: Server — `following=true` scope on `GET /games`

**Files:**

- Modify: `server/src/routes/games.ts` (list handler `gamesRouter.get('/')`, ~lines 932–1101)
- Test: `server/src/__tests__/games-list-visibility.test.ts`

**Interfaces:**

- Consumes: existing `whereClause`, `authedReq`, `wantsNonApproved`, `shouldUseGamesCache` locals in the handler.
- Produces: `GET /games?following=true` — approved games where a followed team is home or away; `[]` for guests or zero-follow users.

- [ ] **Step 1: Add the `teamFollow` mock and a guest app to the test file**

In `server/src/__tests__/games-list-visibility.test.ts`, add a mock fn near the other mocks (after line 20):

```ts
const mockTeamFollowFindMany = jest.fn(async () => [] as Array<{ team_id: string }>);
```

Add `teamFollow` to the `prisma` mock object (inside the `jest.unstable_mockModule('../lib/prisma.js', ...)` block, alongside `team`):

```ts
    teamFollow: {
      findMany: mockTeamFollowFindMany,
    },
```

After the existing `app` is defined (after line 115), add a second app with no auth middleware:

```ts
const guestApp = express();
guestApp.use(express.json());
guestApp.use('/games', gamesRouter);
```

- [ ] **Step 2: Write the failing tests**

Append this describe block to the end of `server/src/__tests__/games-list-visibility.test.ts`:

```ts
describe('GET /games?following=true (followed-teams calendar)', () => {
  beforeEach(() => {
    mockGameFindMany.mockClear();
    mockTeamFollowFindMany.mockReset();
    mockTeamFollowFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockReset();
    mockUserFindUnique.mockResolvedValue({ email: 'coach@example.com' });
  });

  it('scopes approved games to the viewer followed teams (home OR away)', async () => {
    mockTeamFollowFindMany.mockResolvedValue([{ team_id: TEAM_ID }]);
    await request(app).get('/games?following=true').expect(200);

    const where = lastFindManyWhere();
    expect(where.approval_status).toBe('approved');
    expect(where.AND).toEqual([
      { OR: [{ home_team_id: { in: [TEAM_ID] } }, { away_team_id: { in: [TEAM_ID] } }] },
    ]);
  });

  it('returns [] without querying games when the viewer follows nothing', async () => {
    mockTeamFollowFindMany.mockResolvedValue([]);
    const res = await request(app).get('/games?following=true').expect(200);

    expect(res.body).toEqual([]);
    expect(mockGameFindMany).not.toHaveBeenCalled();
  });

  it('returns [] for signed-out users without touching the DB', async () => {
    const res = await request(guestApp).get('/games?following=true').expect(200);

    expect(res.body).toEqual([]);
    expect(mockTeamFollowFindMany).not.toHaveBeenCalled();
    expect(mockGameFindMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd server && npm test -- --testPathPattern="games-list-visibility" --no-coverage 2>&1 | tail -20`
Expected: the three new tests FAIL (no `following` handling yet — the scoped test sees no `AND`, the empty/guest tests see `mockGameFindMany` called).

- [ ] **Step 4: Parse `following` and exclude it from cache**

In `server/src/routes/games.ts`, find (~line 935):

```ts
const showPending = req.query.show_pending === 'true';
```

Add immediately after it:

```ts
const following = req.query.following === 'true';
```

Then find (~line 941):

```ts
const shouldUseGamesCache = !wantsNonApproved;
```

Replace with:

```ts
const shouldUseGamesCache = !wantsNonApproved && !following;
```

- [ ] **Step 5: Short-circuit guests before the cache block**

In `server/src/routes/games.ts`, find the cache block (~line 946):

```ts
if (shouldUseGamesCache) {
  const cachedGames = await cacheGet(gameCacheKey);
  if (cachedGames) return res.json(cachedGames);
}
```

Insert directly ABOVE it:

```ts
// Followed-teams calendar scope (Discover): signed-out users have no
// follows, so return an empty list rather than the global feed.
if (following && !authedReq.user?.id) {
  return res.json([]);
}
```

- [ ] **Step 6: Add the followed-team constraint after the team_id filter**

In `server/src/routes/games.ts`, find the end of the `team_id` filter block (~line 1088):

```ts
if (teamIdFilter) {
  if (!whereClause.AND) whereClause.AND = [];
  whereClause.AND.push({
    OR: [{ home_team_id: teamIdFilter }, { away_team_id: teamIdFilter }],
  });
}
```

Insert directly AFTER that closing brace:

```ts
// Discover calendar: scope to the viewer's followed teams (home OR away).
// Guests were already short-circuited above; an authed user with zero
// follows gets an empty list without hitting the games table.
if (following && authedReq.user?.id) {
  // audit-allow unbounded: calendar scope needs every team the viewer follows
  const followedRows = await prisma.teamFollow.findMany({
    where: { user_id: authedReq.user.id },
    select: { team_id: true },
    take: 500,
  });
  const followedTeamIds = followedRows.map(r => r.team_id);
  if (followedTeamIds.length === 0) {
    return res.json([]);
  }
  if (!whereClause.AND) whereClause.AND = [];
  whereClause.AND.push({
    OR: [{ home_team_id: { in: followedTeamIds } }, { away_team_id: { in: followedTeamIds } }],
  });
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd server && npm test -- --testPathPattern="games-list-visibility" --no-coverage 2>&1 | tail -20`
Expected: all tests PASS (the four original + three new).

- [ ] **Step 8: Typecheck the server**

Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
Expected: 0 new errors.

- [ ] **Step 9: Commit**

```bash
git add server/src/routes/games.ts server/src/__tests__/games-list-visibility.test.ts
git commit -m "feat(games): following=true scopes GET /games to viewer's followed teams"
```

---

### Task 2: Client API — `following` option on `Game.list`

**Files:**

- Modify: `api/entities.ts` (`Game.list`, ~lines 227–263)

**Interfaces:**

- Consumes: existing `Game.list(sort?, options?)` signature.
- Produces: `Game.list('date', { following: true, dateFrom, limit })` appends `following=true` to the query string.

- [ ] **Step 1: Add `following` to the options type**

In `api/entities.ts`, find the `Game.list` options type (~line 240):

```ts
      mapView?: boolean; // v1.0.2: restricts server-side to games this week only
    }
```

Change to:

```ts
      mapView?: boolean; // v1.0.2: restricts server-side to games this week only
      following?: boolean; // Discover calendar: scope to viewer's followed teams
    }
```

- [ ] **Step 2: Append the query param**

In `api/entities.ts`, find (~line 260):

```ts
if (options?.mapView) params.push('map_view=true');
```

Add directly after it:

```ts
if (options?.following) params.push('following=true');
```

- [ ] **Step 3: Typecheck the client**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: 0 new errors.

- [ ] **Step 4: Commit**

```bash
git add api/entities.ts
git commit -m "feat(api): add following option to Game.list"
```

---

### Task 3: Client — followed-games query, calendar re-point, empty state, live invalidation

**Files:**

- Modify: `app/(tabs)/discover/mobile-community.tsx` (query ~line 405, calendar ~line 1705, selected-date list ~line 1771, team-follow toggle ~line 1391)

**Interfaces:**

- Consumes: `Game.list` `following` option (Task 2); existing `useQuery`, `queryClient` (line 355), `interactionsDone` (line 349), `GameItem` type, `styles.helper`.
- Produces: `followedGames: GameItem[]` local backing the calendar dots and the selected-date list.

- [ ] **Step 1: Add the followed-games query**

In `app/(tabs)/discover/mobile-community.tsx`, find the end of the `error` derivation (~line 417, the closing `})();` of the `const error = (() => { ... })();` block). Insert AFTER it:

```ts
const {
  data: followedGamesData,
  isPending: followedGamesPending,
  refetch: refetchFollowedGames,
} = useQuery({
  queryKey: ['discover-followed-games', user?.id ?? 'guest'],
  enabled: interactionsDone,
  queryFn: async (): Promise<GameItem[]> => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const raw = await Game.list('date', {
      following: true,
      dateFrom: startOfToday.toISOString(),
      limit: 100,
    });
    const list = Array.isArray(raw) ? raw : raw?.games || raw?.items || [];
    // Upcoming only — drop anything already past (parity with calendar dots)
    const now = new Date();
    return list.filter((g: any) => {
      if (!g.date) return false;
      const d = new Date(g.date);
      return !isNaN(d.getTime()) && d >= now;
    });
  },
});
const followedGames = followedGamesData ?? [];
```

- [ ] **Step 2: Re-point the calendar `markedDates` to `followedGames`**

In `app/(tabs)/discover/mobile-community.tsx`, find (~line 1709):

```ts
            games.forEach(game => {
```

Change to:

```ts
            followedGames.forEach(game => {
```

Then find the memo dependency array (~line 1730):

```ts
          }, [games, selectedDate, colorScheme])}
```

Change to:

```ts
          }, [followedGames, selectedDate, colorScheme])}
```

- [ ] **Step 3: Re-point the selected-date list to `followedGames`**

In `app/(tabs)/discover/mobile-community.tsx`, find (~line 1771):

```ts
          const gamesOnDate = games.filter(g => {
```

Change to:

```ts
          const gamesOnDate = followedGames.filter(g => {
```

- [ ] **Step 4: Add the empty-state helper under the calendar**

In `app/(tabs)/discover/mobile-community.tsx`, find the calendar container's closing tag and the selected-date comment (~lines 1766–1768):

```tsx
        />
      </View>

      {/* Games on Selected Date */}
```

Change to:

```tsx
        />
      </View>

      {followedGames.length === 0 && !followedGamesPending ? (
        <Text style={[styles.helper, { color: Colors[colorScheme].mutedText }]}>
          You&apos;re not following any teams yet — search above to find and follow teams, and
          their games show up here.
        </Text>
      ) : null}

      {/* Games on Selected Date */}
```

- [ ] **Step 5: Invalidate the followed-games query on team follow/unfollow**

In `app/(tabs)/discover/mobile-community.tsx`, find the team-follow toggle (~lines 1389–1391):

```ts
                      try {
                        if (next) await Team.follow(t.id);
                        else await Team.unfollow(t.id);
                      } catch {
```

Change to:

```ts
                      try {
                        if (next) await Team.follow(t.id);
                        else await Team.unfollow(t.id);
                        queryClient.invalidateQueries({
                          queryKey: ['discover-followed-games', user?.id ?? 'guest'],
                        });
                      } catch {
```

- [ ] **Step 6: Typecheck the client**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: 0 new errors. (`refetchFollowedGames` is intentionally unused for now; if the linter flags it, drop it from the destructure.)

- [ ] **Step 7: Lint the touched file**

Run: `npm run lint 2>&1 | tail -15`
Expected: 0 errors on `app/(tabs)/discover/mobile-community.tsx`.

- [ ] **Step 8: Verify end-to-end in the running app**

Start the dev client if not already running (`npm run dev`), open Discover, and confirm against a signed-in account that follows at least one team with an upcoming game:

- The calendar shows a dot on that game's date; tapping the date lists the game under "Events on …".
- The map and "Upcoming games near you" list still show global/nearby games (unchanged).
- Follow a new team from the search bar → its upcoming game's dot appears without restarting the app (invalidation).
- Unfollow → the dot disappears.
- On an account that follows nothing (or signed out), the calendar shows no dots and the empty-state helper renders.

Capture a screenshot of the calendar with a followed-team dot as proof.

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/discover/mobile-community.tsx"
git commit -m "feat(discover): calendar shows only followed teams' upcoming games"
```

---

## Post-implementation

- Push the branch and open a PR (server change auto-deploys to Railway on merge to `main`).
- **Remind the user:** the client half is not live until `eas update --branch production` is run against the production channel.
