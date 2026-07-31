# NFL Schedule → Rolling Standalone Event Pages — Design

Date: 2026-07-31
Status: Approved by owner (conditional on "real and confirmed information only"), 2026-07-31
Branch: `feat/nfl-schedule-event-pages` (off `feat/pro-sports-events`)
Depends on: `feat/pro-sports-events` (unpushed, no PR) — the pro-events pipeline this extends.

## Goal

Populate the upcoming NFL season into **standalone event pages** — one geofenced
event page per NFL game — sourced from real, confirmed schedule data, published
on a rolling ~2-week horizon.

Explicit owner constraints for this slice:

- **No NFL team pages.** Do not build or expose any NFL team page. Team objects
  stay purely as an internal venue/title lookup; nothing links a team page onto
  an event page.
- **Keep everything else in the pro-events pipeline as-is.**
- **Real and confirmed information only.** A game reaches a live page only when
  its teams, kickoff time, and venue all reconcile against known-good NFL facts.
  Anything that does not is quarantined for review, never published with guessed
  data.

Out of scope: NBA / WNBA / MLB / WWE (they stay dark), NFL team pages, scores,
standings, live game state.

## What already exists (reuse, do not rebuild)

From `feat/pro-sports-events` — verified present, server-only, no client UI:

- **`ProTeam` seed** — 32 NFL franchises with verified stadium coordinates
  (`server/scripts/seed-pro-teams.ts`, data in `server/src/lib/proTeams.ts`).
  Used here only as the internal venue/title lookup. No page is rendered for it.
- **Ingest pipeline** — `server/src/lib/proSchedule/`:
  - `types.ts` — `ProFixture` normalized shape; `ProScheduleAdapter` interface;
    `LIVE_WINDOW_HOURS_BY_LEAGUE` (NFL = 5h after start).
  - `resolveFixture.ts` — pure fixture → Event-shape resolution. Provider venue
    wins over home stadium; **skips on `NO_VENUE_COORDS`**; fails on
    `UNKNOWN_HOME_TEAM` / `UNKNOWN_AWAY_TEAM` rather than inventing a team.
  - `ingest.ts` — idempotent upsert on `Event.pro_external_ref`; per-fixture
    failures collected, never fatal; narrow update set (provider-owned fields
    only, so staff-set banner/description/poster grants survive re-ingest).
  - `adapters.ts` — `jsonFileAdapter()` + `resolveConfiguredAdapter(env)`, the
    single seam for wiring a provider. Currently only `PRO_SCHEDULE_JSON_PATH`.
- **Event shape for pro games** — `event_type: 'game'`, `approval_status:
'approved'`, `creator_id: null`, `pro_external_ref` set, geofenced posting via
  the existing window logic. These render through the **existing** client event
  screens (`app/event-detail.tsx`, `app/public-event.tsx`) with no new UI.

## Source of truth: TheSportsDB

