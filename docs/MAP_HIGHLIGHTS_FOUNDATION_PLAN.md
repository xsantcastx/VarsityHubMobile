# Map ↔ Highlights Foundation — Hardening Plan

_Owner: EMIL · Started 2026-08-26 · Branch: `feat/map-highlights-foundation`_

## Why this exists

The map ("View nearby games on map") and the Highlights tab are two halves of **one
discovery loop**, and the map just became the most important surface in the app:

- **Map = supply / discovery.** Upcoming games & events near you (forward-looking).
- **Highlights = demand / engagement.** Posts/moments that already happened, ranked
  (backward-looking).

They are joined by a single fact: every post is denormalized with `game_id` + `event_id`
at write time. That powers the loop:

> discover an upcoming game on the map → attend → geofenced post (attending unlocks
> posting) → the post surfaces in Highlights → others discover it → its `EventChip`
> routes back to the game page → they attend next time.

A rock-solid foundation means the two halves **agree on three contracts**, and a test
net stops them from silently drifting apart again (which is exactly how the "further
than two weeks" bug happened — the 2-week sync fix bounded games but never events).

### The three contracts

| Contract                  | Rule                                                                                                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time window**           | Map games **and** events = now → **+14 days** forward. Highlights: Trending = last 14 days, Top = last 30 days, Recent = unbounded. `MAP_WINDOW_DAYS = 14` is the single source of truth (`utils/mapEventFilters.ts`), mirroring the server games `map_view` window (`server/src/routes/games.ts`). |
| **Location model**        | One coordinate source feeds both the national map and Trending's locality lift. One permission/scope behavior across both surfaces.                                                                                                                                                                 |
| **Shared detail surface** | Map pins and Highlights `EventChip` both land on `GameDetailsScreen`; it must never render a blank page, and its image chain is shared by both entry points.                                                                                                                                        |

## Findings that drive the plan (from the 3-part audit)

1. **Events unbounded into the future** — `/events` map fetch sent no upper date bound
   and `shouldShowEventOnMap` had no upper bound, so pro fixtures months out flooded the
   map. Games were correctly bounded; events were not. **(Phase 0 — fixed)**
2. **Map events ordered by `created_at`, not date** — the soonest events could be pushed
   out of the 100-item cap by a burst of recently-created far-future imports. **(Phase 0 — fixed)**
3. **Blank event pages** — image chain is `banner → cover → venue_photo (117 pro venues) →
bare gradient`; a fan event with no banner fell to a blank gradient. **(Phase 0 — fixed)**
4. **Two location models** — map forces a GPS prompt (50mi radius); Highlights never
   prompts (national), and Trending ignores location entirely. Inconsistent UX. **(Phase 1)**
5. **Map opens on the user, not the country** — `EventMap` auto-zooms to the user, and the
   50mi fetch means even "fit to pins" is local. Owner wants a country-wide default. **(Phase 1)**
6. **Location privacy is well-defended** — precise post `lat`/`lng` is fetched for ranking
   but stripped by `withMediaPreview` before every client response (posts, highlights,
   search). Minor-aware. Latent footgun: select and strip live in different files, so a
   new endpoint reusing `highlightPostSelect` could leak. **(Phase 2 — guard test)**

## Owner decisions (locked in)

- **Map data scope → "Go national, cluster."** The map fetches events/games country-wide
  (window-bounded, coords optional), clusters them into count-pins, and fits-to-all on
  open. "Center on me" becomes a button.
- **Trending → "Blend locality into Trending."** Reintroduce a proximity term into the
  Trending score so nearby moments get a lift — **engagement must stay dominant** and it
  **must degrade gracefully to national when the viewer has no coords** (the two failure
  modes that got proximity removed on 2026-07-20).

---

## Phase 0 — Correctness (DONE, client-only / OTA)

The bugs that actively break the loop. No product decisions; these were just wrong.
All three are **client-only** — the `/events` endpoint already honors `from`/`to`/`sort`,
so no server deploy is needed for the window fix.

- [x] **Event window bound.** `shouldShowEventOnMap` now enforces a `+14d` upper bound
      (`MAP_WINDOW_DAYS`) in addition to the existing "future only" floor — the client-side
      guarantee that events can't outrun the games window. `utils/mapEventFilters.ts`.
- [x] **Bounded, date-ordered events fetch.** The default map view now sends
      `from=now`, `to=now+14d`, `sort=date` so the soonest events win the 100-item cap
      (not the most-recently-created), and the server returns only the window.
      `app/game-map.tsx`.
- [x] **No blank event pages.** The `GameDetailsScreen` placeholder branch renders a
      branded card (calendar icon + event title) instead of a bare gradient.
      `app/game-details/GameDetailsScreen.tsx`.
- [x] **Test.** `__tests__/game-map-date-filter.test.ts` extended to pin both the window
      edge (last day in) and the beyond-window drop (pro fixtures out).

**Verification (run 2026-08-26):** `npx tsc --noEmit` → 0 errors · date-filter test → 5/5 ·
eslint on touched files → 0 errors.

**Ship:** merge to `main` (no server impact) + `eas update --branch production` to **both**
runtimes (1.0.4 override + 1.0.5). No `eas build`.

---

## Phase 1 — National map + one location model (DONE — client OTA + small server)

Make the map national and unify the coordinate pipeline that both halves depend on.

- [x] **National, window-scoped fetch.** The map no longer geo-filters to a 50mi radius —
      it fetches every in-window game/event across the country and clusters client-side.
      Games use `mapView` (national, +14d, cap 100); events send `map_view=true` +
      `from`/`to` + `sort=date` (cap 300). `app/game-map.tsx`.
- [x] **Server-authoritative event window + cap.** `/events?map_view=true` now enforces the
      `now → +14d` window server-side (mirror of the games `map_view` window) and lifts the
      event cap to 300 for the national view — a caller can no longer widen the map past the
      window. `server/src/routes/events.ts`.
- [x] **Geographic (zoom-aware) clustering.** `utils/mapClustering.ts` gained
      `clusterByRegion` (greedy proximity, no cell-edge artifacts) + `clusterCentroid` +
      `clusterSpanDegrees`. `EventMap` tracks the viewport and re-clusters on zoom; cluster
      pins sit at the centroid; tapping a spatial cluster zooms in to split it, while a
      truly co-located group still opens the picker.
- [x] **Country-wide default + location model.** `EventMap` gained `startWide`: the map
      opens on the national region and fits to its pins instead of snapping to the viewer.
      "Center on me" is re-enabled as a button. The map no longer _requires_ GPS for data
      (national fallback) — location is now only for the "you are here" dot + recenter, and
      is non-blocking. The Highlights coords pipeline is **kept** (Trending needs it in
      Phase 3). `components/EventMap.tsx`, `components/EventMap.types.ts`, `app/game-map.tsx`.

**Verification (run 2026-08-26):** client `tsc` → 0 · server `tsc` → 0 · eslint touched → 0 ·
`mapClustering` + `game-map-date-filter` tests → 18/18 · server `api-events` suite → 21/21.

**Deferred to Phase 2:** a server integration test asserting `map_view` window + cap
(lands with the test net). **Follow-up (not blocking):** the games `map_view` cap stays at
100 — fine at current volume; raise it (map_view-aware) when national HS game volume grows.

**Ship:** client OTA + the `/events` server change (Railway auto-deploy from `main`).

## Phase 2 — The test net (DONE — CI only)

This is what stops regression. The 2-week bug shipped because nothing pinned the contract.

- [x] **Window parity test** — `__tests__/map-window-parity.test.ts` pins all THREE window
      definitions (client `MAP_WINDOW_DAYS`, server games `map_view`, server events
      `map_view`) to 14 days; fails if any one drifts, pointing the dev to sync the others.
- [x] **Server map_view window + cap** — `server/src/__tests__/events-map-view-window.test.ts`
      creates events at +13d / +20d / −2d and asserts `map_view=true` returns only the
      in-window one, and that a caller-supplied far `to` can't widen it (server owns the
      window). (This was the Phase 1 deferral.)
