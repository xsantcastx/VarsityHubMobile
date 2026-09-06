# Discover Adopts the Event Card via a `following` Discovery Scope — Design

**Date:** 2026-09-01
**Status:** Approved design, pre-implementation
**Lane:** 6 of the map/feed/discover rework — first real consumer of the canonical card
**Depends on:** the server serializer (`refactor/server-serialize-event-card`, commit 8ddba7b5) AND the client contract (`feat/event-card-contract`: `validateEventCards`). See **Branching** below.

## Problem

The canonical event card now exists on both sides — a server serializer
(`serializeGameCard`/`serializeEventCard`) and a client validator
(`validateEventCards` + `EventCard`) — but only the map consumes it. To prove
the contract on a **second producer and a real client surface**, Discover's
followed/managed calendar should be fed by the canonical card instead of its own
three ad-hoc queries.

Per CLAUDE.md's "no parallel path bypassing the pipeline" rule, the second
producer is the existing discovery pipeline extended with a `following` scope —
not a new parallel endpoint, and not a shape change to the shared raw
games/events routes.

## Goal

1. **Server:** `listEventDiscoveryItems` gains `scope: 'public' | 'following'`
   (default `public`; existing path byte-identical). `following` returns the
   viewer's followed ∪ managed teams' games/events, serialized as event cards,
   with future-only **unbounded** windowing.
2. **Client:** Discover's calendar replaces its three queries with one
   `/event-discovery?scope=following` call → `validateEventCards` → a
   card→calendar projection. The calendar UI is unchanged; only its data source
   changes.

## Non-goals

- No change to the **public** discovery path (map), the shared `/games` or
  `/events` list routes, or feed. Feed migration stays a later lane.
- No product change to Discover's calendar behavior — this is a data-source swap
  that **preserves** what the calendar shows (see the window decision).
- No filters/ranking UI.

## Key decision: the `following` window (behavior parity)

Discover's calendar today shows **all upcoming** followed/managed games
(`Game.list({ following: true, dateFrom: startOfToday })` with **no** `dateTo`,
then `d >= now`; `Event.filter({ following: true })` filtered `d >= now`). The
public discovery window is hard-clamped to **5 days** (`MAP_LOOKAHEAD_MS`).

**Decision:** the `following` scope uses **future-only, unbounded** windowing
(`from = now`, no 5-day upper clamp), matching Discover's current calendar. It
must NOT inherit the public 5-day clamp — doing so would silently regress the
calendar to "next 5 days only." The generous row cap (`MAX_LIMIT = 300`) stays
as the only bound.

## Current state (verified 2026-09-01)

- Server: `listEventDiscoveryItems` (`server/src/lib/eventDiscovery.ts`) windows
  via `defaultWindow`/`clampWindow` keyed on `surface` (feed/map/all), all
  clamped to `MAP_LOOKAHEAD_MS`. Serialization is now `serializeGameCard`/
  `serializeEventCard` (`server/src/lib/eventCardSerializer.ts`). Private-team
  exclusion via `loadExcludedPrivateTeamIds` (queries `teamFollow`,
  `teamMembership`, `organizationMembership`).
- No reusable "followed teams" or "managed teams" resolver: `teamFollow.findMany`
  is ad-hoc; managed-teams logic is inline in the `/teams/managed` route
  (`server/src/routes/teams.ts:590`).
- Client: Discover calendar issues three queries (followed games, followed
  events, managed teams) and merges them (`app/(tabs)/discover/mobile-community.tsx`
  ~lines 505–560). `validateEventCards` + `EventCard` exist in
  `apiclient/schemas/eventCard.ts`.

## Design

### Server

