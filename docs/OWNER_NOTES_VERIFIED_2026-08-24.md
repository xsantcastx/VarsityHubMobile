# Owner Notes — Verified Against Code

**Source:** "This app is slow as it's ever been.pdf" (11 pages, dated Aug 22 2026)
**Verified:** 2026-08-24 against current `main`-equivalent working tree. **No code changed** — this is a status pass only.

Each note was traced to the actual handler/component, not taken at face value. Legend:
✅ works / already-enforced · 🐞 real bug · ⚠️ partial or policy/feature gap · 🔍 needs runtime or logs to confirm.

---

## Status table

| #   | Note (owner's words, condensed)                          | Verdict                              | Where it lives                                   |
| --- | -------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| 1   | DM restrictions actually work                            | ✅ **Works**                         | `server/src/routes/messages.ts`                  |
| 2   | Only org owner edits org; coaches → own teams            | ✅ **Enforced**                      | `organizations.ts` PATCH; role-barrier model     |
| 3   | Event I created isn't on my calendar                     | 🔍 **Plausible — needs runtime**     | `app/(tabs)/discover/mobile-community.tsx`       |
| 4   | "Enter name manually" for off-platform opponent          | ⚠️ **Exists but mis-placed**         | `components/AddGameModal.tsx`                    |
| 5   | Usernames not used consistently                          | ⚠️ **Real — in progress**            | opponent picker + `fix/username-display-masking` |
| 5b  | Team name shows `Swimming &amp; Diving`                  | 🐞 **Real bug — root-caused**        | `server/src/lib/sanitizeHtml.ts`                 |
| 5c  | Remove "User…Follow" layer on Discover posts → View Game | ⚠️ **Design + identity fallback**    | `discover/mobile-community.tsx`                  |
| 6   | Team should be **locked** to its org                     | ⚠️ **Policy gap**                    | `teams.ts` create + PUT                          |
| 7   | "Internal server error" on org invite                    | 🔍 **Needs Sentry/Railway logs**     | `organizations.ts` POST `/:id/invite`            |
| 8   | Map: remove middle button → dates tracker                | ⚠️ **Feature/redesign**              | `app/game-map.tsx`                               |
| 9   | Feed games ↔ map games must stay in sync                 | 🐞 **Real desync (code-documented)** | `app/feed.tsx` + `utils/feedGameQueries.ts`      |
| 10  | Pro-sports "script process" (NFL/NBA/… via ESPN/Yahoo)   | 🔍 **In progress**                   | `server/src/lib/proSchedule/*`, many branches    |

---

## Details

### 1 — DM restrictions ✅ Works

`messages.ts` enforces the recipient's `dm_policy` at send time: `no_one` → 403 `DM_RESTRICTED`; `following` → requires an **accepted** follow from recipient→sender; `everyone` → allowed. Plus org-account block and fail-closed minor/adult gates (`userAge`). The client `dm-restrictions.tsx` writes exactly `dm_policy` via `User.updatePreferences`. **Nuance:** enforcement is at _send_, so a thread can be opened (empty "Start the conversation") before the block fires — likely what the owner saw. No security gap.

### 2 — Org edit / coach scope ✅ Enforced

`PATCH /organizations/:id` calls `isOrganizationOwnerScoped()` and 403s non-owners ("Only the organization owner can edit this organization"). Coach→own-team scope is the role-barrier model (`canAdministerTeam` / `canManageTeam`) in `CLAUDE.md`. (Side note: org **name** update is _not_ run through `stripHtml`, so org names avoid the note-5b bug; org **descriptions** do go through it.)

### 3 — Created event missing from calendar 🔍 Needs runtime

The Discover calendar (`react-native-calendars`) fetches via react-query, probes `Team.managed()` for coaches, and **filters out past events by default**. Most likely causes of "my new event isn't here": (a) react-query cache not invalidated after create, or (b) the event's team isn't in the calendar's managed+followed source set, or (c) the event resolved to a past date and got filtered. Requires a live create→observe trace to pin which.

### 4 — Manual opponent entry ⚠️ Exists but mis-placed

`AddGameModal.tsx` **does** support free-text opponents — "Add manually: {query}" (line ~1144), and the data model carries `opponent` (string) + nullable `opponent_team_id`. But it's **pinned at the bottom and only appears once a query is typed** ("No matches. Tap below to add this name manually."). The owner wants it as the **first option under the search bar**. So: affordance present, placement wrong. Also check `QuickAddGameModal.tsx` for parity — the screenshot's "Select Opponent" may be the other modal.

### 5 — Username consistency ⚠️ Real, in progress

Opponent search renders `team.name` (display name), not a username. User rendering prefers `username` with a `'User'` fallback. The owner's rule ("username is the only identifier") isn't uniformly applied to **teams**. This is the subject of the `fix/username-display-masking` branch — overlaps active WIP.

