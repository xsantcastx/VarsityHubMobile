# Pro Sports Events & Team Pages — Design

Date: 2026-07-23
Status: Approved (owner, 2026-07-23)
Branch: `feat/pro-sports-events`

## Goal

Let fans check in and post from professional sporting events the same way they
already do at high school games: a pro game is a real event page with a venue,
a live window, and the existing geofenced posting gate.

Leagues in scope: NFL, NBA, WNBA, MLB, WWE.

## Product shape (owner decisions)

1. **Purpose is fan posting, not content browsing.** Pro events reuse the
   geofenced event-posting mechanic verbatim: 3km from the venue, live window
   `-1h → +3h` around start, first geofenced post writes an `EventPostingUnlock`
   row granting 7 days of grace. Nothing about that gate changes.
2. **Pro team pages are followable and read-only.** A page shows the schedule,
   fan posts from those events, and a follow button. No roster, no join, no
   membership, no team chat, no owner.

## Legal posture

This is the constraint that drives the data model, so it is written down rather
than assumed.

**Schedule data is not owned by the leagues.** Facts are not copyrightable
(_Feist v. Rural Telephone_), and _NBA v. Motorola_ (2d Cir. 1997) held the NBA
had no protectable interest in real-time game data. _C.B.C. v. MLBAM_ (8th Cir. 2007) reached the same result for player names and stats. The real exposure on
data is **contractual** — the terms of whoever supplies it. Therefore: source
schedules from a provider whose license permits display, never by scraping
league or broadcaster sites.

**Team names as text are nominative fair use.** _New Kids on the Block v. News
America_ (9th Cir.) permits using a mark to refer to the actual thing, provided
you use no more of the mark than necessary and do not imply sponsorship. Naming
"New York Yankees" to identify a game sits inside that. Outside it: league and
team **logos** (separately copyrighted and trademarked), wordmark artwork, and
full trade dress.

**Handles are the sharp edge.** A `@nyyankees` or `@wwe` username fails the
"no implication of sponsorship" prong by construction — on a social platform a
handle _is_ an identity claim — and adds impersonation exposure. Pro teams
therefore get **no handle in the `@username` namespace at all**, and the names
are added to a reserved-username blocklist so no fan can claim them either.

**Ownership is the structural version of the same hazard.** `Organization`
carries `league_owner_id` ("the user who owns/pays for this league page"). If
pro teams were `Organization`/`Team` rows, the schema would contain a mechanism
by which a user becomes the owner of the Lakers. It must not be possible to
reach that state, and "a boolean flag blocks it" is a weaker claim than "the
foreign key does not exist."

Consequent rules, all enforced below:

- No pro team username/handle; reserved blocklist prevents fan squatting.
- No league or team logos shipped or hotlinked. A single accent color is used
  for UI legibility — a lone color is not trade dress, and it is never paired
  with team wordmark art.
- Every pro team page and pro event page carries a persistent, visible
  "Unofficial — VarsityHub is not affiliated with or endorsed by {league}" line.
- A trademark/takedown contact path reuses the existing abuse-report surface.

None of this is legal advice; it is the engineering posture. Counsel should
review before launch.

## Architecture

### Pro games are `Event` rows, never `Game` rows

`Game` carries scores, `GameVote`, and the shared-game authority model that the
2026-07-14 authz audit flagged (an opponent can overwrite a score). Routing pro
games through `Game` would mean answering "who may edit this score?" for the
NBA and inheriting a live bug class, plus the score-licensing question — the one
part of sports data that genuinely gets contentious.

`Event` already carries everything the fan-posting flow needs: `date`,
`timezone`, `latitude`/`longitude`, `location`, `live_window_hours_after_start`,
and the posting gate. Pro games are `Event` rows. **VarsityHub stores no pro
scores.**

This also absorbs WWE cleanly: a touring show is an `Event` with a venue and no
team relation, which is how it would have to be modeled regardless.

### New entities

