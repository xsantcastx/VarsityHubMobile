# Trust Boundary Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 7 actionable findings from the 2026-08-23 Trust Boundary Review (1 Critical, 3 High, 3 Medium) across Teams & Organizations, Payments & Subscriptions, and Auth/Onboarding — closing each gap with the minimal, targeted change the finding actually calls for, not a rewrite of the surrounding system.

**Architecture:** Seven independent, server-only changes. No shared state between tasks — each touches a different file (or a different, non-overlapping region of `server/src/routes/teams.ts`) and is separately reviewable and revertable.

**Tech Stack:** Express + Prisma (all 7 tasks are server-side). Jest via `cd server && npm test -- --testPathPattern="..." --no-coverage` for a single suite, plain `cd server && npm test` for the full suite (wraps jest with `--experimental-vm-modules` — required, bare `npx jest` fails ~100 suites on `import.meta`).

**Spec:** No standalone spec doc — the source is the "Trust Boundary Review" audit (published as a Claude artifact, 2026-08-23) that consolidated 3 parallel system audits (Payments & Subscriptions, Teams & Organizations, Auth/Roles/Onboarding) against this repo's own CLAUDE.md "Security & Architecture Audit Standard." Every finding below was independently re-verified against current code before this plan was written (exact file:line, not carried over from the audit report).

## Global Constraints

- Server-only changes — no client (`app/`) files touched by this plan.
- Run `npx tsc --noEmit --project server/tsconfig.json` after every task — 0 errors before moving on.
- Run `npm run format:check` (from repo root) before considering a task done.
- Run the full server suite (`cd server && npm test`) once at the end of all 7 tasks, on a clean tree — per the 2026-08-22 lesson on this branch, a task-scoped test run is not sufficient evidence the branch is safe to ship.
- Two findings from the audit are explicitly **not** in this plan and must not be touched:
  - The lack of an org-wide team/program creation ceiling for IAP-flat Veteran/Legend orgs (Teams & Orgs, Medium) — the audit itself calls this "as much a product call as an engineering one." No cap number to pick without the user's input.
  - The lack of purchase-time account binding (`appAccountToken`/`obfuscatedAccountId`) on the Apple/Google IAP verify endpoints (Payments, Medium/residual) — a standard limitation of receipt verification, explicitly documented as a residual gap, not something to fix in this pass.
- Do not touch `GAME_SUMMARY_SELECT` (the full-team-relation exposure that makes a private team's ID discoverable via a public opponent's game listing) — CLAUDE.md is explicit that this shared select needs a dedicated field-parity review across every consumer before narrowing it, and Task 1 below closes the actual access-control hole (following a private team) independent of whether its ID is known.

---

### Task 1 (CRITICAL): A private team's roster is one unrestricted follow away from full exposure

`POST /teams/:id/follow` never checks `is_private` before creating a `TeamFollow` row, and `isTeamHiddenFromViewer` treats any bare follow as full access — so anyone who learns a private team's ID can self-follow it and immediately pull its full staff roster via `GET /teams/:id/screen-summary`, bypassing `is_private` entirely. `GET /teams/:id/members` already enforces the correct, stricter boundary (members/org-admins/platform-admins only) one file over.

**Files:**

