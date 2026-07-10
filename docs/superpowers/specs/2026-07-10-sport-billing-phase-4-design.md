# Sport-Program Billing — Phase 4 (lean re-unit, cross-platform)

**Date:** 2026-07-10
**Status:** Design — approved scope, pending spec review
**Branch:** `feat/sport-billing-phase-4` (off `main`)

## Goal

Change the billing unit from **team** to **sport program**, so a school is billed for the
number of distinct sports it runs, not the number of teams. Adding a level team
(varsity/JV/freshman) to a sport a school already runs must be **free** — the promise of the
sport-program pivot, not honored today (billing still counts teams). This must be correct on
**web, iOS, and Android**, each of which uses a different payment rail.

## Why now / grounding reality

Production has **zero real paying subscribers**: 41 users = 40 Rookie, 1 Veteran, 0 Legend,
and the single "Veteran" is the App Store review demo account (`coach-demo@varsityhub.app`)
with **no payment rail** (no Stripe `subscription_id`, no Apple/Google product). Billing code
enforces limits but is unexercised — so this change cannot harm a subscriber (there is none),
and the migration-heavy parts of a full Phase 4 solve problems that don't exist yet.

## Per-platform payment model (the core of "accurate for web/iOS/Android")

Subscriptions use a **different rail per platform** — decided client-side in
`app/subscription-paywall.tsx:147-247` and `app/settings/manage-subscription.tsx:178-236`:

| Platform    | Subscription rail                                   | Veteran =                                                                            | Metering                      |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| **Web**     | Stripe PaymentSheet                                 | metered: 5 free programs + `$0.99/mo` per program over 5 (Stripe line-item quantity) | per-program (Stripe quantity) |
| **iOS**     | Apple IAP, flat `MIDTIER` (`hooks/useIAP.ts:41-44`) | flat unlock → **unlimited programs**                                                 | none (flat SKU)               |
| **Android** | Google Play Billing, flat `MIDTIER`                 | flat unlock → **unlimited programs**                                                 | none (flat SKU)               |

Rationale: Apple auto-renewable subscriptions are always quantity = 1 and Play subs likewise
carry no per-unit dial, so on mobile a flat `MIDTIER` Veteran can only mean **unlimited
programs**. This is the same web-meters / mobile-flat asymmetry that already exists for teams;
it is inherent to the platform payment constraints, not a new choice. Legend ($19.99/yr,
unlimited) already undercuts a metered Veteran for large schools on every platform.

**Compliance (must not break):**

- **iOS shows no Stripe** for subscriptions (`subscription-paywall.tsx:148`) — Apple IAP only.
- **Android subscriptions stay on Play Billing** — never routed to Stripe (Play policy).
- **Per-program price copy (`$0.99/sport`) appears only on the web/Stripe paywall.** iOS/Android
  paywalls show the flat "Veteran — unlimited sports" IAP offer, no per-unit price.
- **Ads are an orthogonal rail** (iOS = Apple IAP `ad-calendar.tsx:654`; Android + web = Stripe
  `ad-calendar.tsx:676`) and are **untouched** by this re-unit.

## Current state (audited, file:line)

Billing unit is the team; `billable = max(0, teamCount − 4)`. Control points:

1. **Enforcement (team create):** `server/src/routes/teams.ts` pre-check `~1381-1452` +
   authoritative in-`$transaction` re-check `~1487-1546`; counting via
   `countTeamsForBillingContext()` `teams.ts:368-380`. Billing context built at `teams.ts:321-366`
   (`effectiveSubscriptionId = prefs.subscription_id`, Stripe-only).
2. **Metering math:** `getVeteranBillingSnapshot()` / `getVeteranTotalTeamAllowance()` /
   `resolveVeteranQuantityUpdate()` — `server/src/lib/paymentInternals.ts:366-410`.
3. **Stripe quantity write:** `stripe.subscriptionItems.update(...)` `payments.ts:2820` (endpoint
   `~2736-2860`), triggered client-side from `app/(tabs)/create-team.tsx:569` (inside
   `if (userPlan==='veteran')`, no platform guard).
4. **Limits endpoint:** `GET /teams/limits` `teams.ts:551-616`.

Free allowance constant: `SERVER_ROOKIE_TEAM_LIMIT` = `planDefinitions.rookie.max_teams`
(`planDefinitions.ts:27`) = 4.

**Cross-platform bug this phase MUST fix (not defer):** the veteran gate requires a Stripe
`subscription_id` (`teams.ts:1507-1519`) and never falls back, so an **Apple/Google IAP
Veteran is blocked from creating any team** — `/limits` returns `max_teams=owned`,
`can_create_more=false` (`teams.ts:576-580`). A fresh IAP Veteran (0 teams) is blocked from
their first team. There is currently **no path that treats an IAP veteran as unlimited**.

## Design

### Billing unit: active sport programs

An org's **billable program count** = `SportProgram` rows in that org having **at least one team
with `status='active'`**:
`db.sportProgram.count({ where: { organization_id, teams: { some: { status: 'active' } } } })`
(new helper `countBillableProgramsForContext`). Level teams share one program, so they never add
a unit; archiving every team in a sport drops that program from the count (fixing today's
unfiltered `team.count` asymmetry, `teams.ts:374`).

### Free allowance: 5 programs

`shared/plan-definitions.json`: add `max_programs` (Rookie: 5, Veteran/Legend: null=unlimited)
alongside the now-vestigial `max_teams`; add `SERVER_ROOKIE_PROGRAM_LIMIT = 5` in
`planDefinitions.ts`. Veteran web copy: `$0.99 / month per sport over 5`.

### Enforcement (team create) — per rail, server-authoritative