Owner-selected. A developer-facing API with a free tier — sanctioned use, not
scraping (the pipeline's own docs forbid scraping league/broadcaster sites).
Community-maintained, therefore **never trusted blind** — see Confirmation Gates.

## What this slice builds (3 pieces)

### 1. TheSportsDB adapter

`theSportsDbAdapter(apiKey)` in `adapters.ts`, implementing
`fetchFixtures('nfl', from, to)`:

- Calls TheSportsDB NFL season / next-events endpoints.
- Maps each game's team names → our `ProTeam.external_ref` via a normalized
  lookup (case/punctuation-insensitive, plus a small alias table for known name
  mismatches). An unmapped name yields a fixture with a null ref → the existing
  `UNKNOWN_*` failure path (loud, quarantined), never a silent drop.
- Emits provider venue/coords when present; otherwise leaves them null so
  `resolveFixture` falls back to the seeded stadium coordinate.
- Filters to `[from, to]`.
- Wired into `resolveConfiguredAdapter()` via
  `PRO_SCHEDULE_PROVIDER=thesportsdb` + `PRO_SCHEDULE_API_KEY`. Absent config →
  returns null and no-ops (feature ships dark), matching existing behavior.

### 2. Confirmation gates (the "real and confirmed" requirement)

A new NFL-aware validation layer that runs before publish:

- **Structural reconciliation (blocks the whole publish).** The ingested regular
  season must satisfy the known NFL structure: 18 weeks, **272** regular-season
  games, each of the 32 teams appearing exactly **17** times with exactly **one**
  bye. Deviation beyond a small tolerance → ingest **aborts and reports**; it
  never publishes a partial or malformed slate. (Playoffs handled as a separate,
  smaller reconciliation once brackets are set.)
- **Venue confirmation (per game).** A game publishes only if its location
  resolves to a seeded NFL stadium coordinate **or** an explicitly whitelisted
  neutral-site venue (international/special games — London, Munich, São Paulo,
  etc. — with confirmed coords in a small curated table). Anything unresolved is
  held back (existing `NO_VENUE_COORDS` skip), never published with a guess.
- **Kickoff sanity.** Times converted to venue-local; anything outside plausible
  NFL windows (Thu / Sun / Mon, plus late-season Sat) is flagged for review.
- **Unmapped teams fail loudly** — existing `UNKNOWN_*` path.

Quarantined games are reported (ref + reason), not published. Nothing wrong ever
reaches a live page.

### 3. Rolling 2-week ingest (cron)

A **single** new scheduled starter (memory: enable crons one at a time) that:

- Runs the adapter for NFL over `[now, now + 14 days]` every ~6h.
- Applies the confirmation gates, then upserts (idempotent — moved/postponed
  games self-correct in place; no duplicate pages).
- **First-load human gate:** the initial full-season ingest runs `--dry-run`
  first and emits a review report; nothing goes public until the owner approves
  that baseline. Only after baseline confirmation does the cron auto-apply
  _within-window_ changes (date moves, postponements, venue corrections).

## Data flow

```
cron (every ~6h)
  → resolveConfiguredAdapter(env)            // theSportsDbAdapter
  → adapter.fetchFixtures('nfl', now, now+14d)
  → confirmation gates (structural + venue + kickoff + team mapping)
        ├─ fail structural → abort + report, publish nothing
        └─ per-game fail   → quarantine + report
  → resolveFixture (venue/title/coords, existing)
  → ingest.upsert → Event rows (event_type:'game', approved, creator_id:null)
  → existing client event-detail / public-event screens
```

No team object is ever attached to the event page surface. `pro_home_team_id` /
`pro_away_team_id` remain internal FKs used only for venue/title resolution and
are not rendered as links.

## Testing

- Reuse `pro-schedule-resolve.test.ts` and `pro-event-geofence-parity.test.ts`.
- New `thesportsdb-adapter.test.ts` against a **captured** TheSportsDB NFL sample
  (no live network in tests): fixture → ProFixture mapping; unmapped-team →
  `UNKNOWN_*`; window filtering; neutral-site venue handling.
- New `nfl-schedule-confirmation.test.ts`: a complete valid season passes; a
  season missing games / with a team playing 18 times / with a bad bye count is
  **rejected**; a single unresolved-venue game is quarantined while the rest
  publish.

## Shipping / scope reality

Live NFL event pages require the **entire `feat/pro-sports-events` branch to
merge** (Prisma `ProTeam` model + migration + routes) plus this slice. Staging:

1. Rebase `feat/pro-sports-events` on current `main`; open its PR (with the
   DB migration).
2. Layer this slice (adapter + confirmation gates + cron) on top.
3. NFL-only launch; other leagues stay dark (no fixtures, `resolveConfiguredAdapter`
   returns for NFL only in practice because only NFL fixtures are fetched).
4. First season load via dry-run → owner review → publish.

## Open items to confirm during implementation

- TheSportsDB's exact NFL endpoint shape + free-tier rate limits (capture a real
  sample; do not assume field names).
- Neutral-site game list for the upcoming season + confirmed venue coords.
- Which cron scheduler to hang the starter on (memory: 7 of 11 starters were
  never wired; add exactly one, enabled deliberately).
- Confirm pro `Event` rows actually surface in the client feed/events tab as
  expected (verify against a running server, not types).