- Modify: `server/src/lib/privacyUtils.ts:279-314` (extract the membership/org-admin check out of `isTeamHiddenFromViewer` into a new exported `hasDirectTeamAccess`)
- Modify: `server/src/routes/teams.ts:1180-1198` (the follow route) and its import line (`server/src/routes/teams.ts:18`)
- Modify: `server/src/__tests__/team-privacy.test.ts` (add a new test using the file's existing `strangerToken`/`privateTeamId` fixtures)

**Interfaces:**

- Produces: `hasDirectTeamAccess(teamId: string, viewerId: string, organizationId: string | null): Promise<boolean>` — exported from `server/src/lib/privacyUtils.ts`, true iff the viewer has an active team staff membership OR an active org owner/manager membership on the team's org. Does NOT check follow status (that's the caller's job).
- Consumes: `MembershipStatus` from `@prisma/client` (already imported in both files).

- [ ] **Step 1: Write the failing regression test**

Add to `server/src/__tests__/team-privacy.test.ts`, inside the existing `describe('GET /teams/:id', ...)` block (the one containing `'private team returns 404 to a stranger'` at line 168) — this reuses the file's existing `strangerToken`/`privateTeamId` fixtures, no new setup needed:

```typescript
it('a stranger cannot follow a private team to gain access to it', async () => {
  const followRes = await request(app)
    .post(`/teams/${privateTeamId}/follow`)
    .set('Authorization', `Bearer ${strangerToken}`);
  expect(followRes.status).toBe(403);

  // The follow must not have been created even partially.
  const stranger = await prisma.user.findFirst({
    where: { username: { startsWith: 'stranger' } },
    select: { id: true },
    orderBy: { created_at: 'desc' },
  });
  const followRow = await prisma.teamFollow.findFirst({
    where: { team_id: privateTeamId, user_id: strangerId },
  });
  expect(followRow).toBeNull();
  void stranger;

  // And the private team must still be invisible to them afterward.
  const teamRes = await request(app)
    .get(`/teams/${privateTeamId}`)
    .set('Authorization', `Bearer ${strangerToken}`);
  expect(teamRes.status).toBe(404);
});

it('a team member can still follow their own private team (no-op access grant, but must not be blocked)', async () => {
  const res = await request(app)
    .post(`/teams/${privateTeamId}/follow`)
    .set('Authorization', `Bearer ${memberToken}`);
  expect(res.status).toBe(200);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd server && npm test -- --testPathPattern="team-privacy" --no-coverage`
Expected: the first new test FAILS — `followRes.status` is `200`, not `403` (the follow currently succeeds unconditionally). The second new test passes already (nothing to fix there — it's a regression guard for the fix, added now so Step 4 proves it stays green).

- [ ] **Step 3: Extract `hasDirectTeamAccess` and refactor `isTeamHiddenFromViewer` to use it**

```typescript
// server/src/lib/privacyUtils.ts — replace isTeamHiddenFromViewer (lines 279-314) with:

/**
 * Does `viewerId` have team access independent of following it — an active
 * staff membership, or org owner/manager on the team's org? Split out of
 * isTeamHiddenFromViewer so the follow route can gate on it directly: a
 * private team's is_private flag must not be unlockable just by following
 * it, since following was previously (incorrectly) treated as equivalent
 * to this stronger access.
 */
export async function hasDirectTeamAccess(
  teamId: string,
  viewerId: string,
  organizationId: string | null
): Promise<boolean> {
  const [membership, orgMembership] = await Promise.all([
    prisma.teamMembership.findFirst({
      where: { user_id: viewerId, team_id: teamId, status: MembershipStatus.active },
      select: { team_id: true },
    }),
    organizationId
      ? prisma.organizationMembership.findFirst({
          where: {
            user_id: viewerId,
            organization_id: organizationId,
            role: { in: ['owner', 'manager'] },
            status: MembershipStatus.active,
          },
          select: { organization_id: true },
        })
      : Promise.resolve(null),
  ]);

  return Boolean(membership || orgMembership);
}

/**
 * Check if a single team's private profile is hidden from the viewer.
 * Team members, followers, and org admins can still see it.
 */
export async function isTeamHiddenFromViewer(
  teamId: string,
  viewerId: string | null
): Promise<boolean> {
  const team = await getTeamState(teamId, prisma);
  if (!team || team.status !== 'active') return true;
  if (!team.is_private) return false;
  if (!viewerId) return true;

  const [follow, hasAccess] = await Promise.all([
    prisma.teamFollow.findFirst({
      where: { user_id: viewerId, team_id: teamId },
      select: { team_id: true },
    }),
    hasDirectTeamAccess(teamId, viewerId, team.organization_id),
  ]);

  return !follow && !hasAccess;
}
```

- [ ] **Step 4: Gate the follow route**

```typescript
// server/src/routes/teams.ts:18 — add hasDirectTeamAccess to the existing import
import {
  getExcludedPrivateTeamIds,
  hasDirectTeamAccess,
  isTeamHiddenFromViewer,
} from '../lib/privacyUtils.js';
```

```typescript
// server/src/routes/teams.ts — inside the '/:id/follow' handler, immediately
// after the existing status check (`if (team.status !== 'active') ...`) and
// BEFORE the `existingFollow`/`upsert` block:
if (team.is_private && !(await hasDirectTeamAccess(teamId, userId, team.organization_id))) {
  return res.status(403).json({ error: 'This team is private.' });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npm test -- --testPathPattern="team-privacy" --no-coverage`
Expected: all tests in the file pass, including both new ones — the stranger gets 403 and no `TeamFollow` row, the existing member's follow still succeeds.

- [ ] **Step 6: Run the broader privacy/authz regression suites**

Run: `cd server && npm test -- --testPathPattern="privacy-surfaces|authz-matrix-fixes|program-screen-summary" --no-coverage`
Expected: all pass — these suites reference `isTeamHiddenFromViewer` by name/regex and by behavior; confirm the refactor didn't change its external contract for any other caller.

- [ ] **Step 7: Typecheck and format**

```bash
npx tsc --noEmit --project server/tsconfig.json
npx prettier --write server/src/lib/privacyUtils.ts server/src/routes/teams.ts server/src/__tests__/team-privacy.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add server/src/lib/privacyUtils.ts server/src/routes/teams.ts server/src/__tests__/team-privacy.test.ts
git commit -m "$(cat <<'EOF'
fix(security): block following a private team without existing access

POST /teams/:id/follow never checked is_private before creating a
TeamFollow row, and isTeamHiddenFromViewer treated any bare follow as
full access — so anyone who learned a private team's ID could self-follow
it and pull its full staff roster via GET /teams/:id/screen-summary, with
no invite, no approval, no staff consent. GET /teams/:id/members already
enforces the correct, stricter boundary one file over. Extract that
boundary into hasDirectTeamAccess() and gate the follow route on it.
EOF
)"
```

---

### Task 2 (HIGH): A stray Stripe webhook can silently downgrade a Legend subscriber back to Veteran

`syncStripeSubscriptionState` never calls `shouldApplyStripeSubscriptionEvent` — the guard confirmed correct on `customer.subscription.deleted` and `invoice.payment_failed` — so a `customer.subscription.updated` event for an old/superseded/foreign-rail subscription can silently overwrite `plan`/`subscription_tier`.

**Files:**

- Modify: `server/src/lib/paymentInternals.ts:242-270` (top of `syncStripeSubscriptionState`, right after `existingPrefs` is computed)
- Modify: `server/src/__tests__/stripe-subscription-guard.test.ts` (extend the existing "wires the guard" static test)

**Interfaces:**

- Consumes: `shouldApplyStripeSubscriptionEvent(prefs, eventSubscriptionId): boolean` from `./stripeSubscriptionGuard.js` (already exists, already correct — this task only adds a missing call site).

**Critical scoping note — read before writing code:** the guard must apply ONLY when `source === 'subscription.updated'` (the webhook-driven path). It must NOT apply when `source === 'subscription.finalize'` (the `/finalize-subscription` route, called right after a client completes a NEW checkout — e.g. a Veteran→Legend upgrade). In that flow, the new subscription's ID is EXPECTED to differ from whatever was previously stored — that mismatch is the upgrade succeeding, not a stale event. Applying the guard unconditionally would break every subscription upgrade. Verify this by reading `server/src/routes/payments.ts:3426` (the `/finalize-subscription` call site) before writing the fix — the route above it already checks `subscription`'s Stripe customer ID matches `user.stripe_customer_id` (ownership), which is a different, complementary check from the rail-matching guard.

- [ ] **Step 1: Extend the existing "wires the guard" test to also require `paymentInternals.ts`**

```typescript
// server/src/__tests__/stripe-subscription-guard.test.ts — replace the
// describe block at the top of the file (lines 19-25):
describe('the guard is wired into every write path that can mutate entitlement from a Stripe event', () => {
  const paymentsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'payments.ts'), 'utf8');
  const internalsSrc = readFileSync(
    join(process.cwd(), 'src', 'lib', 'paymentInternals.ts'),
    'utf8'
  );

  it('customer.subscription.deleted and invoice.payment_failed both call the guard', () => {
    const calls = paymentsSrc.match(/shouldApplyStripeSubscriptionEvent\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('syncStripeSubscriptionState (the customer.subscription.updated write path) calls the guard', () => {
    const calls = internalsSrc.match(/shouldApplyStripeSubscriptionEvent\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="stripe-subscription-guard" --no-coverage`
Expected: the new "syncStripeSubscriptionState... calls the guard" test FAILS (0 matches today).

- [ ] **Step 3: Add the guard call, scoped to the webhook path only**

```typescript
// server/src/lib/paymentInternals.ts — add the import near the top:
import { shouldApplyStripeSubscriptionEvent } from './stripeSubscriptionGuard.js';
```

```typescript
// server/src/lib/paymentInternals.ts — inside syncStripeSubscriptionState,
// immediately after this existing block:
//   const existingPrefs =
//     subUser.preferences && typeof subUser.preferences === 'object'
//       ? (subUser.preferences as any)
//       : {};
// insert:

// Only the webhook-driven path is guarded. `subscription.finalize` is the
// client-initiated activation of a brand-new subscription (e.g. an
// upgrade) and is EXPECTED to carry a subscription id that doesn't match
// whatever was previously stored — that mismatch is the upgrade
// succeeding, not a stale event. See stripeSubscriptionGuard.ts.
if (
  source === 'subscription.updated' &&
  !shouldApplyStripeSubscriptionEvent(existingPrefs, subscription.id)
) {
  console.warn(
    '[payments] syncStripeSubscriptionState — ignored: stale/non-active subscription event',
    { userId: subUser.id, subscriptionId: subscription.id }
  );
  return {
    userId: subUser.id,
    plan: resolvedPlan,
    normalizedStatus,
    entitlementActive,
    transactionStatus,
    skipped: true,
  };
}
```

(`resolvedPlan`, `normalizedStatus`, `entitlementActive`, and `transactionStatus` are already computed above this point in the function, before `existingPrefs` — no new variables needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="stripe-subscription-guard" --no-coverage`
Expected: all tests pass (7 existing + 1 new).

- [ ] **Step 5: Run the broader payments regression suites**

Run: `cd server && npm test -- --testPathPattern="payments-invariants|stripe-webhook-signature|payments-finalization" --no-coverage`
Expected: all pass — `payments-invariants.test.ts:282` already asserts `customer.subscription.updated` calls `syncStripeSubscriptionState`; `payments-finalization.test.ts` exercises the `/finalize-subscription` path this change must not break.

- [ ] **Step 6: Typecheck and format**

```bash
npx tsc --noEmit --project server/tsconfig.json
npx prettier --write server/src/lib/paymentInternals.ts server/src/__tests__/stripe-subscription-guard.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add server/src/lib/paymentInternals.ts server/src/__tests__/stripe-subscription-guard.test.ts
git commit -m "$(cat <<'EOF'
fix(payments): guard syncStripeSubscriptionState against stale webhooks

shouldApplyStripeSubscriptionEvent is confirmed correct on
customer.subscription.deleted and invoice.payment_failed, but was never
called from syncStripeSubscriptionState — so a customer.subscription.updated
event for an old, superseded, or foreign-rail subscription could silently
overwrite plan/subscription_tier. Scoped to the webhook path only
(source === 'subscription.updated'); the /finalize-subscription path is
untouched since a subscription-id mismatch there is an upgrade succeeding,
not a stale event.
EOF
)"
```

---

### Task 3 (HIGH): The Google Play reconciliation job can't tell "expired" from "API had a bad minute"

`reconcileGooglePlaySubscriptions`'s downgrade branch fires on any `verified: false`, including transient Play Developer API errors (429/500/auth), not only genuine expiry — so an API blip during its 200-row sequential batch can mass-downgrade paying, renewing Android subscribers.

**Files:**

- Modify: `server/src/lib/googlePlayReconciliation.ts:99-131` (the else-branch)
- Create: `server/src/__tests__/google-play-reconciliation.test.ts` (new — no test currently exists for this job)

**Interfaces:**

- Consumes: `verifyGooglePurchaseWithPlayApi`'s return shape — `{ verified: true, expiresAt, details }` or `{ verified: false, reason: 'google_subscription_expired' | 'google_subscription_canceled' | 'google_verifier_not_configured' | \`google*play_api*${number}\`, details? }`(from`server/src/routes/payments.ts`, unchanged by this task).

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/google-play-reconciliation.test.ts
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUserFindMany = jest.fn();
const mockUserUpdate = jest.fn(async () => ({}));
const mockCaptureException = jest.fn();
const mockInvalidateMeCache = jest.fn(async () => undefined);
const mockHasVerifierConfig = jest.fn(() => true);
const mockVerifyPurchase = jest.fn();

jest.unstable_mockModule('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
      update: mockUserUpdate,
    },
  },
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: mockCaptureException,
}));

