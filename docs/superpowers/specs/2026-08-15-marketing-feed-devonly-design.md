# Marketing Feed (dev/sim-only) — Design

**Date:** 2026-08-15
**Status:** Approved (design); implementation pivoted to admin-gated (see Update).
**Scope:** Admin-only in production, behind a per-device toggle. Zero behavioral
change for non-admin users.

## Update (2026-08-15) — pivot from dev-only to admin-gated

Local simulator builds on the dev machine were blocked by three unrelated
toolchain issues (brace-expansion codegen, RN 0.81 prebuilt-React link, a
Metro/Node asset-hashing bug), so capturing in the sim was impractical. The
owner chose to run the capture against the real production app instead, gated so
only they can see it. The `__DEV__`+env gate below is replaced by:
**`isAdmin && <persisted per-device toggle>`**, flipped by long-pressing the
feed header brand. Everything else in this design (server `marketing=1`,
`sort=active`, top-40 Fisher-Yates shuffle, replace-the-list) is unchanged.

## Goal

For marketing capture (screenshots / video in the iOS simulator or a dev client),
fill the feed screen with the platform's **most-active event pages**, in a
**shuffled** order. "Most active" = **post/media count** (the visually richest
cards). This is a presentation aid only — it must never activate for real users.

## Non-goals

- Not a production ranking/discovery feature.
- No new screen or route surface (client renders into the existing feed list).
- No change to how real users' feeds are built or ordered.

## Constraints / decisions

- **Metric:** post + media count per event (posts linked via `Post.event_id` OR
  the event's `game_id`).
- **Order:** rank by activity desc, take the top N, then Fisher-Yates shuffle so
  each capture looks fresh. (Shuffle after the top-N cut, not before.)
- **Presentation:** while the flag is on, the shuffled most-active events
  **replace** the feed list.
- **Data source:** real production data (the simulator points at the production
  API via `EXPO_PUBLIC_API_URL`), so the ranking must be computed server-side.
- **Safety:** the client path is `__DEV__`-gated so it is stripped from
  production bundles; the server addition is read-only and opt-in, leaving every
  existing caller byte-for-byte unchanged.

## Architecture

### Server — `GET /events` (server/src/routes/events.ts)

Additive, opt-in, read-only:

1. Accept `marketing=1` (or `marketing=true`). When absent, behavior is
   identical to today — no extra query, no new field, no new sort.
2. When `marketing=1`:
   - Compute `activity_count` per returned event = number of Posts where
     `event_id = event.id` OR (`event.game_id` set AND `game_id = event.game_id`).
     Implemented as a single grouped `post.groupBy` over the returned event/game
     ids (not a per-row query), mirroring the existing rsvp-count batch pattern
     (`_count` grouped map).
   - Add `activity_count: number` to the serialized payload for those events.
   - Support `sort=active` → order the fetched set by `activity_count` desc
     (applied in-process after the count map is built, since it is a derived
     aggregate). Falls back to the existing `created_at desc` fetch order for the
     DB `take`, then re-sorts by activity; over-fetch (`limit` up to the existing
     100 cap) keeps the pool large enough.
3. `marketing` implies `show_all` semantics already reachable via existing params
   (`show_all=true`, `include_past=true`) — the client passes those explicitly;
   no new geo behavior is added.

Bounded: still subject to the existing `take` cap (≤100). No unbounded query.

### Client — `app/feed.tsx`

1. Read a build-time flag:
   `const MARKETING_FEED = __DEV__ && (Constants.expoConfig?.extra?.EXPO_PUBLIC_MARKETING_FEED === '1' || process.env.EXPO_PUBLIC_MARKETING_FEED === '1')`.
2. When `MARKETING_FEED` is true, the feed's data assembly takes a dedicated
   path: fetch
   `Event.filter({ marketing: true, show_all: true, include_past: true }, 'active', 60)`,
   map via the existing event→GameItem mapper, take the top N (e.g. 40), apply a
   Fisher-Yates shuffle, and use that as the rendered list — **replacing** the
   normal games/pro-event merge.
3. When the flag is false (all production builds), the code path is dead and
   stripped; the normal feed is untouched.

`Event.filter` in `api/entities.ts` gains a passthrough for the `marketing`
param (the client typed API already forwards `sort`/`limit`/filter keys).

## Data flow

```
[sim/dev, EXPO_PUBLIC_MARKETING_FEED=1]
  feed.tsx (MARKETING_FEED branch)
   -> Event.filter(marketing=1, sort=active, show_all, include_past, limit=60)
   -> GET /events?marketing=1&sort=active&show_all=true&include_past=true&limit=60
        -> events fetched (bounded take)
        -> post.groupBy activity count map (event_id + game_id)
        -> serialize with activity_count, sort by activity desc
   -> client: top 40, Fisher-Yates shuffle
   -> render as feed list (replaces normal merge)
```

## Testing

- **Server:** a focused test asserting (a) without `marketing`, the response
  shape and order are unchanged (no `activity_count` key); (b) with `marketing=1`,
  `activity_count` is present and `sort=active` orders by it desc. Run via the
  ESM jest wrapper.
- **Client:** the shuffle is a pure helper (`shuffleInPlace`/`pickTopShuffled`)
  with a seedable/deterministic unit test (shuffle a known array, assert it is a
  permutation and, with a fixed RNG, a known order).
- **Manual/sim:** launch the dev client with the flag set, screenshot the feed.

## Rollback / safety

- Client: `__DEV__` gate → never in a production bundle.
- Server: opt-in param → default path unchanged; removing the feature is
  deleting the `marketing` branch. Read-only; no writes, no migrations.

## Verification gate

- `npx tsc --noEmit` (client) + `npx tsc --noEmit --project server/tsconfig.json` → 0 errors
- server unbounded-queries suite passes (count query is bounded/grouped)
- new marketing test passes
- live check against production API: `GET /events?marketing=1&sort=active&...`
  returns `activity_count` and descending order
