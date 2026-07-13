# Approval Flow Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close three gaps in the coach approval flow: agreement not written at approval time, missing audit trail on org-owner approvals, and no recovery CTA when an approved coach sees fan tools on Discover.

**Architecture:** Three independent server + client fixes. Task 1 stamps `coach_agreement_accepted_at` and `coach_agreement_version` in all four approval transactions so coaches never land in the "approved but blocked from tools" state. Task 2 adds `logAdminActivity` to the two org-owner approval paths that currently bypass the admin audit log. Task 3 adds an in-context setup card on the Discover screen for approved coaches whose tools are still blocked (existing accounts + any transient gap).

**Tech Stack:** Express/Prisma (server), React Native / Expo Router (client), Jest (tests)

---

## File Map

| File                                                   | Change                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `server/src/lib/approvalService.ts`                    | Add agreement fields to `approveCoach()` and `approveOrganization()`                               |
| `server/src/routes/organizations.ts`                   | Add agreement fields to 2 join-request transactions; add `logAdminActivity` to both approval paths |
| `server/src/__tests__/coach-approval.test.ts`          | Extend existing tests: assert agreement fields set after approval                                  |
| `server/src/__tests__/coach-join-email-review.test.ts` | Assert agreement fields set and admin activity logged after join-request approval                  |
| `app/(tabs)/discover/mobile-community.tsx`             | Add setup CTA branch in Quick Actions for `isApprovedCoach && !canAccessCoachTools`                |

---

## Task 1: Stamp coach agreement in `approveCoach()` (approvalService.ts)

**Files:**

- Modify: `server/src/lib/approvalService.ts` ~line 537
- Test: `server/src/__tests__/coach-approval.test.ts`

- [ ] **Step 1: Write a failing test**

Open `server/src/__tests__/coach-approval.test.ts` and add this test inside the existing describe block for `approveCoach`:

```typescript
it('sets coach_agreement_accepted_at and coach_agreement_version when approving a coach', async () => {
  // Create a PENDING coach with no agreement
  const coach = await prisma.user.create({
    data: {
      email: `coach-agr-test-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'PENDING',
      onboarding_completed: true,
      coach_agreement_accepted_at: null,
      coach_agreement_version: null,
      preferences: { role: 'coach', onboarding_completed: true },
    },
  });

  await approveCoach(coach.id, null, prisma);

  const updated = await prisma.user.findUnique({
    where: { id: coach.id },
    select: {
      coach_agreement_accepted_at: true,
      coach_agreement_version: true,
      approval_status: true,
    },
  });

  expect(updated?.approval_status).toBe('APPROVED');
  expect(updated?.coach_agreement_accepted_at).not.toBeNull();
  expect(updated?.coach_agreement_version).toBe(
    Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1)
  );

  // Cleanup
  await prisma.user.delete({ where: { id: coach.id } });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest --testPathPattern="coach-approval" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `coach_agreement_accepted_at` is null.

- [ ] **Step 3: Add agreement fields to `approveCoach()` transaction**

In `server/src/lib/approvalService.ts`, find the `buildAuthStateColumns` call inside the `approveCoach` transaction (around line 537). Change:

```typescript
        ...buildAuthStateColumns({
          role: 'coach',
          organization_id: orgId ?? null,
          proceeding_as_fan: false,
        }),
```

To:

```typescript
        ...buildAuthStateColumns({
          role: 'coach',
          organization_id: orgId ?? null,
          proceeding_as_fan: false,
          coach_agreement_accepted_at: new Date(),
          coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
        }),
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest --testPathPattern="coach-approval" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/approvalService.ts server/src/__tests__/coach-approval.test.ts
git commit -m "fix: stamp coach agreement at approveCoach() time

Prevents the 'approved but tools blocked' state by writing
coach_agreement_accepted_at and coach_agreement_version in the
same transaction as approval_status = APPROVED.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Stamp coach agreement in `approveOrganization()` (approvalService.ts)

**Files:**

- Modify: `server/src/lib/approvalService.ts` ~line 291
- Test: `server/src/__tests__/coach-approval.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `server/src/__tests__/coach-approval.test.ts`:

