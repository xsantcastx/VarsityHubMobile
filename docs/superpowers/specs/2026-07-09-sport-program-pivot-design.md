# Sport-Program Pivot — Design Spec

**Date:** 2026-07-09
**Status:** Approved direction; Phase 0+1 plan written; Phases 2–4 planned later
**Prerequisite shipped:** PR #152 (athlete self-join removed; teams hold staff only)

## Product decision

VarsityHub reorganizes from **flat teams** to **sport programs**:

- An Organization (school/club/league) contains **Sport Programs**.
- A program = **sport + gender** ("Girls Basketball"). Stamford HS ≈ 25–30 programs, not 50 teams.
- Each program contains **level teams** (folders): `varsity | jv | freshman | middle_school | unified | other`.
- The public "team page" becomes **one page per program**, with levels as folder-like sections inside — JV never gets its own discoverable page.
- **Billing counts programs, not teams.** Rookie's free allowance and Veteran's metered unit become sport programs. Level teams inside a program are free.
- Group-chat model deferred (default assumption: keep per-level chats — zero migration).

## Why (from the six audits, all 2026-07-09)

1. **Scale reality:** a real high school = 50 teams / 800+ games / 3 seasons. Every team switcher and the org page render flat, unsearchable lists; season-stats uses horizontal chips. All break well before 50.
2. **Billing rails asymmetry:** the "$0.99/mo per team over 4" unit exists ONLY as Stripe subscription-item `quantity`. Apple/Google sell flat SKUs (`MIDTIER`/`TOPTIER`) with no quantity — and IAP-only Veterans never get a `subscription_id`, so the server's Veteran gate (`getVeteranSubscriptionAllowance`, Stripe-only read) blocks their 5th team today. Changing the unit is concentrated in ~6 Stripe functions + 2 count gates; IAP rails are untouched.
3. **Onboarding is unaffected:** coach onboarding ends at org creation; team creation is optional and post-onboarding; sport is never collected during onboarding.
4. **No sports taxonomy exists:** sport is a hardcoded 9-item array in create-team + free string server-side. Cannot bill on free text — taxonomy is prerequisite #1.
5. **`team_id` is the flat consumer key in 6 stores:** `TeamFollow`, `Post.team_id` + game indirection, `Game.home/away_team_id`, `GroupChat.team_id`, `Notification.meta.team_id`, org team lists. The public team page never renders `sport` at all.
6. **Coach gating is program-agnostic:** all coach tools funnel through `canAccessCoachTools` (role+approval+org+agreement) — no team-count in the gate. The Discover Quick Actions rail is the de-facto coach home. Ads/DMs/notifications are role-neutral. `org_type` is cosmetic (no branching) — no collision risk.

## Architecture: group, don't re-key

**The load-bearing rule: existing `team_id` keys are never migrated.** Level teams remain `Team` rows with their ids, games, posts, follows, and chats intact. The pivot ADDS a grouping layer:

```
Organization 1─* SportProgram 1─* Team (level team)
```

- `SportProgram { id, organization_id, sport (canonical slug), gender (boys|girls|coed), name?, logo_url? }`, unique on `(organization_id, sport, gender)`.
- `Team.program_id` (nullable FK) + `Team.level` (enum, nullable). Additive migration only.
- Public program page aggregates its level-teams at read time (follower union, games per folder, posts across level ids). Old `/teams/:id` deep links resolve to the program page's folder via id-aliasing.

## Phases

- **Phase 0 — Sports taxonomy** (shared canonical list, server validation, client picker source). Valuable standalone.
- **Phase 1 — Schema grouping** (SportProgram + Team.level/program_id, program CRUD, backfill script with name heuristics: "JV Girls Soccer" → soccer/girls/jv). Ships dark — no UX change yet.
- **Phase 2 — Coach UX regrouped** (manage-teams/switchers group by program; create flow = "create program + levels"; Quick Actions entry).
- **Phase 3 — Public program pages** (folders UI, follower union, deep-link aliasing, sport finally rendered; chat decision made here).
- **Phase 4 — Billing re-unit LAST** (Stripe quantity = billable programs; `countTeamsForBillingContext` → count programs; ordinal locking by program; grandfather existing per-team subscribers; resolve the IAP Veteran hole explicitly; update plan-definitions copy + App Store disclosure card).

Phase ordering rationale: billing last because it is least reversible and depends on clean, backfilled program data; taxonomy first because everything depends on it.

## Decisions log

| Decision       | Choice                                               | Notes                                                |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Program axis   | sport + gender                                       | matches school reality and search behavior           |
| Levels         | enum varsity/jv/freshman/middle_school/unified/other | covers Stamford incl. unified; club orgs use `other` |
| Billing unit   | sport programs (metering concept carried over)       | price points TBD at Phase 4; IAP hole resolved then  |
| Chats          | deferred                                             | default keep per-level; revisit at Phase 3           |
| Existing teams | grandfathered via backfill                           | heuristic + coach confirmation; no data re-keying    |

## Out of scope (tracked separately)

Archived teams never freeing billing slots; 30-game bulk-create cap / no schedule import; no bulk-approve for org admins; vestigial "50/100 athletes" plan copy; season-stats "players" tab post-staff-only.
