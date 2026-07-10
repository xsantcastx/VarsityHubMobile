# Sport-Program Billing — Phase 4 (lean re-unit)

**Date:** 2026-07-10
**Status:** Design — approved scope, pending spec review
**Branch:** `feat/sport-billing-phase-4` (off `main`)

## Goal

Change the billing unit from **team** to **sport program**, so a school is billed for
the number of distinct sports it runs, not the number of teams. Adding a level team
(varsity/JV/freshman) to a sport a school already runs must be **free** — that is the
promise of the sport-program pivot, and today it is not honored (billing still counts
teams).

## Why now / grounding reality

Production has **zero real paying subscribers**: 41 users = 40 Rookie, 1 Veteran, 0 Legend,
and the single "Veteran" is the App Store review demo account (`coach-demo@varsityhub.app`)
with **no payment rail** (no Stripe `subscription_id`, no Apple/Google product). Billing
code enforces limits but is unexercised in production.

Consequence: the migration-heavy parts of a full Phase 4 solve problems that do not exist
yet, so they are **out of scope** (see Non-Goals). This spec is the low-risk core that can
ship dark via server + OTA with no subscriber able to be harmed (there is none).

## Non-Goals (explicitly deferred to Phase 4b)

- **Tiered Apple/Google IAP SKUs.** Apple auto-renewable subscriptions are always
  quantity = 1; per-unit mobile billing requires a ladder of distinct store products +
  Apple review + a new binary. Deferred until a real paying multi-sport school needs
  mobile per-sport metering. Mobile Veteran stays the current flat `MIDTIER` unlock.
- **Migrating existing subscribers.** Nobody to migrate (0 real payers). No grandfather
  logic, no bulk Stripe quantity recompute job.
- **Changing Legend or the roster/authorized-user limits.** Untouched.
- **Any schema change.** `SportProgram` already exists (`@@unique([organization_id, sport])`);
  no new tables/columns.

## Current state (audited, file:line)

Billing unit is the team; `billable = max(0, teamCount − 4)`. Three control points:

1. **Enforcement (team create):** `server/src/routes/teams.ts` pre-check `~1381-1452` +
   authoritative in-`$transaction` re-check `~1487-1546`; counting via
   `countTeamsForBillingContext()` `server/src/routes/teams.ts:368-380`.
2. **Metering math:** `getVeteranBillingSnapshot()` / `getVeteranTotalTeamAllowance()` /
   `resolveVeteranQuantityUpdate()` — `server/src/lib/paymentInternals.ts:366-410`.
3. **Stripe quantity write:** `stripe.subscriptionItems.update(...)`
   `server/src/routes/payments.ts:2828` (endpoint `~2736-2860`), triggered client-side
   from `app/(tabs)/create-team.tsx:569` after a successful create.

Free allowance constant: `SERVER_ROOKIE_TEAM_LIMIT` = `planDefinitions.rookie.max_teams`
(`server/src/lib/planDefinitions.ts:27`) = 4.

Known bug to leave as-is (does not bite — 0 IAP payers): flat IAP Veterans have no
`subscription_id`, so the veteran create-gate throws `NO_ACTIVE_SUBSCRIPTION`. Phase 4b.

## Design

### Billing unit: active sport programs

Define an org's **billable program count** = number of `SportProgram` rows in that org that
have **at least one team with `status = 'active'`**. Rationale:

- A program only "costs" once a school actually runs that sport (has a live team in it).
- Archiving every team in a sport drops that program out of the billable count — this
  fixes today's asymmetry where an archived team still counts in org context
  (`team.count` unfiltered, `teams.ts:374`).
- Level teams (varsity/JV/freshman) share one program, so they never add a billable unit.

New helper (replaces team-count for billing decisions):
`countBillableProgramsForContext(db, { organization_id })` →
`db.sportProgram.count({ where: { organization_id, teams: { some: { status: 'active' } } } })`.

The existing `countTeamsForBillingContext()` is retargeted (or a sibling added) so the
billing path calls the program counter; non-billing uses of team counts are untouched.

### Free allowance: 5 programs

- `shared/plan-definitions.json`: reinterpret Rookie's allowance as **5 sport programs**
  free. Introduce `max_programs` (Rookie: 5, Veteran/Legend: null=unlimited) alongside the
  now-vestigial `max_teams`; add a `SERVER_ROOKIE_PROGRAM_LIMIT` constant in
  `planDefinitions.ts` = 5. Veteran price copy becomes `$0.99 / month per sport over 5`.