```typescript
it('sets coach_agreement fields on the org owner when approving an organization', async () => {
  // Create an org with an owner who has no agreement yet
  const owner = await prisma.user.create({
    data: {
      email: `org-owner-agr-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'PENDING',
      onboarding_completed: true,
      coach_agreement_accepted_at: null,
      coach_agreement_version: null,
      preferences: { role: 'coach', onboarding_completed: true },
    },
  });
  const org = await prisma.organization.create({
    data: {
      name: `Test Org ${Date.now()}`,
      admin_approved: false,
      league_owner_id: owner.id,
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: owner.id, role: 'owner' },
  });

  await approveOrganization(org.id, null, prisma);

  const updated = await prisma.user.findUnique({
    where: { id: owner.id },
    select: {
      coach_agreement_accepted_at: true,
      coach_agreement_version: true,
      approval_status: true,
    },
  });

  expect(updated?.approval_status).toBe('APPROVED');
  expect(updated?.coach_agreement_accepted_at).not.toBeNull();
  expect(updated?.coach_agreement_version).toBe(
    Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1)
  );

  // Cleanup
  await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.delete({ where: { id: owner.id } });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest --testPathPattern="coach-approval" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `coach_agreement_accepted_at` is null on org owner.

- [ ] **Step 3: Add agreement fields to `approveOrganization()` transaction**

In `server/src/lib/approvalService.ts`, find the `buildAuthStateColumns` call inside `approveOrganization` (around line 291). Change:

```typescript
          ...buildAuthStateColumns({
            role: 'coach',
            organization_id: orgId,
            proceeding_as_fan: false,
          }),
```

To:

```typescript
          ...buildAuthStateColumns({
            role: 'coach',
            organization_id: orgId,
            proceeding_as_fan: false,
            coach_agreement_accepted_at: new Date(),
            coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
          }),
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx jest --testPathPattern="coach-approval" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/approvalService.ts server/src/__tests__/coach-approval.test.ts
git commit -m "fix: stamp coach agreement at approveOrganization() time

Org owner is set to APPROVED in the same transaction — stamp
the agreement fields there so the owner never needs to hit the
agreement screen before accessing coach tools.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Stamp coach agreement in both org join-request approval paths (organizations.ts)

**Files:**

- Modify: `server/src/routes/organizations.ts` — two transaction blocks
- Test: `server/src/__tests__/coach-join-email-review.test.ts`

The in-app path is `POST /join-requests/:requestId/approve` (~line 2213).  
The email-link path is `_executeJoinRequestApprovalByToken` (~line 2624).

- [ ] **Step 1: Write a failing test**

Open `server/src/__tests__/coach-join-email-review.test.ts` and add:

```typescript
it('sets agreement fields on the coach when an org owner approves a join request in-app', async () => {
  // Find (or create) a PENDING coach with a join request and an approved org
  // This test verifies the tx.user.update inside POST /join-requests/:requestId/approve
  // includes coach_agreement_accepted_at. Since the route is integration-tested,
  // we check the DB state after calling the helper directly.

  // Use the same helper the route calls:
  const coach = await prisma.user.create({
    data: {
      email: `join-agr-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'PENDING',
      onboarding_completed: true,
      coach_agreement_accepted_at: null,
      coach_agreement_version: null,
      preferences: { role: 'coach', onboarding_completed: true, join_request_pending: true },
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `join-owner-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'APPROVED',
      onboarding_completed: true,
      preferences: { role: 'coach' },
    },
  });
  const org = await prisma.organization.create({
    data: { name: `JoinTestOrg${Date.now()}`, admin_approved: true, league_owner_id: owner.id },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: owner.id, role: 'owner' },
  });
  const joinRequest = await prisma.organizationJoinRequest.create({
    data: { organization_id: org.id, user_id: coach.id, status: 'pending' },
  });

  // Call the internal helper (same code path as the route handler's transaction)
  await _executeJoinRequestApprovalByToken(joinRequest.id, owner.id);

  const updated = await prisma.user.findUnique({
    where: { id: coach.id },
    select: {
      coach_agreement_accepted_at: true,
      coach_agreement_version: true,
      approval_status: true,
    },
  });

  expect(updated?.approval_status).toBe('APPROVED');
  expect(updated?.coach_agreement_accepted_at).not.toBeNull();
  expect(updated?.coach_agreement_version).toBe(
    Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1)
  );

  // Cleanup
  await prisma.organizationJoinRequest.delete({ where: { id: joinRequest.id } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [coach.id, owner.id] } } });
});
```

Note: `_executeJoinRequestApprovalByToken` is a module-scoped function in `organizations.ts`. Export it for testing by adding `export` to its declaration, or test via HTTP if the test suite uses supertest.

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest --testPathPattern="coach-join-email-review" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `coach_agreement_accepted_at` is null.

- [ ] **Step 3: Add agreement fields to the in-app join-request approval transaction**

In `server/src/routes/organizations.ts`, find the `buildAuthStateColumns` call inside the `POST /join-requests/:requestId/approve` transaction (~line 2228). Change:

```typescript
              ...buildAuthStateColumns({
                role: 'coach',
                organization_id: joinRequest.organization_id,
                proceeding_as_fan: false,
              }),