Resolve the team's program (existing `(org, sport)` or the one to be created), then by
**effective plan** (`getEffectiveEntitledPlan`, server-side):

- **Team joins a sport the org already runs actively** → **free**, no check (all platforms).
- **Team introduces a new billable program:**
  - **Rookie** (any platform): reject `PROGRAM_LIMIT_EXCEEDED` if `billableProgramCount ≥ 5`.
  - **Veteran — Stripe** (`subscription_id` present): allowance = `5 + stripeQuantity`; gate as
    today but on programs.
  - **Veteran — IAP** (`plan='veteran'`, active `apple_product_id`/`google_product_id`, no
    `subscription_id`): **unlimited programs — allow.** _(This is the bug fix; the veteran
    branch must no longer throw `NO_ACTIVE_SUBSCRIPTION` for a valid IAP entitlement.)_
  - **Legend**: unlimited (any platform).
- Applied in both the pre-check and the in-`$transaction` re-check (race safety preserved).
- New error code `PROGRAM_LIMIT_EXCEEDED` added to the catalog; client maps it to the upgrade
  prompt (mirrors `TEAM_LIMIT_EXCEEDED`).

### Limits endpoint (`GET /teams/limits`)

Rework for programs and per-rail veteran:

- Rookie → `max_programs=5`, `can_create_more = billableProgramCount < 5`.
- Veteran IAP → **unlimited** (`can_create_more=true`, no per-unit price). Fixes the
  `max_teams=owned / can_create_more=false` freeze.
- Veteran Stripe → `5 + stripeQuantity`, metered.
- Legend → unlimited.
  Response gains program-oriented fields; keep legacy team fields populated for back-compat until
  the client fully switches (avoid breaking older bundles).

### Metering math (Stripe / web only)

`paymentInternals.ts` veteran snapshot/allowance/resolve compute
`billableQuantity = max(0, activeProgramCount − 5)`. Same clamp shape in
`resolveVeteranQuantityUpdate()`, on program units. Price unchanged
(`price_1SVco4GJt8CsPE1EBNNlHYPB`); the Stripe unit now means "program."

### Client

- **`create-team.tsx:569` `updateQuantity` must be guarded to the Stripe path only** — call it
  only when the veteran has a Stripe `subscription_id` (equivalently web / non-IAP). Otherwise
  the server 400s (`payments.ts:2789`). Send the **billable program count**, not team count
  (and the rollback at `:745`). Server remains authoritative (clamps), so a stale client number
  cannot mis-bill.
- **Paywall + limit copy platform-aware:** web/Stripe shows "5 sports free, then $0.99/mo per
  sport"; iOS/Android show flat "Veteran — unlimited sports" via IAP (no per-unit price, no
  Stripe). Upgrade routing already branches by `Platform.OS`
  (`subscription-paywall.tsx:147-247`) — only the copy/units change (teams → sports).

### Mobile IAP

Flat `MIDTIER` (veteran) / `TOPTIER` (legend) unchanged as products. `MIDTIER` now entitles
**unlimited programs** (server gate change above) — no new SKUs, no binary, no store review.
A `// Phase 4b:` marker records the future tiered ladder (per-band product IDs, verify wiring,
new binary) for when a paying multi-sport mobile school needs true per-sport metering.

## Non-Goals (deferred to Phase 4b)

- **Tiered Apple/Google IAP SKUs** (real per-program metering _on mobile_). Mobile stays flat
  unlimited until a paying school needs banding.
- **Migrating/grandfathering existing subscribers** — none exist.
- **Schema changes** — `SportProgram` already exists; nothing new.
- **Legend, roster, authorized-user limits, ads** — untouched.

## Edge cases

- First team in a new sport creates the `SportProgram` inside the create transaction (count
  consistent); it is the gated action if it pushes a Rookie past 5.
- Archiving the last active team in a sport drops that program from the billable count; on the
  next client-driven Stripe sync a web veteran's quantity can decrease (no auto-decrement job —
  accepted latency, same as today).
- Program with only archived teams → not billable.
- IAP veteran → unlimited programs regardless of count (flat tier).
- Platform switch (user subscribes on web then opens iOS): plan is server-authoritative; a
  Stripe-backed veteran keeps metered allowance; the gate keys on `subscription_id` presence,
  not the current device.
- Concurrent creates racing the 6th sport → in-`$transaction` re-check on program count guards.

## Testing

Server invariant tests (Jest, `npm test`):

- `program-billing-invariants.test.ts` (new): 5 free programs; 6th sport gated for Rookie;
  adding a level team to an existing sport is free; archiving all teams in a sport frees the
  slot; `billableQuantity = max(0, activePrograms − 5)`.
- **Per-rail veteran gate:** Stripe veteran metered; **IAP veteran (no `subscription_id`) →
  unlimited, can create beyond 5** (regression test for the fixed bug); Legend unlimited.
- `/teams/limits` returns correct shape per rail (Rookie / IAP-veteran / Stripe-veteran / Legend).
- Race guard: two concurrent creates of the 6th distinct sport → exactly one succeeds.

## Rollout

Dark, additive, server + OTA. No schema change (no migration), no App Store products, no new
binary. Behavior changes only at the create-gate, `/limits`, and Stripe quantity meaning; with 0
payers no bill changes. Standard PR gates (typecheck, invariants, regression battery); Railway
auto-deploys server; `eas update` ships the client copy/guard. iOS/Android compliance unchanged
(no Stripe on iOS, Android subs on Play, ads orthogonal).

## Open follow-up (Phase 4b, not now)

Tiered Apple/Google IAP product ladder for real mobile per-sport metering, with store-setup
checklist + new binary — triggered when a paying multi-sport mobile school needs it.
