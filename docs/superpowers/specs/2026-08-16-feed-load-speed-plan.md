# Feed Load Speed — Investigation & Plan

|             |                                                                          |
| ----------- | ------------------------------------------------------------------------ |
| **Date**    | 2026-08-16                                                               |
| **Branch**  | `feat/marketing-feed-devonly`                                            |
| **Status**  | Plan — pending approval                                                  |
| **Trigger** | User note: "it seems like it just takes a long time for events to load." |

## Problem (verified)

`FeedScreen.load()` blocks first paint on **all** feed data at once:

- `app/feed.tsx:864` — `await Promise.all([...7 queries...])`: upcoming games,
  past games, marquee, pro-upcoming events, pro-past events, WWE, NFL.
- Only after all 7 settle does it `mergeFeedGames(...)` (`:1035`) →
  `setGames(...)` + `setLoading(false)` (`:1080-1085`).
- So the spinner clears on the **slowest of seven** ~600ms requests. Posts /
  highlights / ads then load in a second deferred pass after that.

The comment at `:859` even notes past/marquee/pro are "best effort … never
blocks" — but they are currently awaited in the same `Promise.all` that gates
the render, so they _do_ block first paint.

Second problem: event-card images (`FullBleedCardImage`, `app/feed.tsx:82`) use
`expo-image` with `contentFit="cover"` and **no `placeholder`/`transition`**, so
they render as dark boxes until the venue photo downloads (visible in the user's
screenshot).

## Plan

### Phase 1 — Unblock first paint (highest impact)

Render the primary **upcoming games** as soon as that one query resolves; fold in
the other sources when they arrive.

- Await only the `feed-games-upcoming` query, then `setGames(normalize(upcoming))`
  - `setLoading(false)` immediately. The pagination cursor already comes from the
    upcoming query, so nothing else is needed for paging.
- Kick off the other six (past, marquee, pro-upcoming, pro-past, WWE, NFL)
  concurrently **without** awaiting them before paint. When they resolve, re-run
  `mergeFeedGames(...)` and `setGames(...)` a second time.
- Guards: keep the existing `isCurrentRequest()` race guard on both writes; only
  the upcoming-query failure sets the screen `error` (unchanged); the others stay
  best-effort. To avoid a visible re-shuffle, the second `setGames` should no-op
  when the merged list is identical to what's already shown.
- Net effect: events appear after ~1 request instead of ~7.

### Phase 2 — Image pop-in

- Add `placeholder` (a neutral skeleton/blurhash) and `transition={200}` to
  `FullBleedCardImage` and the event-card `<Image>`s so photos fade in instead of
  flashing dark.
- Request a feed-sized thumbnail via `optimizeImageUrl(uri, <feed width>)` rather
  than a large image, so the first byte arrives sooner.

### Phase 3 — Prefetch on app open (optional, later)

- Warm the `feed-games-upcoming` query via react-query `prefetchQuery` at app
  launch (post-auth) so the feed is already populated on first navigation.
  Deferred; not required for the perceived-speed win.

## Risk & verification

- **Risk:** two-pass `setGames` could flicker or reorder. Mitigated by the
  identical-list no-op and by keeping `mergeFeedGames` (stable id/date ordering).
- **Scope:** `app/feed.tsx` only (load orchestration + image props). No server
  change. Ships via OTA (JS only).
- **Verify:** `app/__tests__/feed.smoke.test.tsx` still passes; client `tsc`
  clean; manual check that the upcoming games paint before the pro/marquee
  sections fill in, and that images fade rather than dark-flash.

## Out of scope

- The most-active takeover (separate, already built; blocked on merge).
- Adopting react-query across other screens (broader perf backlog).