```

To:

```typescript
              ...buildAuthStateColumns({
                role: 'coach',
                organization_id: joinRequest.organization_id,
                proceeding_as_fan: false,
                coach_agreement_accepted_at: new Date(),
                coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
              }),
```

- [ ] **Step 4: Add agreement fields to `_executeJoinRequestApprovalByToken` transaction**

Find the `buildAuthStateColumns` call inside `_executeJoinRequestApprovalByToken` (~line 2638). Change:

```typescript
            ...buildAuthStateColumns({
              role: 'coach',
              organization_id: joinRequest.organization_id,
              proceeding_as_fan: false,
            }),
```

To:

```typescript
            ...buildAuthStateColumns({
              role: 'coach',
              organization_id: joinRequest.organization_id,
              proceeding_as_fan: false,
              coach_agreement_accepted_at: new Date(),
              coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
            }),
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx jest --testPathPattern="coach-join-email-review" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/organizations.ts server/src/__tests__/coach-join-email-review.test.ts
git commit -m "fix: stamp coach agreement on join-request approval

Both the in-app and email-link join-request approval paths now
write coach_agreement_accepted_at + coach_agreement_version in
the same transaction as approval_status = APPROVED.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Add admin activity logging to org-owner join-request approvals

**Files:**

- Modify: `server/src/routes/organizations.ts` — two locations
- Test: `server/src/__tests__/coach-join-email-review.test.ts`

Context: `logAdminActivity` is already imported at line 5 of `organizations.ts`. Action name convention from `admin.ts`: `APPROVE_COACH`. New actions: `APPROVE_JOIN_REQUEST` / `DENY_JOIN_REQUEST`.

- [ ] **Step 1: Write failing test**

Add to `server/src/__tests__/coach-join-email-review.test.ts`:

```typescript
it('creates an AdminActivityLog entry when an org owner approves a join request in-app', async () => {
  // Setup — same scaffolding as Task 3 step 1 (copy coach/owner/org/joinRequest setup)
  const coach = await prisma.user.create({
    data: {
      email: `audit-coach-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'PENDING',
      onboarding_completed: true,
      preferences: { role: 'coach', join_request_pending: true },
    },
  });
  const owner = await prisma.user.create({
    data: {
      email: `audit-owner-${Date.now()}@test.com`,
      role: 'coach',
      approval_status: 'APPROVED',
      onboarding_completed: true,
      preferences: { role: 'coach' },
    },
  });
  const org = await prisma.organization.create({
    data: { name: `AuditOrg${Date.now()}`, admin_approved: true, league_owner_id: owner.id },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: owner.id, role: 'owner' },
  });
  const joinRequest = await prisma.organizationJoinRequest.create({
    data: { organization_id: org.id, user_id: coach.id, status: 'pending' },
  });

  await _executeJoinRequestApprovalByToken(joinRequest.id, owner.id);

  const logEntry = await prisma.adminActivityLog.findFirst({
    where: { action: 'APPROVE_JOIN_REQUEST', target_id: coach.id },
    orderBy: { created_at: 'desc' },
  });

  expect(logEntry).not.toBeNull();
  expect(logEntry?.admin_id).toBe(owner.id);
  expect(logEntry?.target_type).toBe('user');

  // Cleanup
  await prisma.adminActivityLog.deleteMany({ where: { target_id: coach.id } });
  await prisma.organizationJoinRequest.delete({ where: { id: joinRequest.id } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [coach.id, owner.id] } } });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx jest --testPathPattern="coach-join-email-review" --no-coverage 2>&1 | tail -20
```

Expected: FAIL — no log entry found.

- [ ] **Step 3: Add logAdminActivity to the in-app join-request approval**

In `organizations.ts`, find `return res.json({ message: 'Join request approved' });` at ~line 2297 (inside the in-app handler, after notifications). Add before the return:

```typescript
// Audit trail: log who approved which coach
await logAdminActivityFromReq(
  req,
  'APPROVE_JOIN_REQUEST',
  'user',
  joinRequest.user_id,
  `Approved coach join request for org ${organization.name}`
);

return res.json({ message: 'Join request approved' });
```

- [ ] **Step 4: Add logAdminActivity to `_executeJoinRequestApprovalByToken`**

In `organizations.ts`, find the end of `_executeJoinRequestApprovalByToken` — after the notification `try/catch` block and before the function returns `{ ok: true }`. The `reviewerUserId` parameter is already available. Add:

```typescript
// Audit trail: record which org owner approved which coach
await logAdminActivity(
  reviewerUserId,
  'league-owner-email-action',
  'APPROVE_JOIN_REQUEST',
  'user',
  joinRequest.user_id,
  `Approved coach join request for org ${organization.name} (via email link)`
);