jest.unstable_mockModule('../lib/userCache.js', () => ({
  invalidateMeCacheForUser: mockInvalidateMeCache,
}));

jest.unstable_mockModule('../routes/payments.js', () => ({
  GOOGLE_ALLOWED_PACKAGES: ['com.varsityhub.varsityhub'],
  hasGooglePlayVerifierConfig: mockHasVerifierConfig,
  verifyGooglePurchaseWithPlayApi: mockVerifyPurchase,
}));

const { reconcileGooglePlaySubscriptions } = await import('../lib/googlePlayReconciliation.js');

const baseUser = {
  id: 'user-1',
  preferences: {
    subscription_platform: 'google',
    google_purchase_token: 'tok-1',
    google_product_id: 'veteran_monthly',
    google_expires_date: '2026-01-01T00:00:00.000Z',
  },
};

describe('reconcileGooglePlaySubscriptions', () => {
  beforeEach(() => {
    mockUserFindMany.mockReset();
    mockUserUpdate.mockReset();
    mockUserUpdate.mockResolvedValue({});
    mockCaptureException.mockReset();
    mockInvalidateMeCache.mockReset();
    mockHasVerifierConfig.mockReset();
    mockHasVerifierConfig.mockReturnValue(true);
    mockVerifyPurchase.mockReset();
  });

  it('does NOT downgrade on a transient Play API error (429/500/auth)', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({ verified: false, reason: 'google_play_api_429' });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(result.downgraded).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('does NOT downgrade when the verifier is unconfigured', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_verifier_not_configured',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(result.downgraded).toBe(0);
  });

  it('DOES downgrade on a genuinely expired subscription', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_subscription_expired',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(mockUserUpdate.mock.calls[0][0].data.subscription_tier).toBe('free');
    expect(result.downgraded).toBe(1);
  });

  it('DOES downgrade on a genuinely canceled subscription', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: false,
      reason: 'google_subscription_canceled',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(result.downgraded).toBe(1);
  });

  it('still refreshes expiry on a verified renewal (unchanged behavior)', async () => {
    mockUserFindMany.mockResolvedValue([baseUser]);
    mockVerifyPurchase.mockResolvedValue({
      verified: true,
      expiresAt: '2027-01-01T00:00:00.000Z',
    });

    const result = await reconcileGooglePlaySubscriptions();

    expect(mockUserUpdate).toHaveBeenCalledTimes(1);
    expect(result.refreshed).toBe(1);
    expect(result.downgraded).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="google-play-reconciliation" --no-coverage`
Expected: FAIL — the first two tests (`does NOT downgrade on a transient...`, `...unconfigured`) fail because `mockUserUpdate` IS currently called (the else-branch downgrades unconditionally on any `verified: false`).

- [ ] **Step 3: Fix the else-branch to check `reason` before downgrading**

```typescript
// server/src/lib/googlePlayReconciliation.ts — replace the else-branch
// (the block starting "// Store says expired/cancelled/unknown — downgrade
// to rookie.") with:

      } else {
        const reason = (verified as any)?.reason;
        const isGenuineExpiry =
          reason === 'google_subscription_expired' || reason === 'google_subscription_canceled';

        if (!isGenuineExpiry) {
          // A Play API error (rate limit, outage, auth/quota) or an
          // unconfigured verifier is NOT proof of expiry. Treat it as a
          // soft error: leave entitlement untouched and retry next run —
          // downgrading here would mass-downgrade paying, renewing
          // subscribers on a transient API blip.
          errors++;
          console.warn(
            `[google-play-reconcile] soft error user=${user.id} reason=${reason ?? 'unknown'} — leaving entitlement untouched`
          );
          continue;
        }

        // Store says genuinely expired/cancelled — downgrade to rookie.
        const { google_purchase_token, google_product_id, google_expires_date, ...restPrefs } =
          prefs;
        void google_purchase_token;
        void google_product_id;
        void google_expires_date;
        const nextPrefs = mergeBillingStateIntoPreferences(restPrefs, {
          plan: 'rookie',
          pending_plan: null,
          payment_pending: false,
          payment_approved: false,
        });
        await prisma.user.update({
          where: { id: user.id },
          data: {
            preferences: nextPrefs as any,
            ...buildBillingStateColumns({
              plan: 'rookie',
              pending_plan: null,
              payment_pending: false,
              payment_approved: false,
            }),
            subscription_tier: 'free',
            subscription_status: 'canceled',
          },
        });
        await invalidateMeCacheForUser(user.id);
        downgraded++;
        console.warn(`[google-play-reconcile] downgraded user=${user.id} reason=${reason}`);
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="google-play-reconciliation" --no-coverage`
Expected: PASS (5/5).

- [ ] **Step 5: Typecheck and format**

```bash
npx tsc --noEmit --project server/tsconfig.json
npx prettier --write server/src/lib/googlePlayReconciliation.ts server/src/__tests__/google-play-reconciliation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add server/src/lib/googlePlayReconciliation.ts server/src/__tests__/google-play-reconciliation.test.ts
git commit -m "$(cat <<'EOF'
fix(payments): Google Play reconciliation no longer downgrades on API errors

The downgrade branch fired on any verified:false result, but the
verifier returns that for a 429/500/auth error from the Play Developer
API too, not only for genuine expiry — and the job runs up to 200 of
these sequentially with no backoff, exactly the shape that trips a rate
limit. Branch on the verifier's `reason`: only a genuine
google_subscription_expired/_canceled downgrades; any API-error or
unconfigured-verifier reason is now a soft error that leaves entitlement
untouched and retries next run.
EOF
)"
```

---

### Task 4 (HIGH): Public search hides minors on the opposite rule from every other minor-protection gate

Search's minor-hiding filter passes a `date_of_birth: null` user through — the opposite of `isMinor()`'s fail-closed semantics used everywhere else (confirmed: `isMinor(null DOB)` returns `true`, i.e. treated as a minor). DOB is optional at registration and only guaranteed non-null once onboarding completes, so any account that registers and doesn't finish onboarding is fully searchable in the interim.

**Files:**

- Modify: `server/src/routes/search.ts:104-116`
- Modify: `server/src/__tests__/search-unified.test.ts:28-43` (fixture needs a DOB — see Step 5, confirmed via grep that this file's user fixture currently has none)
- Create: `server/src/__tests__/search-coppa-visibility.test.ts` (new — no existing test covers this)

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/search-coppa-visibility.test.ts
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

function yearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d;
}

describe('Search — COPPA minor visibility', () => {
  let searcherToken: string;
  const userIds: string[] = [];

  async function makeUser(prefix: string, dob: Date | null, onboardingComplete: boolean) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `${prefix}-${ts}-${Math.random()}@example.com`,
        password_hash: hash,
        display_name: prefix,
        username: `${prefix}${String(ts).slice(-8)}`.slice(0, 20),
        email_verified: true,
        approval_status: 'APPROVED',
        date_of_birth: dob,
        onboarding_completed: onboardingComplete,
        preferences: { onboarding_completed: onboardingComplete, role: 'fan' },
      },
    });
    userIds.push(user.id);
    return user;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const searcher = await makeUser('coppasearcher', yearsAgo(30), true);
    searcherToken = signJwt({ id: searcher.id });

    await makeUser('coppaadult', yearsAgo(25), true);
    await makeUser('coppaminor', yearsAgo(15), true);
    await makeUser('coppanulldob', null, false);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('shows a verified adult in search', async () => {
    const res = await request(app)
      .get(`/search?q=coppaadult${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users?.length).toBeGreaterThan(0);
  });

  it('hides a 13-17 minor from search', async () => {
    const res = await request(app)
      .get(`/search?q=coppaminor${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users ?? []).toEqual([]);
  });

  it('hides a null-DOB (incomplete onboarding) account from search', async () => {
    const res = await request(app)
      .get(`/search?q=coppanulldob${String(ts).slice(-8)}`)
      .set('Authorization', `Bearer ${searcherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.users ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="search-coppa-visibility" --no-coverage`
Expected: the third test (`hides a null-DOB...`) FAILS — the null-DOB account currently passes through and appears in results.

- [ ] **Step 3: Fix the filter to fail closed**

```typescript
// server/src/routes/search.ts — replace lines ~104-109:
//     // COPPA: hide 13–17 minors from public search. Adults (DOB >= 18 years
//     // ago) and users with unknown DOB pass through, matching the existing
//     // `isMinor` fail-open behavior. The 18-year cutoff is computed in JS so
//     // Prisma can compare against the indexed `date_of_birth` column directly.
//     const eighteenYearsAgo = new Date();
//     eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
// with:

// COPPA: hide minors AND unknown-DOB accounts from public search —
// fail closed, matching isMinor()'s real semantics (null DOB = treated
// as a minor), not the inverted "unknown passes through" rule this
// filter previously implemented. DOB is optional at registration and
// only guaranteed non-null once onboarding completes, so this also
// correctly excludes accounts still mid-onboarding. The 18-year cutoff
// is computed in JS so Prisma can compare against the indexed
// `date_of_birth` column directly.
const eighteenYearsAgo = new Date();
eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
```

```typescript
// server/src/routes/search.ts — in the prisma.user.findMany where clause,
// replace:
//   {
//     OR: [{ date_of_birth: null }, { date_of_birth: { lte: eighteenYearsAgo } }],
//   } as any,
// with:
            { date_of_birth: { lte: eighteenYearsAgo } },
```

(Removing the wrapping `OR`/`as any` entirely — this becomes a plain AND-ed condition alongside the existing `banned: false` and exclude-ids clauses in the same `AND` array.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="search-coppa-visibility" --no-coverage`
Expected: PASS (3/3).

- [ ] **Step 5: Fix `search-unified.test.ts`'s fixture, which has no DOB today**

Confirmed via `grep -n "date_of_birth" server/src/__tests__/search-unified.test.ts` — zero matches. That file's fixture user (created at line 28, used at line 146: `expect(res.body?.users?.some((row: any) => row.id === userId)).toBe(true);` — a self-search assertion) has no `date_of_birth`, so after Step 3's fix this user would newly disappear from search results and that assertion would fail. Add a DOB to the fixture:

```typescript
// server/src/__tests__/search-unified.test.ts — in the prisma.user.create
// call at line 28, add date_of_birth alongside the existing fields:
const user = await prisma.user.create({
  data: {
    email: `search-unified-${ts}@example.com`,
    password_hash: passwordHash,
    display_name: 'Search Tester',
    username: `sut${String(ts).slice(-8)}`,
    email_verified: true,
    onboarding_completed: true,
    date_of_birth: new Date('1990-01-01'),
    role: 'fan',
    approval_status: 'APPROVED',
    preferences: {
      role: 'fan',
      onboarding_completed: true,
    },
  },
});
```

`search-date-query.test.ts` was also checked (`grep -n "date_of_birth" server/src/__tests__/search-date-query.test.ts` — no matches, and no `prisma.user.create` call in that file either) — it tests date-window matching on games/events only, not user search results, so it needs no fixture change.

- [ ] **Step 6: Run the broader search regression suites**

Run: `cd server && npm test -- --testPathPattern="search-unified|search-date-query" --no-coverage`
Expected: all pass, including the pre-existing self-search assertion at `search-unified.test.ts:146`.

- [ ] **Step 7: Typecheck and format**

```bash
npx tsc --noEmit --project server/tsconfig.json
npx prettier --write server/src/routes/search.ts server/src/__tests__/search-coppa-visibility.test.ts server/src/__tests__/search-unified.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add server/src/routes/search.ts server/src/__tests__/search-coppa-visibility.test.ts server/src/__tests__/search-unified.test.ts
git commit -m "$(cat <<'EOF'
fix(security): search fails closed on unknown DOB, matching isMinor()

Search's minor-hiding filter let a null date_of_birth pass through,
the opposite of isMinor()'s real semantics (null DOB = treated as a
minor) used everywhere else, including DM gating. DOB is optional at
registration and only guaranteed non-null once onboarding completes, so
any account that registered without it and hadn't finished onboarding
was fully searchable by username/avatar in the interim. Scope search to
verified-adult DOBs only.
EOF
)"
```

---

### Task 5 (MEDIUM): A failed program follow-fanout disappears into `console.error`, not Sentry

Both call sites of `fanOutProgramFollowersToTeam` catch any exception with a bare `console.error` — only the helper's own internal >5000-follower truncation case reaches Sentry. Any other exception (DB error, schema surprise) during fan-out is invisible outside raw Railway logs.

**Files:**

- Modify: `server/src/routes/teams.ts:2031-2035` (create path) and `:2328-2334` (PUT path), plus the import line

- [ ] **Step 1: Add the `captureException` import**

```typescript
// server/src/routes/teams.ts — add to the existing imports (near the top,
// alongside other ../lib/* imports):
import { captureException } from '../lib/sentry.js';
```

(Confirmed via `grep -n "captureException" server/src/routes/teams.ts` — not currently imported.)

- [ ] **Step 2: Fix the create-path catch**

```typescript
// server/src/routes/teams.ts — replace:
//       try {
//         await fanOutProgramFollowersToTeam(prisma, (team as any).program_id, team.id);
//       } catch (fanoutError) {
//         console.error('[program-fanout] create-path fan-out failed (non-blocking):', fanoutError);
//       }
// with:
try {
  await fanOutProgramFollowersToTeam(prisma, (team as any).program_id, team.id);
} catch (fanoutError) {
  console.error('[program-fanout] create-path fan-out failed (non-blocking):', fanoutError);
  captureException(fanoutError instanceof Error ? fanoutError : new Error(String(fanoutError)), {
    context: 'program_fanout_create',
    programId: (team as any).program_id,
    teamId: team.id,
  });
}
```

- [ ] **Step 3: Fix the PUT-path catch**

```typescript
// server/src/routes/teams.ts — replace:
//         try {
//           await fanOutProgramFollowersToTeam(prisma, fanOutProgramId, updatedTeam.id);
//         } catch (fanoutError) {
//           console.error('[program-fanout] PUT-path fan-out failed (non-blocking):', fanoutError);
//         }
// with:
try {
  await fanOutProgramFollowersToTeam(prisma, fanOutProgramId, updatedTeam.id);
} catch (fanoutError) {
  console.error('[program-fanout] PUT-path fan-out failed (non-blocking):', fanoutError);
  captureException(fanoutError instanceof Error ? fanoutError : new Error(String(fanoutError)), {
    context: 'program_fanout_put',
    programId: fanOutProgramId,
    teamId: updatedTeam.id,
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit --project server/tsconfig.json`
Expected: 0 errors.

- [ ] **Step 5: Run the program-fanout regression suite**

Run: `cd server && npm test -- --testPathPattern="program-follow-fanout|program-screen-summary" --no-coverage`
Expected: all pass — no behavior change to the happy path, only to what happens on an exception.

- [ ] **Step 6: Format and commit**

```bash
npx prettier --write server/src/routes/teams.ts
git add server/src/routes/teams.ts
git commit -m "$(cat <<'EOF'
fix(observability): capture program fan-out failures to Sentry

Both fanOutProgramFollowersToTeam call sites (team create, team PUT)
caught any exception with a bare console.error — only the helper's own
internal >5000-follower truncation case reached Sentry. Any other
exception (DB error, schema surprise) silently left existing program
followers without a TeamFollow row for the newly-added team, with no
alert. Capture alongside the console.error, matching the pattern already
used inside the helper itself.
EOF
)"
```

---

### Task 6 (MEDIUM): The onboarding bypass checks admin email without the verified-email requirement

`requireOnboarded`'s god-admin bypass calls `isEmailAdmin(u?.email)` with no `email_verified` check — violating this codebase's own written invariant (`requireAdmin.ts:30`: "Admin privilege ALWAYS requires a verified email — the bare isEmailAdmin() string check must never gate access on its own").

**Files:**

- Modify: `server/src/middleware/requireOnboarded.ts:24-40` (the select) and `:56-59` (the bypass check)
- Modify: `server/src/__tests__/requireOnboarded-bypass.test.ts` — this file already exists, is a static/structural (no-DB) source check over `requireOnboarded.ts`/`requireVerified.ts`, and is the correct, established home for this test (matches the same static-check pattern already used by `admin-email-allowlist-floor.test.ts` and `stripe-subscription-guard.test.ts`'s "wires the guard" check).

**Interfaces:**

- Consumes: the module-level `onboardedSrc` string (`readFileSync` of `requireOnboarded.ts`) already loaded at the top of this test file — no new fixture needed.

- [ ] **Step 1: Write the failing test**

```typescript
// server/src/__tests__/requireOnboarded-bypass.test.ts — add this test
// inside the existing describe('onboarding-create middleware boundaries', ...)
// block, alongside the other structural checks in that file:

it('requires a verified email before the god-admin bypass short-circuits requireOnboarded', () => {
  // Admin privilege must always require a verified email (requireAdmin.ts:
  // "the bare isEmailAdmin() string check must never gate access alone").
  // The god-admin bypass line in requireOnboarded.ts must check
  // email_verified in the same condition as isEmailAdmin(), not separately
  // or not at all.
  const bypassLine = onboardedSrc.match(/if\s*\(\s*isEmailAdmin\([^)]*\)[^{]*\)\s*\{/);
  expect(bypassLine).not.toBeNull();
  expect(bypassLine![0]).toMatch(/email_verified/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="requireOnboarded-bypass" --no-coverage`
Expected: the new test FAILS — today's bypass line is `if (isEmailAdmin(u?.email)) {`, which does not match `/email_verified/`.

- [ ] **Step 3: Add `email_verified` to the direct-fetch select**

```typescript
// server/src/middleware/requireOnboarded.ts — in the direct prisma.user.findUnique
// select (used when req._dbUser isn't already cached), add email_verified:
      select: {
        preferences: true,
        approval_status: true,
        email: true,
        email_verified: true,
        role: true,
        onboarding_completed: true,
        coach_agreement_accepted_at: true,
        coach_agreement_version: true,
      },
```

(No change needed to the cached `req._dbUser` path — `server/src/middleware/auth.ts`'s select already includes `email_verified: true`, confirmed present.)

- [ ] **Step 4: Require verified email in the bypass check**

```typescript
// server/src/middleware/requireOnboarded.ts — replace:
//   // God-admins bypass all onboarding/approval checks
//   if (isEmailAdmin(u?.email)) {
//     return next();
//   }
// with:
// God-admins bypass all onboarding/approval checks — email must be
// verified, same invariant requireAdmin.ts enforces (2026-07-13 audit):
// the bare isEmailAdmin() string check must never gate access alone.
if (isEmailAdmin(u?.email) && (u as any)?.email_verified) {
  return next();
}
```

- [ ] **Step 5: Run test to verify it passes**

Re-run the test from Step 1/2. Expected: PASS.

- [ ] **Step 6: Run the broader onboarding regression suites**

Run: `cd server && npm test -- --testPathPattern="requireOnboarded-bypass|coach-gate-matrix" --no-coverage`
Expected: all pass — these suites exercise the legitimate (non-admin) onboarding-bypass paths this change must not affect.

- [ ] **Step 7: Typecheck and format**

```bash
npx tsc --noEmit --project server/tsconfig.json
npx prettier --write server/src/middleware/requireOnboarded.ts
```

- [ ] **Step 8: Commit**

```bash
git add server/src/middleware/requireOnboarded.ts server/src/__tests__/requireOnboarded-bypass.test.ts
git commit -m "$(cat <<'EOF'
fix(security): requireOnboarded's admin bypass now requires a verified email

The god-admin bypass called isEmailAdmin(u?.email) with no
email_verified check, violating this codebase's own written invariant
(requireAdmin.ts: "the bare isEmailAdmin() string check must never gate
access on its own"). Exploitability today is near-theoretical — the
admin-equivalent addresses are already registered and the unique-email
constraint blocks anyone else from claiming them — but the gap only
needs one future email-change bug to become real. Add the same check
every other admin gate in this codebase already uses.
EOF
)"
```

---

### Task 7 (LOW/MEDIUM): JSON screen-summary endpoints don't document their guest-access intent

The HTML share-landing for a program refuses to render anything for an org pending admin approval; the JSON `screen-summary` endpoints for the same team/program have no equivalent check and no comment explaining why. This is deliberately NOT a behavior change — `programs.ts`'s own comment states the endpoint is intentionally guest-accessible ("program-page is a GUEST_BROWSE_ROUTE_SEGMENT and the canonical public surface"), and adding an approval gate risks breaking a legitimate flow (an org owner previewing their own not-yet-approved org's team/program page) that hasn't been independently confirmed to exist or not exist. Document the gap with an explicit `// intent:` note instead of changing behavior, per this repo's own stated pattern for an intentional frontend/backend (here: HTML/JSON) deviation.

**Files:**

- Modify: `server/src/routes/teams.ts:965-976` (top of the `/:id/screen-summary` handler)
- Modify: `server/src/routes/programs.ts:33-40` (top of the `/:id/screen-summary` handler)

- [ ] **Step 1: Add the intent note to `teams.ts`**

```typescript
// server/src/routes/teams.ts — immediately above the '/:id/screen-summary'
// route registration (before `teamsRouter.get('/:id/screen-summary', ...)`
// at line ~965), add:

// intent: this JSON endpoint does NOT gate on organization.admin_approved,
// unlike the HTML share-landing for the same team (shareLanding.ts), which
// explicitly refuses to render anything for a pending-approval org. This
// endpoint is guest-accessible by the same design as programs.ts's
// screen-summary (the app itself needs to preview a team/program before its
// org is approved, e.g. during a coach's own onboarding flow). Exploitability
// via this gap is low — it requires knowing an unguessable team ID before
// approval — but it is a deliberate choice, not an oversight. Flagged in the
// 2026-08-23 Trust Boundary Review.
```

- [ ] **Step 2: Add the matching intent note to `programs.ts`**

```typescript
// server/src/routes/programs.ts — immediately above the '/:id/screen-summary'
// route registration (before `programsRouter.get('/:id/screen-summary', ...)`),
// add:

// intent: mirrors the same guest-accessible-without-admin_approved-gate
// posture as GET /teams/:id/screen-summary (see that route's comment) —
// inherited, not introduced by the Sport-Program work. Flagged in the
// 2026-08-23 Trust Boundary Review; not changed pending confirmation of
// whether the org-owner pre-approval preview flow this exemption protects
// actually exists in the client.
```

- [ ] **Step 3: Typecheck (comment-only change, should be a no-op)**

Run: `npx tsc --noEmit --project server/tsconfig.json`
Expected: 0 errors (no logic changed).

- [ ] **Step 4: Format and commit**

```bash
npx prettier --write server/src/routes/teams.ts server/src/routes/programs.ts
git add server/src/routes/teams.ts server/src/routes/programs.ts
git commit -m "$(cat <<'EOF'
docs(security): document the screen-summary admin_approved gap as intentional

The HTML share-landing for a program gates on organization.admin_approved;
the JSON screen-summary endpoints for the same team/program don't, with
no comment explaining why. Rather than add a gate that might break an
unconfirmed org-owner pre-approval preview flow, document the deviation
explicitly per this repo's // intent: convention — flagged in the
2026-08-23 Trust Boundary Review as low-severity (requires an unguessable
pre-approval ID) but worth a conscious record either way.
EOF
)"
```

---

## Final Verification (after all 7 tasks)

- [ ] Run the full server suite on a clean tree: `cd server && npm test` — expect the same pass/skip counts as the pre-existing baseline (293-294 suites, ~2790+ tests, 0 new failures). If the count differs from what Task-level runs predicted, investigate before considering this plan done — per the 2026-08-22 lesson on this branch, task-scoped green is not sufficient evidence.
- [ ] `npx tsc --noEmit --project server/tsconfig.json` — 0 errors.
- [ ] `npm run format:check` (repo root) — passes.
- [ ] `npm run verify:error-envelope` and `npm run verify:async-handlers` (repo root) — no new violations.
- [ ] Re-read the original audit's 3 "Confirmed still holding" sections for Teams/Orgs, Payments, and Auth — spot-check that none of the 7 fixes above accidentally changed behavior any of those confirmed-good invariants depend on (e.g. Task 1's `isTeamHiddenFromViewer` refactor must not change its behavior for org-admin or team-member viewers — Step 6 of Task 1 already covers this via `privacy-surfaces.test.ts`/`authz-matrix-fixes.test.ts`, but re-confirm at the end with the full suite, not just those two files in isolation).