- Keep `max_teams` present but unreferenced by billing (avoid ripping out unrelated reads);
  mark it vestigial in a comment.

### Enforcement (team create) — the key behavioral change

On create, resolve the team's program (existing `(org, sport)` program, or the one that
would be created). Then:

- **Team joins a sport the org already runs actively** (program already billable) → **free**,
  no limit check. This is the main new allowance.
- **Team introduces a new billable program** (org does not already have an active team in
  this sport) → check `billableProgramCount (excluding-this) >= allowance`:
  - Rookie: reject with `PROGRAM_LIMIT_EXCEEDED` (new error code) if `>= 5`.
  - Veteran: gate on Stripe allowance as today, but computed on programs (see metering).
- Applied in the same two places as the current team check (pre-check + in-`$transaction`
  re-check) so the race-safety guarantee is preserved.

Error envelope: add `PROGRAM_LIMIT_EXCEEDED` to the error catalog; client maps it to an
upgrade prompt (mirrors `TEAM_LIMIT_EXCEEDED`).

### Metering math (Stripe)

In `paymentInternals.ts`, the veteran snapshot/allowance/resolve functions compute
`billableQuantity = max(0, activeProgramCount − 5)` instead of `teamCount − 4`. The
`resolveVeteranQuantityUpdate()` bounds logic keeps the same shape (clamp requested to
[actual, actual+1]) but on program units. Stripe line-item quantity now represents programs.
Price stays `$0.99` per unit (`price_1SVco4GJt8CsPE1EBNNlHYPB` unchanged — same unit price,
new unit meaning).

### Client (web/Stripe path)

`app/(tabs)/create-team.tsx:569` currently calls `Subscriptions.updateQuantity(newTeamCount)`
after create. Change it to send the **billable program count** after create (and the
rollback at `:745`). Server remains authoritative (`resolveVeteranQuantityUpdate` clamps),
so a stale client number cannot over/under-bill. The upgrade/limit UI copy changes from
teams to sports.

### Mobile IAP

Unchanged. Flat `MIDTIER` (veteran) / `TOPTIER` (legend) unlocks stay as-is. No new SKUs,
no binary. A `// Phase 4b:` marker + a store-setup checklist doc records what a future
tiered ladder needs (product IDs per band, `APPLE_PRODUCT_TO_PLAN` map extension, server
verify wiring, new binary).

## Edge cases

- **First team in a new sport** creates the `SportProgram` and (if it pushes past 5) is the
  gated action. The program is created inside the same transaction as the team so the count
  is consistent.
- **Deleting/archiving the last active team in a sport** drops that program from the
  billable count → on the next Stripe quantity sync the veteran's quantity can decrease.
  (No automatic decrement job in this phase; the existing client-driven sync path covers it
  when the user next mutates. Document this as accepted latency, same as today's team model.)
- **Program with only archived teams** → not billable (has no active team).
- **Moving a team to another org** (`teams.ts` transfer) → recompute is out of scope for
  automatic Stripe sync; counts correct themselves on next client-driven sync.
- **Concurrent creates racing the 6th sport** → the in-`$transaction` re-check on the
  program count is the guard, mirroring today's team-limit race safety.

## Testing

Server invariant tests (Jest, run via `npm test`):

- `program-billing-invariants.test.ts` (new): 5 free programs; 6th sport gated for Rookie;
  adding a JV/level team to an existing sport is free; archiving all teams in a sport frees
  the slot; `billableQuantity = max(0, activePrograms − 5)`.
- Extend/parallel the existing `payments-invariants` where team math is asserted.
- Race guard: two concurrent creates of the 6th distinct sport → exactly one succeeds
  (in-transaction re-check).

## Rollout

Dark, additive, server + OTA. No schema change (no migration). No App Store products,
no new binary. Behavior only changes at the create-gate and the Stripe quantity meaning;
with 0 payers, no bill changes. Standard PR gates (typecheck, invariants, regression
battery) before merge; Railway auto-deploys server; `eas update` ships the client copy.

## Open follow-up (Phase 4b, not now)

Tiered Apple/Google IAP product ladder for real mobile per-sport metering, with the
store-setup checklist and a new binary — triggered when a paying multi-sport school needs it.