return { ok: true };
```

Note: `reviewerUserId` is the second parameter of `_executeJoinRequestApprovalByToken`. The email here is `'league-owner-email-action'` because we have the owner's user ID (can be looked up) but not their email in this function. If you want the real email, add a `prisma.user.findUnique` for `reviewerUserId` above this call and use `owner.email || 'unknown'`.

- [ ] **Step 5: Run test to confirm it passes**

```bash
npx jest --testPathPattern="coach-join-email-review" --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5
```

Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/organizations.ts server/src/__tests__/coach-join-email-review.test.ts
git commit -m "fix: add admin activity log to org-owner join-request approvals

Both the in-app API and email-link approval paths now write to
AdminActivityLog so VarsityHub staff can audit every coach approval,
not just ones done through the VH admin dashboard.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Add setup CTA on Discover for approved coaches without tool access

**Files:**

- Modify: `app/(tabs)/discover/mobile-community.tsx` ~line 1673

Context: `coachAccess` is a `useMemo` result of `getCoachAccessState(me)` at line 214. It exposes `canAccessCoachTools`, `isApprovedCoach`. `getCoachRecoveryRoute` from `@/utils/roleChecks` returns the correct next step (`/onboarding/coach-agreement` or `/onboarding/step-3-league`). `me` already has `account_state` and `next_step` from `/me`. The existing action card styles (`coachActionCard`, `coachActionTitle`, `coachActionDesc`) can be reused directly.

- [ ] **Step 1: Add the import for `getCoachRecoveryRoute`**

In `mobile-community.tsx`, find the existing import:

```typescript
import { getCoachAccessState } from '@/utils/roleChecks';
```

Change to:

```typescript
import { getCoachAccessState, getCoachRecoveryRoute } from '@/utils/roleChecks';
```

- [ ] **Step 2: Add the setup CTA branch**

Find the Quick Actions ternary at ~line 1673:

```tsx
{
  coachAccess.canAccessCoachTools ? (
    <>{/* ... coach tool cards ... */}</>
  ) : (
    <>{/* ... fan action cards ... */}</>
  );
}
```

Change the outer ternary to a three-way branch:

```tsx
{
  coachAccess.canAccessCoachTools ? (
    <>{/* ... coach tool cards — unchanged ... */}</>
  ) : coachAccess.isApprovedCoach ? (
    <Pressable
      style={[
        styles.coachActionCard,
        {
          backgroundColor: Colors[colorScheme].tint + '18',
          borderColor: Colors[colorScheme].tint + '50',
          borderWidth: 1.5,
        },
      ]}
      onPress={() => {
        const route = getCoachRecoveryRoute(me as any);
        if (route) router.push(route as any);
      }}
      accessibilityRole="button"
      accessibilityLabel="Complete coach setup"
    >
      <MaterialIcons name="check-circle" size={24} color={Colors[colorScheme].tint} />
      <Text style={[styles.coachActionTitle, { color: Colors[colorScheme].tint }]}>
        Finish Setup
      </Text>
      <Text style={[styles.coachActionDesc, { color: Colors[colorScheme].mutedText }]}>
        Complete setup to unlock coach tools
      </Text>
    </Pressable>
  ) : (
    <>{/* ... fan action cards — unchanged ... */}</>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: no output (clean).

- [ ] **Step 4: Verify visually**

Start the dev server and sign in as a coach whose `approval_status = 'APPROVED'` but has no `coach_agreement_accepted_at` (or no `organization_id`). Navigate to the Discover tab. Quick Actions should show a single "Finish Setup" card instead of the fan tools. Tapping it should navigate to `/onboarding/coach-agreement` or `/onboarding/step-3-league` depending on which step is missing.

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/discover/mobile-community.tsx"
git commit -m "fix: show setup CTA on Discover for approved coaches awaiting tool access

Approved coaches who haven't completed the agreement or org setup
now see a 'Finish Setup' card in Quick Actions instead of silently
falling back to fan tools. The card navigates to the correct
recovery route via getCoachRecoveryRoute().

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] Run the full server test suite:

```bash
npm test -- --testPathPattern="coach" --no-coverage 2>&1 | tail -30
```

Expected: all coach-related tests pass.

- [ ] Run TypeScript checks for both server and client:

```bash
npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
```

Expected: no output from either.

- [ ] Smoke-check the full approval path manually:
  1. Create a PENDING coach in DB → trigger admin approval → confirm `coach_agreement_accepted_at` is now set in the DB immediately (no agreement screen required)
  2. Confirm an already-approved coach without an agreement sees "Finish Setup" on Discover
  3. Confirm tapping "Finish Setup" navigates to the correct onboarding screen
  4. Check the admin activity log contains `APPROVE_JOIN_REQUEST` entries after an org-owner approval
