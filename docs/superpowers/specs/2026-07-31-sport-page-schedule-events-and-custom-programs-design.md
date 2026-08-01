# Sport page: merge events into the schedule, fix visibility drift, split custom-sport programs

- **Date:** 2026-07-31
- **Status:** Design approved; implementation pending
- **Branch:** `fix/sport-page-schedule-events-and-custom-programs` (off `main` @ `f2297333`)
- **Ships:** server (push to `main` → Railway auto-deploy) + client (OTA to both runtimes 1.0.4 and 1.0.5). No DB migration.

## Context

Investigation of the consolidated one-sport-page (team-page is the sole sport page; sub-team
picker in the Events tab) surfaced four gaps in the coach/organizer experience. Owner decisions
(2026-07-31):

1. **Non-game Events never appear on the "Events" tab.** Every path that fills the tab queries
   `prisma.game` only. But `create-fan-event` writes an `Event` (not a `Game`) for anything that
   isn't a home/away game — practice, meeting, fundraiser, tryout, fan pitch. Those never surface.
   → **Decision: merge Games + Events into one chronological schedule per sub-team.**
2. **Custom "Other" sports collide.** The server maps any non-canonical sport to a single
   `'other'` slug, and `SportProgram` is unique on `(organization_id, sport)`. Two different custom
   sports in one org therefore share one program and render as sub-teams of each other.
   → **Decision: distinct program per custom sport name.**
