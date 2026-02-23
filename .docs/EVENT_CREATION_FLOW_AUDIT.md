# Event Creation Flow Audit

This document describes the coach event creation flow: fields, validation, database persistence, and visibility across feed, map, team page, and calendar.

## Entry Points

| Entry | Location | Access |
|-------|----------|--------|
| Create modal | `app/create.tsx` | **Coaches only** – "Create Event" option hidden for fans |
| Create event screen | `app/(tabs)/create-fan-event.tsx` | Protected by role check – fans redirected to tabs |

## Flow Overview

1. Coach taps "Create" → Create modal
2. Coach taps "Create Event" → `/create-fan-event`
3. Form validates → `Game.create(payload)` → `POST /games`
4. Server validates, geocodes (if needed), creates `Game` + `Event`

## Form Fields & Validation (`create-fan-event.tsx`)

### Game/Match

| Field | Required | Validation |
|-------|----------|------------|
| Team (current) | Yes | Selected from followed teams |
| Opponent | Yes | Selected from followed teams or manual name |
| Home/Away | Yes | Radio: home \| away |
| Location | Yes | Non-empty; can be autocomplete or manual |
| Date | Yes | Must not be in past |
| Description | No | Optional |

### Non-Game Event (fundraiser, watch party, etc.)

| Field | Required | Validation |
|-------|----------|------------|
| Title | Yes | Non-empty |
| Event type | Yes | game, watch_party, fundraiser, team_meeting, bbq, other |
| Location | Yes | Non-empty |
| Date | Yes | Must not be in past |
| Description | No | Optional |

## Payload to API

### Game

```ts
{
  title: string,           // "Team A vs Team B"
  date: string,            // ISO datetime
  location: string,
  venue_address: string,
  venue_place_id?: string,
  description?: string,
  event_type: 'game',
  autoGeocode: true,       // When location present – triggers server geocoding
  home_team: string,
  away_team: string,
  home_team_id?: string,
  away_team_id?: string,
  away_team_name?: string,
}
```

### Non-Game Event

```ts
{
  title, description, event_type, location, venue_address, venue_place_id,
  date, autoGeocode: true
}
```

## Server Validation (`server/src/routes/games.ts`)

- Schema: title required, date optional (default now), location optional, etc.
- Coach check: user must be owner/manager/coach/assistant_coach of `home_team_id` **or** admin.
- Non-game events: currently require `home_team_id` (team membership) for coach path; otherwise 403.

## Database Saves

### Game

- `prisma.game.create` with: title, date, location, latitude, longitude, home_team, away_team, home_team_id, away_team_id, away_team_name, venue_place_id, venue_address, venue_lat, venue_lng, description, event_type, approval_status, created_by_id, approved_by_id, approved_at, etc.
- Coach-created: `approval_status = 'approved'`, `approved_by_id` set.

### Event

- `prisma.event.create` with: title, date, location, game_id, status: 'approved', capacity: null.
- Event inherits location from game; coords live on Game (`latitude`, `longitude`).

## Location & Map Visibility

Events appear on the map only if the game has valid `latitude` and `longitude`.

1. Client sends `autoGeocode: true` when a location string is provided.
2. Server geocodes `location` via Google Geocoding API and sets `gameData.latitude`, `gameData.longitude`.
3. If geocoding fails, server tries `getPlaceDetails(venue_place_id)` when `venue_place_id` is present and coords are still missing.
4. Map (`app/game-map.tsx`) filters items with `hasValidCoords` (non-null lat/lng).

## Visibility After Creation

| Surface | Source | Filter |
|---------|--------|--------|
| Feed | `Game.list('-date')` | `approval_status = 'approved'` |
| Map | `Game.list()` + `/events` | Items with valid lat/lng |
| Team page | `Game.list('-date')` filtered by team name | home_team/away_team match |
| Calendar | `Game.list()` filtered by followed teams | User follows one of the teams |

## Fan Blocking

- **UI**: Create modal shows "Create Event" only when `me?.preferences?.role === 'coach'`.
- **Screen**: `create-fan-event.tsx` loads user, checks role; if not coach, redirects to `/(tabs)`.
- **API**: `POST /games` returns 403 unless user is coach/admin of the team or admin.