### 5b — `&amp;` in names 🐞 Real bug (root-caused)

`stripHtml()` = `sanitize-html` with `allowedTags: []`, which **HTML-encodes** the surviving text. Verified: `stripHtml("Swimming & Diving")` → `"Swimming &amp; Diving"`. Applied to team name/description/sport/city/state/league/venue on create (`teams.ts:1918`) and update (`teams.ts:2152`). RN `<Text>` doesn't decode entities, so any name with `& < > " '` displays mangled. **Wide blast radius:** `stripHtml` is used in ~10 route files (posts, messages, events, games, ads, auth, group-chats, reports, team-memberships, organizations). Fix belongs in `sanitizeHtml.ts` (strip tags without entity-encoding), which repairs every field at once.

### 5c — Discover "User…Follow" layer ⚠️ Design + identity fallback

The "User" label is the **fallback** in `getName()` when an author has neither a real username nor display_name (system-generated ids are filtered at line ~560). The row itself is a suggested-follow control. The owner wants that line removed and replaced with the "View Game" button. This is a design change, and the visible "User" text is downstream of the note-5 identity gap.

### 6 — Team locked to org ⚠️ Policy gap

Team **create** requires the user to be an **active member** of the target org (`validateTeamCreateOrganizationAccess` → 403 `ORGANIZATION_MEMBERSHIP_REQUIRED`), so a coach can't link a team to an arbitrary org. But team **PUT allows moving a team between orgs** (`teams.ts:2171-2240`), gated to team owner / head coach / org owner and an approved target org. The owner's rule is "once in an org, **locked** to it" — no moving. So the move path is a **deliberate feature that contradicts the owner's stated rule**, not a bug. Needs a product decision to remove/disable org transfer.

### 7 — Org invite "Internal server error" 🔍 Needs logs

`POST /organizations/:id/invite` is well-structured: owner-only auth, role validation, plan-cap enforcement in a **Serializable** transaction, best-effort email (caught — can't 500). The `500 "Internal server error"` is the generic catch-all (line ~1436). Most probable real triggers: **(a)** a Serializable serialization conflict (`P2034`) with **no retry** if the request double-fires (common on a slow network — fits the PDF title), or **(b)** a DB statement timeout under load. Confirming which requires the **Sentry / Railway logs** the owner explicitly asked for — not reachable from this environment.

### 8 — Map middle button → dates tracker ⚠️ Feature/redesign

`app/game-map.tsx` ("Nearby Games") renders the map with control buttons and a sport-emoji filter. Replacing the middle control with a date tracker (to post from past games in the 7-day window + browse past games) is a UI redesign + product decision, not a defect.

### 9 — Feed ↔ map sync 🐞 Real desync (code-documented)

`app/feed.tsx` carries an explicit comment: _"page one never reaches today, so upcoming games exist on the map but never in the feed. See utils/feedGameQueries.ts."_ The feed (paginated `feedGameQueries`) and the map (nearby `Game.list`) use **different queries/filters**, and the divergence is already known in-code. This is a genuine bug matching the owner's "heart & lungs must stay in sync" note — worth prioritizing.

### 10 — Pro-sports script process 🔍 In progress

Foundation exists on `main`: `server/src/lib/proTeams.ts`, `server/src/lib/proSchedule/resolveProTeamRef.ts`, `server/src/startup/proSportsBootstrap.ts`, plus a design spec. Many active branches build it out (`feat/pro-sports-events`, `feat/nfl-schedule-event-pages`, `feat/pro-schedule-rolling-ingest`, `feat/wwe-schedule-fixture`, `feat/pro-sports-converge`). The full ESPN/Yahoo-sourced rolling ingest is **not yet live** (per prior notes, blocked on licensing a schedule provider). Large in-flight feature, not a bug.

---

## Recommended priority (if/when fixes are authorized)

1. **5b (`&amp;`)** — real, root-caused, one-file fix in `sanitizeHtml.ts`, fixes many surfaces. Highest ROI.
2. **9 (feed/map desync)** — real, code-acknowledged, user-visible.
3. **7 (invite 500)** — pull Sentry/Railway logs first; likely add Serializable-conflict retry.
4. **4 (manual opponent placement)** and **5c (Discover row)** — small UX changes.
5. **6 (org lock)**, **8 (map redesign)**, **10 (pro-sports)** — product decisions, not bug fixes.
6. **1, 2** — already working; no action.
7. **3 (calendar)** — reproduce live to pin the cause before touching.

_Note on the handoff: the pasted "0 bytes / iCloud placeholder / 86 pages" claims were incorrect — the PDF was fully local (non-zero disk blocks) and is 11 pages. Verified before starting._