- [x] **Coord-leak guard** — `server/src/__tests__/highlights-search-coord-privacy.test.ts`
      creates a post with real `lat`/`lng` and asserts `/highlights` and `/search` strip
      them while keeping coarse `country_code`. Closes the `highlightPostSelect`
      select-vs-strip footgun.
- [x] **Loop contract** — already covered by
      `__tests__/highlights-event-navigation-contract.test.ts` (Highlights routes an event
      result through `buildEventDetailRoute(eventId, game_id)` — the same join the map uses).
- [ ] **Trending locality-blend regression** — lands **with** the blend in Phase 3 (a
      nearby zero-engagement post must not out-rank a high-engagement distant one; a
      no-coords viewer still gets a sensible national ranking). Deferred by dependency.

**Verification (run 2026-08-26):** client parity → 3/3 · server events-map-view → 2/2 ·
server coord-privacy → 2/2 · loop contract → passing · full client foundation set → 22/22 ·
client `tsc` 0 · server `tsc` 0.

**Ship:** CI only.

## Phase 3 — Product-health tuning (DONE — server + client OTA)

- [x] **Trending locality blend.** `scoreTrendingPost` (`server/src/routes/highlights.ts`)
      now takes an `isLocal` predicate and applies a **bounded multiplicative lift**
      (`TRENDING_LOCAL_LIFT = 1.2`) to local posts. Multiplicative (not additive) so the
      lift scales with earned engagement — a nearby zero-engagement post can never out-rank
      a distant popular one, and it's a **no-op when the viewer sent no coords**. The
      2026-07-20 "location doesn't matter" rule and its test are superseded; the trending
      test suite now pins all three blend invariants (engagement dominates / lift works /
      no-op without coords).