**1. Team-scope resolver** — new `server/src/lib/viewerTeamScope.ts`:
`getViewerTeamScope(db, viewerId): Promise<Set<string>>` returning the union of
the viewer's followed team ids (`teamFollow`) and managed team ids (the exact
semantics of `/teams/managed`: teams where the viewer is an active manager/coach,
plus teams in orgs the viewer owns/manages). Extract the managed-teams query so
both this resolver and the route can share it (no re-derived parallel logic). If
`viewerId` is null → empty set.

**2. Scope-aware windowing** — `listEventDiscoveryItems` gains `scope`:

- `public` (default): unchanged `defaultWindow`/`clampWindow` (5-day).
- `following`: `from = now`, `to = now + FOLLOWING_LOOKAHEAD` where
  `FOLLOWING_LOOKAHEAD` is large enough to be effectively unbounded-future
  (e.g. 365 days), bypassing `MAX_DISCOVERY_RANGE_MS`. Row cap `MAX_LIMIT` still
  applies.

**3. Team filter** — when `scope === 'following'`: after fetching, keep only
games where `home_team_id` or `away_team_id` ∈ scope, and events where
`team_id` ∈ scope. (Private-team exclusion still applies, but the viewer follows/
manages these teams so nothing they should see is excluded.) When the scope set
is empty, return `{ items: [] }`.

**4. Route** — `GET /event-discovery?scope=following` (`server/src/routes/eventDiscovery.ts`):
validate `scope` ∈ {`public`,`following`}; pass through `viewerId = req.user?.id`.
`following` with no viewer returns empty items (never 500).

### Client

**5. Card → calendar projection** — a small pure helper (client) mapping
`EventCard[]` into the shape Discover's calendar rendering already consumes
(`getSelectedDateGames`/`getSelectedDateEvents`, the day-count strip). Reuse the
existing `EventCard` type; project only the fields the calendar needs (id,
event_id, game_id, source_type, title, date, location).

**6. Discover migration** — replace the three calendar queries with one
react-query call to `/event-discovery?scope=following`, run the response through
`validateEventCards`, and feed the projection into the existing calendar state.
Managed-teams inclusion now comes from the server scope (no separate
`Team.managed()` merge). Routing on tap is unchanged (event vs game).

## Testing & pinning

- Server (`server/src/__tests__/event-discovery-following-scope.test.ts`):
  - viewer following team X sees X's games/events; a non-followed team Y is
    excluded;
  - managed-team games are included;
  - the `following` window is NOT clamped to 5 days (an event 30 days out is
    returned);
  - `scope=following` with null viewer → `{ items: [] }`;
  - `scope=public` output is byte-identical to today (existing
    `event-discovery-contract.test.ts` stays green, unchanged).
- Client: a projection unit test (`EventCard[]` → calendar rows) + the existing
  Discover contract tests stay green.
- `getViewerTeamScope` unit test (followed ∪ managed; empty for null viewer).

## Error handling

`scope=following` never 500s: null viewer or empty scope → `{ items: [] }`.
Client `validateEventCards` already degrades to `[]` on drift, so the calendar
shows its existing empty state rather than crashing.

## Risks & mitigations

- **Window regression** (the main risk): mitigated by the future-only unbounded
  window + the explicit "not clamped to 5 days" server test.
- **Managed-teams semantics drift**: mitigated by extracting and reusing the
  `/teams/managed` query rather than re-deriving it.
- **Two live surfaces**: server public path is untouched (default scope);
  Discover's calendar UI is unchanged (only its data source swaps), pinned by the
  projection test + existing Discover contracts.

## Branching

This lane needs BOTH prerequisites, which are on separate stacks:

- server serializer → `refactor/server-serialize-event-card` (off `main`)
- client `validateEventCards` → `feat/event-card-contract` (off
  `fix/map-calendar-lane1`)

Implementation requires an **integration base** containing both. Options (decide
at handoff): (a) merge both stacks to `main` first, then branch this lane off
`main`; or (b) create an integration branch merging the two prerequisite
branches and build there. The plan assumes an integration base named
`feat/discover-following-scope`.