3. **Past games vs. an unconfirmed opponent stay hidden — violates the app's own invariant.** Both
   screen-summaries hard-filter `opponent_approval_status IN (not_required, approved)` inline
   instead of routing through the canonical `isGamePubliclyVisible` (whose rule is: a _past_ game is
   permanently public even if the opponent never consented).
   → **Decision: route both screen-summaries through the canonical rule** (folded into the fix for #1).
4. **Silent caps** (25 sub-teams, 20 games/sub-team). → **Decision: leave as-is** (documented as
   known-accepted below).

## Non-goals

- No DB schema/migration change. All four fixes use existing columns.
- No change to `team-admin` / `Team.adminSummary` (the coach's management view, a separate
  endpoint that intentionally shows pending/upcoming). Its blast radius is zero here.
- Not raising or instrumenting the caps (#4).
- No new event-creation UX. Events already exist and are created today; this only makes them visible
  on the sport page.

## Verified facts the design relies on

- `GET /events` (`server/src/routes/events.ts`) already implements the correct public event
  visibility rule: `approval_status = 'approved'`, `status != 'cancelled'`, and for game-linked
  events the opponent-consent gate **with the past-game exception**. Standalone events (`game_id`
  null) are unaffected by the opponent clause. This is the rule to reuse — not reinvent.
- `Event` is team-scoped via `team_id`. The create route accepts `home_team_id` as an alias and
  normalizes it to `team_id`, so coach-created non-game events _are_ correctly team-scoped.
- A game-type event carries `game_id` (it is also a `Game`). Merging must therefore include only
  events with `game_id IS NULL` to avoid double-listing.
- `EventStatus = { draft, approved, rejected, cancelled }`; `EventApprovalStatus = { pending,
approved, rejected }`. Public visibility = `approval_status = 'approved'` AND `status != 'cancelled'`.
- `isGamePubliclyVisible` (`server/src/lib/gameApproval.ts`) is the canonical game rule; neither
  screen-summary currently uses it.
- `team-admin` reads `Team.adminSummary` → the `upcoming_games` endpoint, distinct from the two
  `screen-summary` endpoints changed here.

## Design

### Part A — the shared `teamScheduleFeed` helper (fixes #1 games+events AND #3)

The root cause of #3 is duplicated, hand-rolled game queries in `teams.ts` and `programs.ts`.
Fixing it in two places invites the next drift. Introduce **one** source of truth.

**New file:** `server/src/lib/teamScheduleFeed.ts`

```
export type ScheduleItem =
  | ({ kind: 'game' } & GameSummary)
  | ({ kind: 'event' } & EventSummary);

// Given a set of team ids and the viewer, return the merged, visibility-correct,
// date-desc schedule for those teams. The ONE place schedule visibility is decided.
export async function getTeamScheduleFeed(
  teamIds: string[],
  viewerId: string | null,
  opts?: { limit?: number }
): Promise<ScheduleItem[]>
```

Behavior:

- **Games** — `prisma.game.findMany` where `home_team_id`/`away_team_id ∈ teamIds`, `take` bounded,
  then filtered in code through **`isGamePubliclyVisible`** (this is the #3 fix). Serialize with
  `GAME_SUMMARY_SELECT`, tag `kind: 'game'`.
- **Events** — `prisma.event.findMany` where `team_id ∈ teamIds` **AND `game_id: null`** (dedupe)
  **AND** `approval_status: 'approved'` **AND** `status: { not: 'cancelled' }`, `take` bounded.
  Serialize via the existing `serializeEvent` shape (or a trimmed summary), tag `kind: 'event'`.
- **Merge** both lists, sort by `date` desc, apply the combined `limit` (default mirrors today's
  per-team game cap so behavior is unchanged for game-only teams).

Notes:

- Viewer privacy for the _teams themselves_ is already enforced by the callers
  (`isTeamHiddenFromViewer`); this helper is scoped to team ids the caller already deemed visible.
- Admin/coach viewing does not change item visibility here (matches today's screen-summary, which is
  the public projection). Pending/unapproved drafts remain the domain of `team-admin`.

### Part B — wire both screen-summaries to the helper

- `GET /teams/:id/screen-summary` (`server/src/routes/teams.ts`): call
  `getTeamScheduleFeed([teamId], viewerId)` and add a **new `schedule` array** to the response.
  Leave the existing `games` array in place (back-compat + existing tests) — it may be removed in a
  later cleanup once no consumer reads it.
- `GET /programs/:id/screen-summary` (`server/src/routes/programs.ts`): for each visible level team,
  attach `schedule` alongside the existing `games`. (Either call the helper per team, or once for all
  visible team ids and bucket by team — implementation detail; per-team is simplest and matches the
  existing `gamesByTeam` bucketing.)

### Part C — client rendering (#1 client side)

- `constants/programs.ts` → `buildProgramSubTeams`: read `level.schedule` instead of `level.games`
  (fall back to `games` if `schedule` is absent, so an old server response still renders).
- `app/team-page.tsx`:
  - `fetchTeamData`: read `summary.schedule` (fallback to `summary.games`).
  - The Events `FlatList` `renderItem` branches on `item.kind`:
    - `game` → existing row (opponent, score, `→ /game/[id]`).
    - `event` → title + `event_type` label, no score, `→` the event detail screen (route to be
      confirmed at implementation: `event-detail` vs `public-event`; internal app routes are singular).
  - Empty state unchanged ("No events yet").
- Ships via OTA to both runtimes.

### Part D — distinct program per custom sport (#2)

In every server site that resolves a program slug from a free-text sport (primary:
`server/src/routes/teams.ts` create transaction; audit for others via
`grep -rn "?? 'other'" server/src` and `normalizeSportToSlug` call sites):

```
const canonical = normalizeSportToSlug(data.sport);           // canonical slug or null
const sportSlug = canonical ?? customSportSlug(data.sport);    // stable per-name slug; 'other' only if blank
```

- `customSportSlug(name)`: lowercased, trimmed, non-alphanumerics → single dashes, prefixed
  `custom:` to guarantee no collision with a future canonical slug of the same word. Blank/whitespace
  name → `'other'` (guard).
- On create for a custom sport, set `SportProgram.name` to the original display text so
  `formatProgramLabel`/`getSportLabel` render "Rowing", not "custom:rowing". Canonical sports
  untouched (no label churn).
- Client (`app/(tabs)/create-team.tsx`): confirm the submit payload sends the custom sport text as
  `data.sport` when "Other" is chosen (so the server has a name to slugify). Adjust only if it
  currently sends an empty `sport`.
- No schema change: uses existing `SportProgram.sport` + `SportProgram.name` columns and the existing
  `(organization_id, sport)` unique constraint.

### Part E — corrective backfill (optional, owner-run)

`server/scripts/split-other-sport-programs.ts`, mirroring `backfill-sport-programs.ts` (dry-run by
default). Finds `'other'` programs whose active teams span >1 distinct custom sport, creates a
per-custom-sport program, and reassigns those teams' `program_id`. **Flagged optional** — only orgs
that already created 2+ custom sports have the collision; most trees are unaffected. Run manually,
dry-run first. Because reassigning `program_id` interacts with the `ProgramFollow`/`TeamFollow`
fan-out, the script must be reviewed against `programFollowFanout.ts` before a live run.

## Data flow (after the change)

```
team-page Events tab
  ├─ lone team   → GET /teams/:id/screen-summary  → getTeamScheduleFeed([team])   → schedule[]
  └─ program team→ GET /programs/:id/screen-summary→ getTeamScheduleFeed(perTeam) → levels[].schedule[]
                                                        │
                     buildProgramSubTeams(levels) ──────┘  (reads .schedule)
                                                        │
                     FlatList renderItem branches on item.kind → /game/[id]  or  event detail
```

## Testing

Server (`cd server && npm test`):

- `teamScheduleFeed`: a standalone approved event for a team appears; a `cancelled` event does not;
  a `pending`/`draft` event does not; a game-linked event (`game_id` set) is **not** double-listed;
  a **past** game vs. a pending/declined opponent **now appears** (the #3 regression pin); an
  upcoming game vs. a pending opponent does **not** appear.
- Both screen-summaries return a `schedule` array; program summary buckets per level team.
- `customSportSlug`: two different custom sports resolve to two different slugs; a canonical sport is
  untouched; blank → `'other'`. Team-create groups two custom-sport teams into two programs.

Client:

- `buildProgramSubTeams` reads `schedule` (with `games` fallback).
- team-page Events renders both a game row and an event row, routing each correctly.
- Existing consolidation tests (`team-page-redirect.test.tsx`, `program-page.smoke.test.tsx`,
  `program-labels.test.ts`, `navigation-history-contracts.test.ts`) stay green.

## Rollout

1. Branch `fix/sport-page-schedule-events-and-custom-programs` off `main` (done).
2. Server + client changes + tests; `npx tsc --noEmit` (both), `npm run test:regressions`.
3. PR → merge to `main` (Railway auto-deploys the server; read-path only, no migration).
4. OTA publish to **both** runtimes (1.0.4 manual override + 1.0.5 auto) — users need two cold starts.
5. Optional: run the #2 backfill dry-run, review, then live if collisions exist.

## Risks

- **Response-shape addition** (`schedule`): additive, `games` retained, client falls back — low risk.
- **#3 visibility widening**: past games vs. unconfirmed opponents become publicly visible. This is
  the _documented intended_ behavior (`isGamePubliclyVisible`), but it is a visible change; call it
  out in the PR.
- **#2 label rendering**: verify `formatProgramLabel` uses `SportProgram.name` when set; otherwise a
  custom program could render its slug. Covered by setting `name` on create.
- **Custom-sport client payload**: if `create-team` sends an empty `sport` for "Other", Part D can't
  slugify — verified as an explicit implementation step.

## Known-accepted (not changing)

- Sub-team picker caps at 25 teams; schedule caps at ~20 items per team. Realistic programs stay
  under these; raising/instrumenting them is out of scope (owner decision 2026-07-31).
- Replies/Upvotes tabs remain empty stubs — their sport-page semantics are still undefined and out of
  scope here.