- [x] **Calendar picker on the map.** A "Pick date" chip at the end of the quick 7-day strip
      opens a real `DateTimePicker` (already in the binary — OTA-safe), feeding the existing
      `selectedDate` day-scoped fetch. iOS bottom-sheet spinner, Android native dialog,
      past-only, and the chip shows the picked date when an off-strip day is active.
      `app/game-map.tsx`.
- [x] **Inline report on the Highlights card.** Long-press a highlight card opens the report
      flow — same reasons and idempotent feedback (already-reported / cannot-report-own) as
      post-detail, wired to `Report.create`. Closes the "report reachable but not inline on a
      media surface" T&S gap. `app/highlights.tsx`.

**Verification (run 2026-08-26):** client `tsc` 0 · server `tsc` 0 · eslint touched 0 ·
client foundation tests 27/27 · server touched suites (api-highlights, events-map-view,
coord-privacy, api-events) 45/45 — includes the 3 new Trending-blend assertions.

**Ship:** server (highlights blend) via Railway; client (calendar picker, inline report,
national map) via OTA — both runtimes.

---

## Status: all four phases complete

Everything is on `feat/map-highlights-foundation`, verified, **not yet committed or pushed**
(single push + OTA once the branch is assembled, per owner). Remaining before ship:

- **Device/simulator visual pass** — the logic, types, and endpoints are proven by tests,
  but the _visual_ behavior on a real device is unverified: national map fit + clustering
  feel, the "center on me" button, the calendar picker sheet, the placeholder banner, and
  the long-press report. This is the one check the automated gates can't cover.
- **Then:** commit → push `main` (Railway deploys the two server changes: `/events` map_view
  - Trending blend) → `eas update --branch production` to **both** runtimes (1.0.4 override +
    1.0.5), from a clean worktree.

---

## Sequencing & ship summary

| Phase                     | Work                                                                 | Ship path                |
| ------------------------- | -------------------------------------------------------------------- | ------------------------ |
| **0** Correctness         | event `+14d` bound, `sort=date`, photo fallback                      | OTA only (both runtimes) |
| **1** National + location | national fetch, geo-clustering, one location model, national default | OTA + small server       |
| **2** Test net            | window-parity, coord-leak guard, loop contract, locality regression  | CI                       |
| **3** Tuning              | Trending locality blend, calendar picker, inline report              | server + OTA             |

## Risks & guardrails

- **National fetch volume.** The `+14d` window is what keeps it bounded; still cap
  server-side and cluster client-side. Pro fixtures are the wildcard — they're 14-day
  bounded too, so manageable.
- **Trending blend blast radius.** It changes the one ranking everyone sees. Ship behind the
  Phase 2 regression; keep engagement dominant; verify no-coords viewers degrade to national.
- **OTA runtime split.** Owner's device runtime is 1.0.4; publish per runtime (1.0.4 override
  - 1.0.5). Publish from a clean worktree.
- **`main` auto-deploys to prod.** Any committed server change hits Railway on push — keep
  Phase 0 client-only; land the Phase 1 server change deliberately.
