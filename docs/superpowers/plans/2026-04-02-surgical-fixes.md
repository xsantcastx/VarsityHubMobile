# Surgical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 broken features that were built but never fully wired end-to-end in the live VarsityHubMobile app.

**Architecture:** Each fix is isolated — no dependencies between them. All changes are additive (no destructive modifications). Server changes go through existing Express route patterns; client changes are surgical edits to existing files.

**Tech Stack:** React Native / Expo SDK 55, Express.js, Prisma ORM, PostgreSQL, expo-notifications, Stripe

---

## Task 1: Verify Push Notification Token Registration

**Context:** The deep audit revealed that push token registration is ALREADY IMPLEMENTED. `AuthProvider.tsx` has `setupPushNotifications()` which calls `User.updatePreferences({ push_token: token })`, and the server `PATCH /me/preferences` endpoint accepts `push_token`. The function `registerPushToken()` is exposed via auth context and called from sign-in flows. This task verifies it works and ensures it runs on every app launch, not just initial sign-in.

**Files:**
- Inspect: `context/AuthProvider.tsx:136-347`
- Inspect: `api/user.ts:13`
- Inspect: `server/src/routes/auth.ts:1104-1210`
- Inspect: `server/src/lib/notifications.ts:34-102`

- [ ] **Step 1: Read the current registerPushToken flow in AuthProvider.tsx**

Verify these pieces exist and are connected:
1. `setupPushNotifications()` function (line ~136) that gets the Expo push token and calls `User.updatePreferences()`
2. `registerPushToken` callback (line ~344) exposed in context
3. That `registerPushToken()` is called after login in sign-in flows

- [ ] **Step 2: Check if registerPushToken runs on app resume (not just login)**

Look at the `useEffect` hooks in AuthProvider. If `registerPushToken()` is only called from sign-in.tsx, it won't re-register on app relaunch. Check if there's a post-auth `useEffect` that calls it when the user is already logged in (e.g., token restored from storage).

If missing, add a `useEffect` in AuthProvider that calls `registerPushToken()` when `user` becomes non-null:

```typescript
// In AuthProvider.tsx, after the existing useEffects
useEffect(() => {
  if (user?.id && !isLoading) {
    registerPushToken();
  }
}, [user?.id, isLoading]);
```

- [ ] **Step 3: Verify the server endpoint accepts and persists push_token**

Read `server/src/routes/auth.ts` line 1104-1210 and confirm:
1. The Zod schema includes `push_token: z.string().optional()`
2. The handler merges it into the user's `preferences` JSON field
3. `push_token` is NOT in the "protected keys" strip list

- [ ] **Step 4: Verify sendPushNotification reads from the right field**

Read `server/src/lib/notifications.ts` lines 34-102 and confirm:
1. It reads `prefs?.push_token`
2. It validates with `Expo.isExpoPushToken(pushToken)`
3. It silently returns `[]` if token is missing (no crash)

- [ ] **Step 5: Test end-to-end**

1. Start the dev server: `cd server && npm run dev`
2. Log in on the app
3. Check Railway logs or local server logs for the `PATCH /me/preferences` call containing `push_token`
4. Check the database: `npx prisma studio` → User table → find your user → verify `preferences.push_token` contains an `ExponentPushToken[...]` value

- [ ] **Step 6: Commit if any changes were made**

```bash
git add context/AuthProvider.tsx
git commit -m "fix: ensure push token registers on every app launch, not just sign-in"
```

---

## Task 2: Set Stripe Price IDs in Railway

**Context:** The server checkout handler at `server/src/routes/payments.ts` reads `STRIPE_PRICE_VETERAN` and `STRIPE_PRICE_LEGEND` env vars. If not set, it logs "Stripe price ID not configured" and checkout fails. This is a config-only fix — no code changes.

**Files:**
- Inspect: `server/src/routes/payments.ts:270-300` (to confirm env var names)

- [ ] **Step 1: Confirm the env var names used in server code**

Read `server/src/routes/payments.ts` around lines 270-300. Look for:
```typescript
process.env.STRIPE_PRICE_VETERAN
process.env.STRIPE_PRICE_LEGEND
```
Note the exact variable names and how they're used (as Stripe `price` parameter in checkout session creation).

