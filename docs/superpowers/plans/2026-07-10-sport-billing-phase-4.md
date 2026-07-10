# Sport-Program Billing (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bill by the number of distinct **sport programs** an org runs instead of by team count, honoring "adding a level team to an existing sport is free," and make the Veteran gate correct on web (Stripe metered) / iOS+Android (flat IAP = unlimited).

**Architecture:** Additive, no schema change (`SportProgram` already exists, keyed `(organization_id, sport)`). Retarget the four existing billing control points (counting helper, metering math, create enforcement, `/limits`) from teams to active programs, and split the Veteran gate by rail (Stripe `subscription_id` present → metered; IAP → unlimited). Client stops sending team count to Stripe and only meters on the Stripe rail.

**Tech Stack:** Express + Prisma (server, `server/src`), React Native/Expo (client, `app/`), Jest (`npm test` from `server/`, ESM wrapper), Stripe subscription-item quantity (web only), Apple/Google flat IAP (`MIDTIER`/`TOPTIER`).

## Global Constraints

- Free allowance: **5 sport programs** on Rookie. Veteran/Legend: unlimited programs. Copy verbatim on web/Stripe: `$0.99 / month per sport over 5`.
- **A "billable program"** = a `SportProgram` that has ≥1 team with `status = 'active'`. Level teams (varsity/JV/freshman) share one program and never add a unit.
- **Per-rail Veteran:** Stripe (`preferences.subscription_id` present) = metered `max(0, activePrograms − 5)` line-item quantity. IAP (no `subscription_id`, `plan='veteran'`) = **unlimited** — must NOT throw `NO_ACTIVE_SUBSCRIPTION`.
- **Compliance (do not break):** no Stripe on iOS; Android subscriptions stay on Play; the `$0.99/sport` price copy appears only on the web/Stripe paywall; ads are a separate rail and are untouched.
- Server is authoritative; the client never decides entitlement. All `findMany` carry a `take`. Server typecheck (`npx tsc --noEmit --project server/tsconfig.json`) must stay clean.
- Ships **dark**: no schema/migration, no App Store products, no new binary. Deploys via Railway (server) + `eas update` (client copy). Zero real paying subscribers today, so no bill changes.

---

### Task 1: Program allowance in plan definitions

**Files:**

- Modify: `shared/plan-definitions.json` (add `max_programs` to each tier)
- Modify: `server/src/lib/planDefinitions.ts` (export `SERVER_ROOKIE_PROGRAM_LIMIT`)
- Test: `server/src/__tests__/plan-definitions-programs.test.ts`

**Interfaces:**

- Produces: `SERVER_ROOKIE_PROGRAM_LIMIT: number` (= 5), imported by later tasks from `../lib/planDefinitions.js`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/plan-definitions-programs.test.ts
import { describe, expect, it } from '@jest/globals';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from '../lib/planDefinitions.js';

