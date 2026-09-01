# Event-Card Normalization Contract — Design

**Date:** 2026-09-01
**Status:** Approved design, pre-implementation
**Branch:** `feat/event-card-contract` (stacked on `fix/map-calendar-lane1`)
**Lane:** 4 of the map/feed/discover rework (see `MEMORY.md` → map lane 1)

## Problem

`Game` and `Event` are two data models, and every surface (feed, map, Discover)
blends them with its own ad-hoc mapping. This drift is the root cause behind the
map/calendar inconsistency (Lane 1), NCAA feed placement, and the polls gap. The
cure is one **canonical event-card shape** that every surface renders, so no
screen re-derives the Game/Event blend.

The server already produces this shape: `GET /event-discovery` returns
`{ items, surface, counts }` where each item unifies `Game` and `Event`
(`source_type`, `id`, `event_id`, `game_id`, coords, sport, `feed_priority`,
`posting_capabilities`…), ranked by priority. The **map (Lane 1) already consumes
it**; feed and Discover do not. What is missing is a **client-side canonical
type and mapper** that guards this shape and that surfaces consume instead of
mapping raw `Game`/`Event` themselves.

## Goal (this increment)

Define and pin the canonical client-side `EventCard` contract, and prove it on
**one low-risk surface: the map**. No product-behavior change.

The contract normalizes card **shape**, not data **source**. Each surface keeps
its own data scope (the map = public discovery; Discover = followed/managed;
feed = its own plan). They converge only on the card shape.

## Non-goals (explicitly deferred to later lanes)

- Extracting a shared **server** serializer (`serializeEventCard`) so
  followed/managed/feed endpoints emit the card. Do this when a second surface
  actually adopts the card (YAGNI).
- Migrating **feed** onto the card (touches spotlight/pinned/live/ad ordering —
  highest risk).
- Migrating **Discover** onto the card. Discover keeps its followed/managed
  scope regardless; a future lane maps its raw results into `EventCard`
  client-side or via a server serializer.
- Any filters/ranking UI. Filters must not precede this contract.

## Current state (verified 2026-09-01)

- Server: `server/src/lib/eventDiscovery.ts` serializes discovery items inline
  (game + event branches) and returns `{ items, surface, counts?,
private_team_items? }`, sorted by `feed_priority` then time. Pinned by
  `server/src/__tests__/event-discovery-contract.test.ts`.
- Client: no canonical event-card type. `utils/mapDiscovery.ts` (Lane 1) has a
  minimal local `MapDiscoveryItem` interface covering only the fields the map
  needs, plus `toMapEvents` (item → `EventMapData`) and `buildUpcomingDateButtons`.
- Client schema convention: `apiclient/schemas/*.ts` — zod (v3) schemas with
  `.passthrough()` and `captureException` on parse failure, exposed via
  `validateX(endpoint, payload)` helpers (see `apiclient/schemas/event.ts`,
  `auth.ts`).

## Design

### 1. The contract artifact — `apiclient/schemas/eventCard.ts`

A new zod schema `eventCardSchema` mirroring the server discovery item, grouped:

- **Identity:** `id`, `source_type` (`'game' | 'event'`), `event_id` (nullable),
  `game_id` (nullable).
- **Display:** `title`, `date` (ISO string, nullable), `location` (nullable),
  `banner_url` (nullable), `sport` (nullable), `pro_home_color`,
  `pro_away_color`, `pro_league` (all nullable), `venue_photo` (nullable),
  `status` (nullable).
- **Location:** `latitude`, `longitude` (nullable), `map_visibility`
  (`{ visible, reason_code, surface_window }`).
- **Ranking:** `feed_priority` (number).
- **Capabilities:** `live_window`, `posting_capabilities` — kept as a
  `.passthrough()` sub-object so capability drift never fails the whole parse.

Exports:

- `eventCardSchema`, `EventCard` (`z.infer`).
- `eventDiscoveryResponseSchema` = `{ items: EventCard[], surface, counts? }`
  with `.passthrough()`.