```
ProTeam         — thin, system-managed, unjoinable by construction
ProTeamFollow   — user ↔ pro team, the only user-facing relation
Event           — gains nullable pro_home_team_id / pro_away_team_id
                  + pro_external_ref (unique) for idempotent ingestion
```

`ProTeam` deliberately has **no** membership relation, **no** invite relation,
and **no** owner column. There is no code path by which a user attaches
themselves to a pro team, because the schema provides none.

### What is reused unchanged

`Event`, `Post`, `Story`, `EventPostingUnlock`, `EventDesignatedPoster`,
`server/src/lib/geofencing.ts`, feed injection, and the client's event-list and
post-list components. The pro team page composes existing components rather than
forking `app/team-page.tsx`.

### What is deliberately not touched

`Team`, `Organization`, `TeamMembership`, `TeamInvite`, `TeamFollow`, `Game`,
`GameVote`, group chats, and all 21 routes in `teams.ts`. Approach 1 (reusing
`Team` behind a `system_managed` flag) was rejected precisely because it would
have required auditing every one of those routes plus `team-memberships.ts` and
`team-invites.ts`, where a single missed guard is a user rostering themselves
onto the Lakers.

## Data flow

**Team + venue seed (static).** Franchise names, home venues, venue coordinates,
and IANA timezones are stable facts, checked into
`server/prisma/proTeams.ts` and applied by an idempotent upsert keyed on
`external_ref`. Re-running is safe.

**Schedule ingestion (dynamic).** A provider adapter fetches a league's schedule
and upserts `Event` rows keyed on `pro_external_ref`. Idempotent: re-running
updates dates and venues for postponed or relocated games rather than
duplicating. Venue coordinates resolve from the home `ProTeam`'s venue unless
the feed supplies a neutral-site venue. Per-league defaults set
`live_window_hours_after_start` (baseball and football run long; WWE shows are
tighter).

Ingestion is gated behind a provider API key in env. Without the key the job
no-ops with a clear log line rather than failing the boot.

**Reads.** `GET /pro-teams`, `GET /pro-teams/:id`, and follow/unfollow. The page
endpoint is guest-browsable, matching the `programs/:id/screen-summary`
precedent. `ProTeam` has no user-facing write surface at all.

## Error handling

- Ingestion is per-event transactional; one malformed record is logged and
  skipped rather than aborting the run.
- A game whose home team is missing from the seed is skipped and logged loudly —
  it means the seed is stale, and silently inventing a `ProTeam` would create an
  unreviewed name in the trademark surface.
- Missing provider key: no-op with a warning, not a crash.
- Postponed/cancelled upstream: the `Event` is updated in place; a cancelled
  game sets event status rather than deleting, so posts already attached survive.

## Testing

1. **Unjoinability** — assert no route mutates any user↔`ProTeam` relation other
   than `ProTeamFollow`, and that `ProTeam` exposes no membership/owner field.
2. **Reserved usernames** — league and franchise names are rejected at signup
   and at username change.
3. **Ingestion idempotency** — running the ingester twice over the same feed
   yields the same row count and no duplicate `pro_external_ref`.
4. **Geofence parity** — a pro `Event` goes through `geofencing.ts` with the same
   results as a school event; the gate is not special-cased.
5. **Backup table order** — `ProTeam` and `ProTeamFollow` are present in
   `TABLES_IN_ORDER` in `dbBackupTables.ts`. Omitting new models silently drops
   them from backups and reds CI on main and every PR.

## Rollout

1. Schema + migration + backup table order.
2. Seed teams and venues (no schedules — nothing user-visible yet).
3. Reserved-username blocklist.
4. Read endpoints + follow.
5. Ingest one league behind the key, verify a single event page end to end.
6. Remaining leagues.

## Open items requiring an owner decision

- **Provider selection and licensing.** SportsDataIO, Sportradar, API-Sports,
  and TheSportsDB all license schedule data. This is a purchasing decision and a
  ToS to read; the adapter is written against an interface so the choice is
  swappable.
- **Counsel review** of the disclaimer wording and overall posture before the
  feature is publicly enabled.