describe('program allowance', () => {
  it('rookie free allowance is 5 sport programs', () => {
    expect(SERVER_ROOKIE_PROGRAM_LIMIT).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="plan-definitions-programs" --no-coverage`
Expected: FAIL — `SERVER_ROOKIE_PROGRAM_LIMIT` is not exported.

- [ ] **Step 3: Add `max_programs` to `shared/plan-definitions.json`**

Add `"max_programs": 5` to the `rookie` tier object and `"max_programs": null` to `veteran` and `legend` (next to the existing `max_teams`). Leave `max_teams` untouched (now vestigial for billing).

- [ ] **Step 4: Export the constant in `server/src/lib/planDefinitions.ts`**

Near the existing `SERVER_ROOKIE_TEAM_LIMIT` (line ~27), add:

```ts
// Free sport-program allowance (Phase 4 billing unit). max_teams is retained
// but vestigial for billing.
export const SERVER_ROOKIE_PROGRAM_LIMIT = planDefinitions.rookie.max_programs ?? 5;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="plan-definitions-programs" --no-coverage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/plan-definitions.json server/src/lib/planDefinitions.ts server/src/__tests__/plan-definitions-programs.test.ts
git commit -m "feat(billing): add 5 sport-program free allowance to plan definitions"
```

---

### Task 2: `countBillableProgramsForContext` helper

**Files:**

- Modify: `server/src/routes/teams.ts` (add helper next to `countTeamsForBillingContext`, ~line 380)
- Test: `server/src/__tests__/program-billing-count.test.ts`

**Interfaces:**

- Consumes: `TeamCreateBillingContext` (`{ effectivePlan, effectiveSubscriptionId, teamCountSource: 'user'|'org', orgIdForTeamCount? }`, already defined at `teams.ts:316`).
- Produces: `countBillableProgramsForContext(db, userId, context): Promise<number>` — distinct active-team programs. Used by Tasks 4–6.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/program-billing-count.test.ts
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import { countBillableProgramsForContext } from '../routes/teams.js';

const ts = Date.now();
let orgId = '';
let ownerId = '';

describe('countBillableProgramsForContext (org context)', () => {
  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: `pbc-${ts}@t.co`,
        password_hash: 'x',
        username: `pbc${ts}`,
        plan: 'rookie',
        onboarding_completed: true,
      },
    });
    ownerId = owner.id;
    const org = await prisma.organization.create({
      data: { name: `PBC Org ${ts}`, league_owner_id: ownerId, updated_at: new Date() },
    });
    orgId = org.id;
    // Two sports = two programs; basketball has an active team, baseball only archived.
    const bball = await prisma.sportProgram.create({
      data: { organization_id: orgId, sport: 'basketball' },
    });
    const bball2 = await prisma.sportProgram.create({
      data: { organization_id: orgId, sport: 'baseball' },
    });
    await prisma.team.create({
      data: {
        name: `V ${ts}`,
        organization_id: orgId,
        program_id: bball.id,
        level: 'varsity',
        status: 'active',
      },
    });
    await prisma.team.create({
      data: {
        name: `JV ${ts}`,
        organization_id: orgId,
        program_id: bball.id,
        level: 'jv',
        status: 'active',
      },
    });
    await prisma.team.create({
      data: {
        name: `Arch ${ts}`,
        organization_id: orgId,
        program_id: bball2.id,
        level: 'varsity',
        status: 'archived',
      },
    });
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { organization_id: orgId } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: ownerId } });
  });

  it('counts programs with an active team, not level teams and not archived-only programs', async () => {
    const n = await countBillableProgramsForContext(prisma, ownerId, {
      effectivePlan: 'rookie',
      effectiveSubscriptionId: undefined,
      teamCountSource: 'org',
      orgIdForTeamCount: orgId,
    } as any);
    expect(n).toBe(1); // basketball only (2 level teams share it); baseball archived-only excluded
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="program-billing-count" --no-coverage`
Expected: FAIL — `countBillableProgramsForContext` not exported.

- [ ] **Step 3: Implement and export the helper in `server/src/routes/teams.ts`**

Add immediately after `countTeamsForBillingContext` (ends ~line 380):

```ts
// Phase 4 billing unit: distinct active sport programs. A program counts once it
// has ≥1 active team; level teams share a program; archived-only programs and
// null-program active teams are handled explicitly so no team escapes billing.
export async function countBillableProgramsForContext(
  db: any,
  userId: string,
  context: TeamCreateBillingContext
): Promise<number> {
  if (context.teamCountSource === 'org' && context.orgIdForTeamCount) {
    return db.sportProgram.count({
      where: {
        organization_id: context.orgIdForTeamCount,
        teams: { some: { status: 'active' } },
      },
    });
  }

  // Personal context: distinct programs across the user's active owned teams,
  // plus each ungrouped (null-program) active owned team as its own unit.
  const owned = await db.teamMembership.findMany({
    where: { user_id: userId, role: 'owner', status: 'active', team: { status: 'active' } },
    select: { team: { select: { program_id: true } } },
    take: 5000,
  });
  const programIds = new Set<string>();
  let ungrouped = 0;
  for (const row of owned) {
    const pid = row.team?.program_id;
    if (pid) programIds.add(pid);
    else ungrouped += 1;
  }
  return programIds.size + ungrouped;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="program-billing-count" --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/teams.ts server/src/__tests__/program-billing-count.test.ts
git commit -m "feat(billing): countBillableProgramsForContext (active sport programs)"
```

---

### Task 3: Program-based metering math (Stripe)

**Files:**

- Modify: `server/src/lib/paymentInternals.ts:380-398` (`getVeteranBillingSnapshot`, `getVeteranTotalTeamAllowance`)
- Test: `server/src/__tests__/veteran-program-metering.test.ts`

**Interfaces:**

- Consumes: `SERVER_ROOKIE_PROGRAM_LIMIT` (Task 1).
- Produces: `getVeteranTotalTeamAllowance(billableQuantity)` unchanged signature, now means `SERVER_ROOKIE_PROGRAM_LIMIT + billableQuantity`. `getVeteranBillingSnapshot(userId, organizationId?)` now returns `{ programCount, billableQuantity }` with `billableQuantity = max(0, programCount − 5)`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/veteran-program-metering.test.ts
import { describe, expect, it } from '@jest/globals';
import { getVeteranTotalTeamAllowance } from '../lib/paymentInternals.js';

describe('veteran program metering', () => {
  it('total allowance = 5 free programs + billable quantity', () => {
    expect(getVeteranTotalTeamAllowance(0)).toBe(5);
    expect(getVeteranTotalTeamAllowance(3)).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="veteran-program-metering" --no-coverage`
Expected: FAIL — allowance still `4 + quantity`.

- [ ] **Step 3: Retarget the metering math**

In `server/src/lib/paymentInternals.ts`, add `SERVER_ROOKIE_PROGRAM_LIMIT` to the existing import from `./planDefinitions.js` (line 4-7). Then replace `getVeteranBillingSnapshot` and `getVeteranTotalTeamAllowance` (lines 380-398):

```ts
export async function getVeteranBillingSnapshot(
  userId: string,
  organizationId?: string | null
): Promise<{ programCount: number; billableQuantity: number }> {
  const programCount = organizationId
    ? await prisma.sportProgram.count({
        where: { organization_id: organizationId, teams: { some: { status: 'active' } } },
      })
    : await (async () => {
        const owned = await prisma.teamMembership.findMany({
          where: { user_id: userId, role: 'owner', status: 'active', team: { status: 'active' } },
          select: { team: { select: { program_id: true } } },
          take: 5000,
        });
        const ids = new Set<string>();
        let ungrouped = 0;
        for (const r of owned) r.team?.program_id ? ids.add(r.team.program_id) : (ungrouped += 1);
        return ids.size + ungrouped;
      })();

  return {
    programCount,
    billableQuantity: Math.max(0, programCount - SERVER_ROOKIE_PROGRAM_LIMIT),
  };
}

export function getVeteranTotalTeamAllowance(billableQuantity: number): number {
  return SERVER_ROOKIE_PROGRAM_LIMIT + Math.max(0, Math.trunc(billableQuantity || 0));
}
```

Leave `resolveVeteranQuantityUpdate` (clamp logic) unchanged — it operates on abstract unit counts.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="veteran-program-metering" --no-coverage`
Expected: PASS. Also run `npx tsc --noEmit --project server/tsconfig.json` — expect 0 errors (callers of `getVeteranBillingSnapshot` that read `.teamCount` must switch to `.programCount`; grep `getVeteranBillingSnapshot` and update those reads).

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/paymentInternals.ts server/src/__tests__/veteran-program-metering.test.ts
git commit -m "feat(billing): meter Stripe veteran by active program count (5 free)"
```

---

### Task 4: Rookie enforcement by program + `PROGRAM_LIMIT_EXCEEDED`

**Files:**

- Modify: `server/src/routes/teams.ts:1492-1506` (in-`$transaction` rookie branch) and the pre-check mirror (~1381-1452)
- Test: `server/src/__tests__/program-limit-enforcement.test.ts`

**Interfaces:**

- Consumes: `countBillableProgramsForContext` (Task 2), `SERVER_ROOKIE_PROGRAM_LIMIT` (Task 1).
- Produces: 403 `PROGRAM_LIMIT_EXCEEDED` when a Rookie's new team introduces a 6th billable program; adding a team to an existing active sport is free.

The create flow resolves/creates the team's program before the count check. **Free-when-joining-existing-sport rule:** compute the count of billable programs _excluding the target program_; the gate only triggers when the new team introduces a program not already active.

- [ ] **Step 1: Write the failing test** (integration; drives the create route)

```ts
// server/src/__tests__/program-limit-enforcement.test.ts
// Uses the same in-process app/supertest harness as other *-enforcement tests.
// Assert: a rookie org with 5 active-sport programs is blocked (403
// PROGRAM_LIMIT_EXCEEDED) from creating a team in a 6TH sport, but CAN create a
// JV team in one of the existing 5 sports (free).
```

Model this test on the existing team-limit test (search `TEAM_LIMIT_EXCEEDED` under `server/src/__tests__`) — reuse its app bootstrap and auth-token helper; only the seeded programs and asserted code change.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="program-limit-enforcement" --no-coverage`
Expected: FAIL — still gated on team count / wrong code.

- [ ] **Step 3: Retarget the rookie branch**

Replace the rookie block at `teams.ts:1492-1506` (and the equivalent pre-check) with a program-based gate. `targetProgramId` is the program the new team will belong to (resolved earlier in the create flow from org+sport):

```ts
if (effectivePlan === 'rookie' || !effectivePlan) {
  const billablePrograms = await countBillableProgramsForContext(tx, me.id, billingContext);
  const joiningExistingSport = targetProgramAlreadyActive; // boolean resolved from org+sport before the tx
  if (!joiningExistingSport && billablePrograms >= SERVER_ROOKIE_PROGRAM_LIMIT) {
    throw Object.assign(new Error('Program limit reached'), {
      status: 403,
      body: {
        error: 'Program limit reached',
        message: me.paid_by_owner
          ? `Your organization has reached the free limit (${SERVER_ROOKIE_PROGRAM_LIMIT} sports). The league owner needs to upgrade.`
          : `You've reached your free limit (${SERVER_ROOKIE_PROGRAM_LIMIT} sports). Upgrade to add another sport.`,
        code: 'PROGRAM_LIMIT_EXCEEDED',
        limit: SERVER_ROOKIE_PROGRAM_LIMIT,
        current: billablePrograms,
      },
    });
  }
}
```

Where `targetProgramAlreadyActive` = the org already has a `SportProgram` for this sport with ≥1 active team. Compute it just before the transaction using the resolved sport slug (reuse `normalizeSportToSlug`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="program-limit-enforcement" --no-coverage`
Expected: PASS (6th sport blocked; JV in existing sport allowed).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/teams.ts server/src/__tests__/program-limit-enforcement.test.ts
git commit -m "feat(billing): rookie gate on 6th sport program, not 5th team"
```

---

### Task 5: Veteran enforcement per rail (Stripe metered / IAP unlimited) — the bug fix

**Files:**

- Modify: `server/src/routes/teams.ts:1507-1550` (veteran branch, in-tx + pre-check mirror)
- Test: `server/src/__tests__/veteran-rail-gate.test.ts`

**Interfaces:**

- Consumes: `countBillableProgramsForContext`, `getVeteranSubscriptionAllowance` (existing, `teams.ts:382`).
- Produces: IAP veteran (plan=veteran, no `subscription_id`) can create beyond 5 programs; Stripe veteran gated on `allowance.totalTeamAllowance` computed on programs.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/veteran-rail-gate.test.ts
// Two cases via the create route:
// (a) plan='veteran' with NO subscription_id and an apple_product_id in preferences
//     -> can create a team in a 6th sport (no NO_ACTIVE_SUBSCRIPTION). REGRESSION for the bug.
// (b) plan='veteran' with a subscription_id -> still routes through the Stripe
//     allowance path (mock getVeteranSubscriptionAllowance).
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="veteran-rail-gate" --no-coverage`
Expected: FAIL — case (a) currently 403 `NO_ACTIVE_SUBSCRIPTION`.

- [ ] **Step 3: Split the veteran branch by rail**

Replace the `if (!subscriptionId) throw NO_ACTIVE_SUBSCRIPTION` guard (`teams.ts:1509-1520`) with:

```ts
} else if (effectivePlan === 'veteran') {
  const subscriptionId = billingContext.effectiveSubscriptionId;
  if (!subscriptionId) {
    // IAP veteran (Apple/Google flat MIDTIER) — no per-unit metering possible,
    // so the flat tier grants UNLIMITED programs. Do not block. (Fixes the bug
    // where mobile veterans could not create any team.)
  } else {
    // Stripe veteran — metered on programs.
    const allowance = await getVeteranSubscriptionAllowance(subscriptionId);
    if (!allowance.active) {
      throw Object.assign(new Error('Subscription not active'), { status: 403, body: {
        error: 'Subscription not active', message: '…', code: 'SUBSCRIPTION_NOT_ACTIVE' } });
    }
    const billablePrograms = await countBillableProgramsForContext(tx, me.id, billingContext);
    const joiningExistingSport = targetProgramAlreadyActive;
    if (!joiningExistingSport && billablePrograms >= allowance.totalTeamAllowance) {
      throw Object.assign(new Error('Program limit reached'), { status: 403, body: {
        error: 'Program limit reached',
        message: `Your subscription currently covers ${allowance.totalTeamAllowance} sports. Update billing before adding another sport.`,
        code: 'SUBSCRIPTION_QUANTITY_EXCEEDED',
        paid_quantity: allowance.billableQuantity,
        allowed_total_programs: allowance.totalTeamAllowance,
        current_programs: billablePrograms,
      } });
    }
  }
}
```

Keep the `SUBSCRIPTION_NOT_ACTIVE` message text from the current code (personal/`paid_by_owner` variants).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="veteran-rail-gate" --no-coverage`
Expected: PASS (IAP veteran unlimited; Stripe veteran metered).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/teams.ts server/src/__tests__/veteran-rail-gate.test.ts
git commit -m "fix(billing): IAP veteran = unlimited programs; Stripe veteran metered by program"
```

---

### Task 6: `/teams/limits` — program-based, per-rail, `metered` flag

**Files:**

- Modify: `server/src/routes/teams.ts:551-616`
- Test: `server/src/__tests__/limits-endpoint-programs.test.ts`

**Interfaces:**

- Produces: `/teams/limits` response gains `owned_programs`, `max_programs`, and `metered: boolean` (true only for Stripe veteran). Legacy `owned_teams`/`max_teams`/`can_create_more`/`remaining` remain populated for older client bundles.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/__tests__/limits-endpoint-programs.test.ts
// Assert response shape per rail (hit GET /teams/limits with seeded users):
//  - rookie with 5 active programs: can_create_more=false, max_programs=5, metered=false
//  - veteran IAP (no subscription_id): can_create_more=true, metered=false, max_programs=null/999
//  - veteran Stripe (mock allowance): metered=true, max_programs = 5 + quantity
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="limits-endpoint-programs" --no-coverage`
Expected: FAIL — response still team-based, no `metered`.

- [ ] **Step 3: Rework the `/limits` handler**

Replace the body of the `/limits` handler (`teams.ts:569-615`) so it counts programs via `countBillableProgramsForContext`, and:

- Rookie → `max_programs = SERVER_ROOKIE_PROGRAM_LIMIT`, `can_create_more = programs < 5`, `metered = false`.
- Veteran, no `subscription_id` (IAP) → `can_create_more = true`, `max_programs = null` (display 999), `metered = false`.
- Veteran, `subscription_id` (Stripe) → allowance via `getVeteranSubscriptionAllowance`; `metered = true`; `can_create_more = active && programs < allowance.totalTeamAllowance`.
- Legend → unlimited, `metered = false`.
  Populate both the new `owned_programs`/`max_programs`/`metered` fields and the legacy `owned_teams`/`max_teams`/`can_create_more`/`remaining` (map programs onto the legacy names) so old bundles keep working.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="limits-endpoint-programs" --no-coverage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/teams.ts server/src/__tests__/limits-endpoint-programs.test.ts
git commit -m "feat(billing): /teams/limits reports programs + per-rail metered flag"
```

---

### Task 7: Client — guard Stripe metering, program copy, platform-aware paywall

**Files:**

- Modify: `app/(tabs)/create-team.tsx:533-579` (guard `updateQuantity` to Stripe/metered; send program count; sports copy)
- Modify: `app/subscription-paywall.tsx` + `app/settings/manage-subscription.tsx` (copy: teams → sports; per-sport price web-only)
- Test: `app/__tests__/create-team-metering-guard.test.tsx` (if a testable seam exists; otherwise assert via the limits contract)

**Interfaces:**

- Consumes: `/teams/limits` `metered` + `owned_programs` (Task 6).

- [ ] **Step 1: Write the failing test** (component/logic test around the veteran branch)

```tsx
// Assert Subscriptions.updateQuantity is called ONLY when limits.metered === true.
// For an IAP veteran (metered=false) creating a team, updateQuantity is NOT called
// and creation proceeds. Mock api Subscriptions + the limits fetch.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/__tests__/create-team-metering-guard.test.tsx`
Expected: FAIL — `updateQuantity` called unconditionally in the veteran branch.

- [ ] **Step 3: Guard the metering call**

In `app/(tabs)/create-team.tsx`, change the `if (userPlan === 'veteran')` block (line 555) to only run the Stripe billing alert + `Subscriptions.updateQuantity(...)` when `latestLimits?.metered === true`. For a non-metered (IAP) veteran, skip straight to `proceedWithTeamCreation(...)` with no quantity update. Replace the team-count math/copy (`newTeamCount`, `billableTeamCount`, "team" wording) with program-count wording; send the billable **program** count to `updateQuantity`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/__tests__/create-team-metering-guard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Update paywall copy (no test — copy only)**

In `app/subscription-paywall.tsx` and `app/settings/manage-subscription.tsx`, change Veteran copy from teams to sports. The `$0.99 / sport` per-unit line stays inside the **web/Stripe** branch only; the iOS/Android IAP branch shows "Veteran — unlimited sports" with no per-unit price. Do not touch the `Platform.OS` rail branching.

- [ ] **Step 6: Commit**

```bash
git add "app/(tabs)/create-team.tsx" app/subscription-paywall.tsx app/settings/manage-subscription.tsx app/__tests__/create-team-metering-guard.test.tsx
git commit -m "feat(billing): client meters programs on Stripe only; sports copy; IAP unlimited"
```

---

### Task 8: Consolidated invariant suite

**Files:**

- Test: `server/src/__tests__/program-billing-invariants.test.ts`

- [ ] **Step 1: Write the invariant tests**

Consolidate the phase's guarantees in one suite (import the pure helpers; drive the route for the gate):

- `getVeteranTotalTeamAllowance(0) === 5`, `(3) === 8`.
- `countBillableProgramsForContext` excludes archived-only programs and counts level teams once (reuse Task 2 seed).
- Adding a JV team to an existing active sport is free for a rookie at the 5-program cap.
- IAP veteran (no `subscription_id`) can create a team in a 6th sport (regression for the fixed bug).
- Race guard: two concurrent creates of the 6th distinct sport → exactly one succeeds (in-`$transaction` re-check).

- [ ] **Step 2: Run and verify green**

Run: `cd server && npm test -- --testPathPattern="program-billing-invariants" --no-coverage`
Expected: PASS.

- [ ] **Step 3: Full gate before PR**

Run: `npx tsc --noEmit --project server/tsconfig.json` (0 errors), then `cd server && npm test -- --testPathPattern="program-billing|veteran-program|veteran-rail|limits-endpoint-programs|program-limit" --no-coverage`.

- [ ] **Step 4: Commit**

```bash
git add server/src/__tests__/program-billing-invariants.test.ts
git commit -m "test(billing): consolidated Phase 4 program-billing invariants"
```

---

## Rollout (after all tasks)

- Branch: `feat/sport-billing-phase-4` (already off `main`). Open PR to `main`.
- Gates: server + client typecheck, the Phase 4 suites above, plus the existing `payments-invariants` / `iap-config-invariants` (must stay green).
- Merge → Railway auto-deploys server (no migration). Run `eas update --branch production` for the client copy/guard (`EAS_SKIP_AUTO_FINGERPRINT=1` per the SDK 54 quirk).
- No App Store products, no new binary. Zero payers → no bill changes.

## Deferred (Phase 4b — not this plan)

Tiered Apple/Google IAP SKUs for real per-sport metering on mobile (Apple subs are quantity=1); subscriber migration/grandfathering (none exist). Documented in the spec's Non-Goals.