- `validateEventCards(endpoint, payload): EventCard[]` — never throws into a
  screen. Resilience is **per item, not all-or-nothing**:
  - If the wrapper is malformed (not an object, or `items` not an array),
    capture drift (endpoint-tagged) and return `[]`.
  - Otherwise parse each item individually: keep the valid ones, drop the
    invalid ones, and capture a **single** drift event summarizing how many were
    dropped and why (first error). One bad item must never blank the whole map.

The schema is lenient in the same spirit as the existing ones: unknown extra
fields pass through; only the fields surfaces actually rely on are required.

### 2. The proof — map consumes the canonical card

- `utils/mapDiscovery.ts`: **remove** the local `MapDiscoveryItem` interface;
  `toMapEvents` and `buildUpcomingDateButtons` now take `EventCard[]` (imported
  from the schema). Logic is unchanged — pure retyping onto the canonical shape.
- `app/game-map.tsx`: run the `/event-discovery` response through
  `validateEventCards('/event-discovery?surface=map', res)` before
  `toMapEvents`. Everything downstream (pins, calendar strip, sport filter) is
  unchanged.

Result: the map's data flows through the single typed contract with zero
behavior change — the structural proof.

### 3. Pinning — tests

- `apiclient/schemas/__tests__/eventCard.test.ts` (new):
  - A fixture matching the **server's** serialized shape (copied from
    `event-discovery-contract.test.ts`'s asserted output) parses cleanly through
    `eventCardSchema` — the client↔server drift guard.
  - A batch with one missing-required-field item keeps the valid items and drops
    only the bad one, capturing a single drift event (per-item resilience).
  - `validateEventCards` returns `[]` (not throw) on a malformed wrapper
    (non-object, or `items` not an array).
- `utils/__tests__/mapDiscovery.test.ts` (existing): adapt fixtures to the
  `EventCard` type; assertions unchanged.

### 4. Error handling

`validateEventCards` never throws into a screen. A malformed wrapper degrades to
the map's existing empty state (`[]`); a few malformed items degrade to the valid
subset. Both paths capture drift to Sentry (endpoint-tagged), consistent with the
`validateEvent*` helpers. This is why the map keeps rendering even if the server
serializer partially drifts.

## File-by-file change list

| File                                            | Change                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apiclient/schemas/eventCard.ts`                | **New.** `eventCardSchema`, `EventCard`, `eventDiscoveryResponseSchema`, `validateEventCards`.           |
| `apiclient/schemas/__tests__/eventCard.test.ts` | **New.** Contract + drift + safe-parse tests.                                                            |
| `utils/mapDiscovery.ts`                         | Replace `MapDiscoveryItem` with imported `EventCard`; retype `toMapEvents` / `buildUpcomingDateButtons`. |
| `app/game-map.tsx`                              | Parse discovery response via `validateEventCards` before mapping.                                        |
| `utils/__tests__/mapDiscovery.test.ts`          | Retype fixtures to `EventCard`; assertions unchanged.                                                    |

## Testing & verification

- `npx tsc --noEmit` (client) — 0 errors.
- Jest: `eventCard.test.ts`, `mapDiscovery.test.ts`, `EventMap.autofit.test.tsx`,
  `discover-map-no-calendar.test.ts` all green (Node 20).
- `eslint` on changed files clean.
- Behavior parity: the map renders the same pins/calendar as Lane 1 (verified by
  the unchanged `mapDiscovery`/`autofit` assertions).

## Risks & mitigations

- **Client↔server drift.** The whole point; the contract test with a
  server-shaped fixture is the guard. When the server serializer changes shape,
  the client test (and Sentry drift capture) catch it.
- **Over-tight schema rejecting real data.** Mitigated by `.passthrough()` and
  making only surface-relied fields required; capabilities stay opaque.
- **Scope creep into feed/Discover/server.** Held off by the non-goals section;
  this increment is map-only.

## Migration path (future lanes, not this increment)

1. Extract server `serializeEventCard(game|event)` from `eventDiscovery.ts` as
   the single source of truth.
2. Have followed/managed endpoints (Discover) and the feed game/event plan emit
   `EventCard`.
3. Migrate Discover and feed clients onto `validateEventCards` — each keeping its
   own data scope.
4. Build filters/ranking on top of the now-uniform card.