- [ ] **Step 2: Create Stripe price objects (if they don't exist)**

In the Stripe Dashboard (https://dashboard.stripe.com):
1. Create a recurring price for Veteran: $1.00/month
2. Create a recurring price for Legend: $20.00/year
3. Copy both price IDs (format: `price_xxxxx`)

- [ ] **Step 3: Set env vars in Railway**

In Railway dashboard → project `capable-trust` → service `api` → Variables:
```
STRIPE_PRICE_VETERAN=price_xxxxx
STRIPE_PRICE_LEGEND=price_xxxxx
```

**IMPORTANT:** This will trigger a redeploy. Verify the service comes back healthy.

- [ ] **Step 4: Verify checkout works**

On an Android device/emulator:
1. Navigate to billing/subscription screen
2. Attempt to subscribe to Veteran plan
3. Confirm Stripe PaymentSheet appears with correct $1.00/month price
4. Cancel (don't actually pay) — just verify the session was created

---

## Task 3: Ungate Admin Dashboard

**Context:** `app/admin-dashboard.tsx` line 2 exports `ComingSoon` instead of the real component. The full dashboard UI exists below (pending leagues, pending coaches, stats) but is unreachable. Server endpoints for admin operations already enforce admin role checks.

**Files:**
- Modify: `app/admin-dashboard.tsx:2`

- [ ] **Step 1: Read the current gate**

```bash
head -5 app/admin-dashboard.tsx
```

Expected line 2:
```typescript
export { default } from '@/components/ComingSoon';
```

- [ ] **Step 2: Remove the ComingSoon gate**

Delete line 2 (`export { default } from '@/components/ComingSoon';`). The file already has a default export of the real `AdminDashboardScreen` component further down, which uses `useRequireAdmin()` for access control.

- [ ] **Step 3: Verify the screen renders**

1. Run the app: `npx expo run:ios`
2. Log in as an admin user
3. Navigate to admin dashboard
4. Confirm you see: pending leagues section, pending coaches section, stats grid

- [ ] **Step 4: Commit**

```bash
git add app/admin-dashboard.tsx
git commit -m "fix: ungate admin dashboard to enable league and coach approvals"
```

---

## Task 4: Fix Admin Coach Approval — Create Org Membership

**Context:** `POST /admin/coaches/:id/approve` in `server/src/routes/admin.ts` (lines 173-233) sets `approval_status = APPROVED` but does NOT create an `OrganizationMembership` record. The coach is "approved" but has no org affiliation. The org-owner approval handler at `server/src/routes/organizations.ts:1689-1819` does this correctly — we replicate its logic.

**Files:**
- Modify: `server/src/routes/admin.ts:173-233`
- Reference: `server/src/routes/organizations.ts:1689-1819` (correct pattern)

- [ ] **Step 1: Read the current admin handler**

Read `server/src/routes/admin.ts` lines 173-233. Note what it currently does:
1. Finds user by ID
2. Checks `approval_status === 'PENDING'`
3. Updates `approval_status` to `'APPROVED'`
4. Logs admin action
5. Sends email + push notification
6. Returns `{ ok: true }`

What's MISSING: no join request lookup, no org membership creation, no transaction.

- [ ] **Step 2: Read the org-owner handler for reference**

Read `server/src/routes/organizations.ts` lines 1689-1819. Note what it does that the admin handler doesn't:
1. Looks up pending `OrganizationJoinRequest`
2. Creates `OrganizationMembership` with role `'coach'`
3. Updates join request to `'approved'`
4. Sets `paid_by_owner: true`
5. Uses `$transaction` for atomicity
6. Persists org info into user preferences
7. Handles P2002 unique constraint violation

- [ ] **Step 3: Update the admin coach approval handler**

In `server/src/routes/admin.ts`, replace the section after the `approval_status !== 'PENDING'` check with a full workflow. The key addition — after finding the user and confirming they're pending:

```typescript
// Look up pending join request to find which org the coach applied to
const joinRequest = await prisma.organizationJoinRequest.findFirst({
  where: { user_id: id, status: 'pending' },
  include: { organization: { select: { id: true, name: true } } },
});

// Build transaction operations
const txOps: any[] = [
  // Always approve the user
  prisma.user.update({
    where: { id },
    data: { approval_status: 'APPROVED', paid_by_owner: !!joinRequest },
  }),
];

if (joinRequest) {
  // Approve the join request
  txOps.push(
    prisma.organizationJoinRequest.update({
      where: { id: joinRequest.id },
      data: { status: 'approved', reviewed_at: new Date(), reviewed_by: req.user!.id },
    })
  );

  // Create org membership
  txOps.push(
    prisma.organizationMembership.create({
      data: {
        organization_id: joinRequest.organization_id,
        user_id: id,
        role: 'coach',
        status: 'active',
      },
    })
  );
}

// Execute atomically
try {
  await prisma.$transaction(txOps);
} catch (err: any) {
  // Handle duplicate membership (P2002)
  if (err?.code === 'P2002') {
    await prisma.user.update({
      where: { id },
      data: { approval_status: 'APPROVED' },
    });
  } else {
    throw err;
  }
}
```

Keep the existing admin activity log, email, notification, and push notification code that follows.

- [ ] **Step 4: Add org info to coach preferences (non-blocking)**

After the transaction, if a join request was found, persist org info to the coach's preferences (matching the org-owner handler pattern):

```typescript
if (joinRequest) {
  prisma.user.findUnique({ where: { id }, select: { preferences: true } })
    .then((coachRecord) => {
      const current = (coachRecord?.preferences as any) || {};
      const merged = {
        ...current,
        organization_id: joinRequest.organization_id,
        organization_name: joinRequest.organization?.name || current.organization_name,
      };
      return prisma.user.update({ where: { id }, data: { preferences: merged } });
    })
    .catch((err) => {
      console.warn('[admin] failed to persist org_id into coach preferences:', (err as any)?.message || err);
    });
}
```

- [ ] **Step 5: Test the fix**

1. Start dev server: `cd server && npm run dev`
2. Create a test user with `approval_status: 'PENDING'` and a pending join request
3. Call: `POST /admin/coaches/{id}/approve` with admin auth token
4. Verify in DB:
   - `user.approval_status` = `'APPROVED'`
   - `OrganizationMembership` record exists with `role: 'coach'`, `status: 'active'`
   - `OrganizationJoinRequest.status` = `'approved'`

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/admin.ts
git commit -m "fix: admin coach approval now creates org membership and approves join request"
```

---

## Task 5: Fix Messaging — Ungate Screens + Fix Conversation ID Mismatch

**Context:** Two problems:
1. Both `app/messages.tsx` (line 2) and `app/message-thread.tsx` (line 2) are gated behind `ComingSoon`
2. When `conversation_id` is null on a message, the client creates a fallback key `user-{id}` but the server creates real conversation IDs as `dm:{id1}__{id2}`. These formats never match, so reopening a conversation from the list shows an empty thread.

**Files:**
- Modify: `app/messages.tsx:2` (remove ComingSoon gate)
- Modify: `app/messages.tsx:187` (fix fallback conversation key format)
- Modify: `app/message-thread.tsx:2` (remove ComingSoon gate)

- [ ] **Step 1: Read both gated files**

```bash
head -5 app/messages.tsx
head -5 app/message-thread.tsx
```

Confirm both have line 2: `export { default } from '@/components/ComingSoon';`

- [ ] **Step 2: Remove ComingSoon gate from messages.tsx**

Delete line 2 (`export { default } from '@/components/ComingSoon';`) from `app/messages.tsx`.

- [ ] **Step 3: Remove ComingSoon gate from message-thread.tsx**

Delete line 2 (`export { default } from '@/components/ComingSoon';`) from `app/message-thread.tsx`.

- [ ] **Step 4: Fix the conversation ID fallback in messages.tsx**

Read `app/messages.tsx` around line 187. Find the conversation grouping logic:

```typescript
const convKey = msg.conversation_id || `user-${other.id}`;
```

Replace the fallback to match the server's `dm:id1__id2` format:

```typescript
const convKey = msg.conversation_id || (() => {
  const pair = [currentUserId, other.id].sort();
  return `dm:${pair[0]}__${pair[1]}`;
})();
```

This ensures the fallback key matches what the server would create, so when the user taps into a conversation, the `threadByConversation` call uses the correct ID format.

Verify that `currentUserId` (or equivalent — the logged-in user's ID) is available in the scope of this `useMemo`. It should be from the auth context.

- [ ] **Step 5: Verify the thread screen handles both routing modes**

Read `app/message-thread.tsx` around lines 31 and 62-63. Confirm:
1. It accepts both `conversation_id` and `with` query params
2. `threadByConversation(conversation_id)` is called when conversation_id is present
3. `threadWith(withParam)` is called when `with` is present
4. The send payload includes `conversation_id` when available

- [ ] **Step 6: Verify the navigation from conversation list passes correct params**

Read `app/messages.tsx` around lines 274-295. Confirm:
1. When tapping an existing conversation, it passes `conversation_id` (now in correct `dm:` format)
2. When starting a new conversation, it passes `with={user.id}`

- [ ] **Step 7: Test end-to-end**

1. Run app + dev server
2. Open messaging screen — should show conversation list (not ComingSoon)
3. Start a new conversation: tap user → type message → send
4. Return to conversation list → conversation should appear
5. Tap into it → should show the message (not empty)
6. Send another message → should appear in thread

- [ ] **Step 8: Commit**

```bash
git add app/messages.tsx app/message-thread.tsx
git commit -m "fix: ungate messaging screens and fix conversation ID format mismatch"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/varsityhub/VarsityHubMobile && npx tsc --noEmit 2>&1 | head -30
```

Verify no NEW errors were introduced (pre-existing errors are expected).

- [ ] **Step 2: Run server tests**

```bash
cd /Users/varsityhub/VarsityHubMobile/server && npm test
```

Verify no regressions.

- [ ] **Step 3: Run lint**

```bash
cd /Users/varsityhub/VarsityHubMobile && npm run lint
```

Fix any lint errors in modified files only.
