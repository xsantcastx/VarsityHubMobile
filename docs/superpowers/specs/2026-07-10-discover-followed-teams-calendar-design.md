# Discover Calendar → Followed Teams Only

**Date:** 2026-07-10
**Status:** Approved design, pending implementation plan
**Area:** Discover screen calendar (`app/(tabs)/discover/mobile-community.tsx`), games list endpoint (`server/src/routes/games.ts`)

## Problem

The Discover calendar shows almost no event dots. Users assume it is scoped to
teams they follow — it is not. Today the calendar is driven by
`Game.list('-date')` → `GET /games?sort=-date`, which returns **all approved
games globally**, sorted by date **descending**, capped at the default **limit
of 20**. The 20 furthest-future games across the whole database fill the result,
then the client drops past games — so near-term events for the user's own teams
never reach the client. The calendar looks empty.

## Goal

Scope the Discover **calendar dots** and its **tap-a-date "Events on…" list** to
**upcoming events of teams the user follows**. Everything else on the screen —
the nearby-events map, the "Upcoming games near you" list, the zip-code chips,
and the search filter — stays global/nearby for discovery. Users find new teams
through the existing search bar, not the calendar.

### Decisions (locked)

- **Always followed-only.** No toggle, no tab coupling. The calendar only ever
  shows the user's followed teams.
- **Directly-followed teams only.** Scope is the viewer's `TeamFollow` rows.
  Following a **program** already fans out to `TeamFollow` rows (Phase 3), so
  program follows are included automatically. **Org follows are NOT included** —
  they affect the org page, not the calendar.
- **Calendar + its date list only.** The map, "near you" list, and zip chips
  keep using the existing global `games` array.
- **Upcoming only.** From today forward. No past games on the calendar.

## Non-goals

- No change to the map, the "Upcoming games near you" list, the zip chips, or
  unified search.
- No new `Following`/`Discover` tab behavior (the existing tabs drive posts, not
  the calendar).
- No org-follow expansion into team events.
- No new first-class endpoint — reuse `GET /games`.

## Architecture

### Server — `server/src/routes/games.ts` (`gamesRouter.get('/')`)

Add a `following=true` query param handled inside the existing list handler so
serialization, RSVP counts, distance, sort, limit, and cursor are all reused.

Behavior when `following=true`:

1. **Guest (no auth):** return `res.json([])` (200). This is a public read that
   is simply empty for signed-out users — not a 403.
2. **Authed:** load the viewer's followed team IDs:
   ```ts
   // audit-allow unbounded: calendar scope needs every team the viewer follows
   const followed = await prisma.teamFollow.findMany({
     where: { user_id: authedReq.user.id },
     select: { team_id: true },
     take: 500,
   });
   ```

   - Empty set → return `res.json([])` (200).
   - Otherwise constrain results to games on those teams by pushing an OR into
     `whereClause.AND` (mirrors the existing `team_id` filter so it never
     collides with other `OR` clauses):
     ```ts
     if (!whereClause.AND) whereClause.AND = [];
     whereClause.AND.push({
       OR: [{ home_team_id: { in: followedTeamIds } }, { away_team_id: { in: followedTeamIds } }],
     });
     ```
3. Keep the public approval filters already applied on the approved path:
   `approval_status = 'approved'` and
   `opponent_approval_status in ('not_required', 'approved')`.
4. **Cache:** exclude `following=true` from the games cache so a brand-new follow
   is reflected immediately:
   `const shouldUseGamesCache = !wantsNonApproved && !following;`

`following=true` is a public (approved-only) read, so `wantsNonApproved` stays
false and the coach-scoping `OR` branch does not run — no interaction with the
followed-team `AND` clause.

### Client — `api/entities.ts`

Add `following?: boolean` to `Game.list`'s `options`; when true append
`following=true` to the query string. No other change to `Game.list`.

### Client — `app/(tabs)/discover/mobile-community.tsx`

1. **New query** alongside the existing `discover-games`:
   ```ts
   queryKey: ['discover-followed-games', user?.id ?? 'guest']
   queryFn: () => Game.list('date', {
     following: true,
     dateFrom: <today ISO>,   // ascending from today
     limit: 100,
   })
   ```
   Filter past games client-side for parity with the existing query. Derive
   `const followedGames = followedGamesData ?? [];`.
2. **Re-point two consumers** from `games` to `followedGames`:
   - Calendar `markedDates` memo (currently `games.forEach`, ~line 1709).
   - Selected-date "Events on…" list (currently `games.filter`, ~line 1771).
     All other consumers (`zipDirectory`, `filtered`, the map, the "near you"
     list) remain on the global `games` array — unchanged.
3. **Empty state:** when `followedGames.length === 0` and not loading, render a
   one-line helper under the calendar, e.g.:
   > "You're not following any teams yet — search above to find and follow
   > teams, and their games show up here."
   > This covers both guests and signed-in users who follow nothing (the fourth
   > of the loading/error/success/empty states for this section).
4. **Live update:** in the follow/unfollow handler used by the unified search
   results (~line 1265), invalidate the new query:
   `queryClient.invalidateQueries({ queryKey: ['discover-followed-games', user?.id ?? 'guest'] })`
   so following a team from search updates the calendar without an app restart.

## Data flow

```
Discover screen mount
  → useQuery ['discover-followed-games']
    → Game.list('date', { following:true, dateFrom:today, limit:100 })
    → GET /games?sort=date&from=<today>&following=true&limit=100
      → server: whereClause.approval_status='approved'
                 + opponent_approval in (not_required,approved)
                 + AND[ OR(home∈followed, away∈followed) ]   (authed, non-empty)
                 | []                                          (guest or no follows)
      → serialized games (asc by date)
  → client filters past → followedGames
  → calendar markedDates + selected-date list read followedGames
Follow/unfollow in search → invalidate ['discover-followed-games'] → recompute
```

## Error / edge handling

- Guest or zero follows → `[]` → calendar renders with no dots + empty-state
  helper. No error surface.
- `following=true` never exposes unapproved or opponent-pending games (public
  filters retained).
- More than 100 upcoming games across all followed teams: dots beyond the 100th
  nearest do not render. Acceptable for realistic follow counts; documented here
  rather than silently assumed.
- Query failure falls back to the existing games-error card behavior pattern
  (cached list stays visible; error card only when it never loaded).

## Testing

**Server** (extend the games-list test suite):

- `following=true` returns only games where a followed team is home OR away.
- Guest + `following=true` → `[]` (200, not 403).
- Authed with zero follows → `[]`.
- `following=true` still excludes `approval_status != 'approved'` and
  opponent-pending games.

**Client / end-to-end** (per repo verification norms — drive the real app):

- Follow a team → its upcoming game gets a calendar dot and appears under its
  date; the map and "near you" list are unaffected.
- Unfollow → the dot disappears (query invalidation).
- New user following nothing → empty-state helper shows, no crash.

## Rollout / risk

- **Server** change deploys on push to `main` (Railway auto-deploy). The added
  branch is additive and gated behind `following=true`; existing `/games`
  callers are unaffected.
- **Client** change is **not live until `eas update --branch production`** —
  committing/pushing does not update the app binary's JS bundle. Must be called
  out at hand-off.
- No schema change, no migration.
- Reversible: revert the client query swap and the server branch; no data
  migration to undo.
