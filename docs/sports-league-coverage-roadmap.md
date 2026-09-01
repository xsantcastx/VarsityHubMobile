# Sports League Coverage Roadmap

Status: working plan, 2026-09-01.

## Problem

VarsityHub's external sports schedule support is currently hard-coded around a
small `ProLeague` enum plus a few client-side feed special cases. That cannot
scale to major, minor, women's, and NCAA coverage.

The current supported schedule enum is:

- NFL
- NBA
- WNBA
- MLB
- WWE
- NCAA football
- NCAA men's basketball
- NCAA women's basketball
- NCAA baseball
- NCAA men's hockey

Everything outside that list needs new data modeling and provider coverage
before it can be considered active.

## Provider Facts To Re-Verify Before Purchase

- Sportradar's public developer coverage includes NFL, NCAAFB, UFL, NBA, WNBA,
  NCAAMB, NCAAWB, G League, soccer, tennis, NHL, Unrivaled, NASCAR, Formula 1,
  MLB, and golf: https://developer.sportradar.com/getting-started/docs/get-started
- SportsDataIO publicly lists APIs for NFL, MLB, NBA, NHL, college football,
  college basketball, PGA, NASCAR, soccer, UFC/MMA, tennis, and Olympics:
  https://sportsdata.io/
- Genius Sports advertises official NCAA data coverage across football,
  women's and men's basketball, ice hockey, and volleyball:
  https://www.geniussports.com/engage/official-sports-data-api/
- TheSportsDB is broad and useful for fallback/long-tail metadata, but it is
  crowd-sourced and should not be treated as the sole production-grade schedule
  authority: https://www.thesportsdb.com/

## Small-Step Implementation Sequence

### Step 1: Remove stale hard-coded backend league lists

Done in this branch:

- `GET /pro-teams` now validates against `PRO_SCHEDULE_LEAGUES` instead of a
  stale five-league local list.
- `scripts/ingest-pro-schedule.ts` now uses `PRO_SCHEDULE_LEAGUES` instead of
  a stale five-league local list.
- Added a parity test so those entry points stay wired to the canonical list.

### Step 2: Add data-driven league metadata

Done in this branch as an additive migration:

- `SportsLeague`
- `SportsSeason`
- `SportsIngestRun`
- nullable `Event.sports_league_id`

`ProLeague`, `ProTeam`, and `Event.pro_external_ref` remain in place during
the transition.

### Step 3: Backfill current leagues

Done in this branch:

- The migration creates `SportsLeague` rows for the currently supported
  leagues.
- The migration backfills existing external `Event` rows from linked
  `ProTeam.league`.
- New schedule ingests set `Event.sports_league_id` when the corresponding
  `SportsLeague` row exists.

### Step 4: Add league-aware event API

Done in this branch. `GET /events` now accepts:

- `league_slug`
- `sport`
- `level`
- `gender`
- `sports_league_id`

`pro_league` remains backward-compatible input/output until mobile clients no
longer depend on it. Event responses now include league metadata when available.

### Step 5: Remove client feed special cases

Done in this branch. The feed no longer performs separate WWE/NFL/NCAA external
event fetches; it uses the backend-driven external-event query and renders what
the backend returns.

### Step 6: Provider-backed expansion

Add leagues only when each has:

- provider selected
- provider league id mapped
- schedule endpoint tested
- venue coordinates or reliable geocoding
- ingest monitoring
- legal/licensing approval

Initial expansion targets:

- NHL, AHL, ECHL, PWHL
- MLS, NWSL, USL
- G League
- UFL, CFL
- MiLB
- NCAA softball, volleyball, women's hockey, soccer, lacrosse

## Non-Negotiable Rule

Do not mark a league active just because it exists in a catalog. A league is
active only when VarsityHub can ingest current fixtures, resolve teams, resolve
venues, and show those events in app surfaces without manual patching.
