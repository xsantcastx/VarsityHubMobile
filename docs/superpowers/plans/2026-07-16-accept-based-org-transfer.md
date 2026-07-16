# Accept-Based Org Ownership Transfer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make organization ownership transfer require the recipient to accept before ownership moves; until they accept, the initiator stays owner (and stays blocked from account deletion by the sole-owner guard).

**Architecture:** Add a `OrganizationOwnershipTransfer` pending-row table mirroring the existing `OrganizationInvite`→accept pattern. Change `POST /organizations/:id/transfer-ownership` from an immediate move to creating a pending row + notification; add `/accept` (runs the existing atomic move), `/decline`, `/cancel`. The `assertCanSelfDeleteUser` guard is unchanged — a pending transfer leaves the initiator as owner, so deletion stays blocked until acceptance.

**Tech Stack:** Express + Prisma + PostgreSQL (server), React Native / Expo Router (client), Jest (server tests), tsx (e2e harness).

## Global Constraints

- **Build in an isolated git worktree** (parallel sessions share this checkout — see `project_paths`/CLAUDE.md Claude Worktrees). Create it via `superpowers:using-git-worktrees` before Task 1; symlink `node_modules` for hooks.
- **Thin routes** — authorization/state logic lives in `server/src/lib/*`, not the route handler (CLAUDE.md Layering).
- **Migrations auto-apply in prod** — `start.sh` runs `prisma migrate deploy` on every Railway deploy. This migration MUST be purely additive (new table, new enum, new nullable relations) so it is safe during the live fest.
- **Owner role never assignable via generic role endpoints** — ownership moves only through this transfer flow (CLAUDE.md Security Invariants).
- **All `findMany` carry a `take`** (CLAUDE.md Code Rules).
- **Errors use the envelope** — `sendError(res, status, msg, { code })`, never raw `res.status().json()` on new lines (pre-push `verify:error-envelope` gate).
- **Server tests run via `npm test`** from `server/` (needs `--experimental-vm-modules`), never bare `npx jest`.
- **Run tsx tooling under nvm Node 20** (`source ~/.nvm/nvm.sh && nvm use 20`).
- **Feature B (permanent account deletion) is OUT OF SCOPE** — deferred to post-fest.

---

### Task 1: Schema — pending-transfer table + enum + notification types

**Files:**

- Modify: `server/prisma/schema.prisma` (add enum, model, relations, 3 NotificationType values)
- Create: `server/prisma/migrations/<timestamp>_org_ownership_transfer/migration.sql` (generated)

**Interfaces:**

- Produces: Prisma model `OrganizationOwnershipTransfer` with fields `id, organization_id, from_user_id, to_user_id, status, created_at, responded_at`; enum `OwnershipTransferStatus { pending accepted declined cancelled }`; NotificationType values `ORG_OWNERSHIP_TRANSFER_OFFER`, `ORG_OWNERSHIP_TRANSFER_ACCEPTED`, `ORG_OWNERSHIP_TRANSFER_DECLINED`.

- [ ] **Step 1: Add the enum + model to schema.prisma**

Add near the other org models:

```prisma
enum OwnershipTransferStatus {
  pending
  accepted
  declined
  cancelled
}

model OrganizationOwnershipTransfer {
  id              String                  @id @default(cuid())
  organization_id String
  from_user_id    String
  to_user_id      String
  status          OwnershipTransferStatus @default(pending)
  created_at      DateTime                @default(now())
  responded_at    DateTime?

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  from_user    User         @relation("OwnershipTransferFrom", fields: [from_user_id], references: [id], onDelete: Cascade)
  to_user      User         @relation("OwnershipTransferTo", fields: [to_user_id], references: [id], onDelete: Cascade)

  @@index([organization_id, status])
  @@index([to_user_id, status])
}
```

- [ ] **Step 2: Add back-relations + enum values**

On `model Organization` add: `ownership_transfers OrganizationOwnershipTransfer[]`
On `model User` add:

```prisma
  ownership_transfers_from OrganizationOwnershipTransfer[] @relation("OwnershipTransferFrom")
  ownership_transfers_to   OrganizationOwnershipTransfer[] @relation("OwnershipTransferTo")
```

In `enum NotificationType { ... }` append: `ORG_OWNERSHIP_TRANSFER_OFFER`, `ORG_OWNERSHIP_TRANSFER_ACCEPTED`, `ORG_OWNERSHIP_TRANSFER_DECLINED`.

- [ ] **Step 3: Create the migration + regenerate client**

Run (nvm Node 20, from `server/`):

```bash
npx prisma migrate dev --name org_ownership_transfer --create-only
npx prisma generate
```

Expected: a new `migrations/<ts>_org_ownership_transfer/migration.sql` containing `CREATE TABLE "OrganizationOwnershipTransfer"`, `CREATE TYPE "OwnershipTransferStatus"`, and `ALTER TYPE "NotificationType" ADD VALUE`. Confirm it is additive only (no DROP/ALTER COLUMN on existing tables).

- [ ] **Step 4: Verify schema + generated client**

Run: `npx prisma validate` → Expected: "The schema at prisma/schema.prisma is valid 🚀"
Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -3` → Expected: 0 errors.

- [ ] **Step 5: Apply to LOCAL db + commit**

Run: `npx prisma migrate deploy` (local `varsityhub`) → Expected: migration applied.

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "feat(schema): OrganizationOwnershipTransfer pending-transfer table + notif types"
```

---

### Task 2: Transfer lib — initiate/accept/decline/cancel logic

**Files:**

- Create: `server/src/lib/organizationOwnershipTransfer.ts`
- Test: `server/src/__tests__/organization-ownership-transfer.test.ts`

**Interfaces:**

- Consumes: `prisma` from `./prisma.js`; `isOrgOwner` from `./teamAuthorization.js`.
- Produces:
  - `initiateOwnershipTransfer(orgId: string, fromUserId: string, toUserId: string): Promise<{ id: string } | { error: string; code: string }>` — validates owner/member/not-self, cancels existing pending, creates a pending row.
  - `acceptOwnershipTransfer(orgId: string, actingUserId: string): Promise<{ ok: true } | { error: string; code: string }>` — validates a pending row targets the caller who is still an active member, then runs the atomic move (league_owner_id + demote old owner→manager + promote new→owner) and marks the row accepted.
  - `respondCancelOrDecline(orgId, actingUserId, action: 'decline'|'cancel'): Promise<{ ok: true } | { error; code }>`.
  - `getPendingTransfer(orgId: string): Promise<{ id; from_user_id; to_user_id } | null>`.

- [ ] **Step 1: Write the failing test**

`server/src/__tests__/organization-ownership-transfer.test.ts` (uses the same DB-backed pattern as `team-transfer-authorization.test.ts`; guard with the repo's `describeDb` helper if present, else `describe`). Seed an org (owner + member), then:

```ts
import {
  initiateOwnershipTransfer,
  acceptOwnershipTransfer,
  getPendingTransfer,
} from '../lib/organizationOwnershipTransfer.js';
import { isOrgOwner } from '../lib/teamAuthorization.js';
import { prisma } from '../lib/prisma.js';

it('initiate creates a pending row; ownership does NOT move yet', async () => {
  const r = await initiateOwnershipTransfer(orgId, ownerId, memberId);
  expect('id' in r).toBe(true);
  expect(await isOrgOwner(memberId, orgId)).toBe(false); // still not owner
  expect(await isOrgOwner(ownerId, orgId)).toBe(true); // still owner
  expect((await getPendingTransfer(orgId))?.to_user_id).toBe(memberId);
});

it('accept moves ownership atomically and clears pending', async () => {
  await initiateOwnershipTransfer(orgId, ownerId, memberId);
  const a = await acceptOwnershipTransfer(orgId, memberId);
  expect('ok' in a).toBe(true);
  expect(await isOrgOwner(memberId, orgId)).toBe(true);
  expect(await isOrgOwner(ownerId, orgId)).toBe(false); // demoted to manager
  expect(await getPendingTransfer(orgId)).toBeNull();
});

it('non-recipient cannot accept', async () => {
  await initiateOwnershipTransfer(orgId, ownerId, memberId);
  const a = await acceptOwnershipTransfer(orgId, outsiderId);
  expect('error' in a).toBe(true);
});

it('initiate to a non-member is rejected', async () => {
  const r = await initiateOwnershipTransfer(orgId, ownerId, outsiderId);
  expect('error' in r && r.code).toBe('NOT_A_MEMBER');
});

it('a second initiate supersedes the first (one pending per org)', async () => {
  await initiateOwnershipTransfer(orgId, ownerId, memberId);
  await initiateOwnershipTransfer(orgId, ownerId, member2Id);
  const pending = await getPendingTransfer(orgId);
  expect(pending?.to_user_id).toBe(member2Id);
  const stale = await acceptOwnershipTransfer(orgId, memberId);
  expect('error' in stale).toBe(true); // superseded row no longer pending
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="organization-ownership-transfer" 2>&1 | tail -15`
Expected: FAIL — module `../lib/organizationOwnershipTransfer.js` not found.

- [ ] **Step 3: Implement `organizationOwnershipTransfer.ts`**

```ts
import { prisma } from './prisma.js';
import { isOrgOwner } from './teamAuthorization.js';

type Fail = { error: string; code: string };

export async function getPendingTransfer(orgId: string) {
  return prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending' },
    select: { id: true, from_user_id: true, to_user_id: true },
    orderBy: { created_at: 'desc' },
  });
}

export async function initiateOwnershipTransfer(
  orgId: string,
  fromUserId: string,
  toUserId: string
): Promise<{ id: string } | Fail> {
  if (!(await isOrgOwner(fromUserId, orgId)))
    return { error: 'Only the current owner can transfer ownership', code: 'NOT_OWNER' };
  if (toUserId === fromUserId)
    return { error: 'Cannot transfer ownership to yourself', code: 'SELF_TRANSFER' };
  const targetMembership = await prisma.organizationMembership.findFirst({
    where: { organization_id: orgId, user_id: toUserId, status: 'active' },
    select: { id: true },
  });
  if (!targetMembership)
    return {
      error: 'New owner must be an active member of the organization',
      code: 'NOT_A_MEMBER',
    };

  return prisma.$transaction(async tx => {
    await tx.organizationOwnershipTransfer.updateMany({
      where: { organization_id: orgId, status: 'pending' },
      data: { status: 'cancelled', responded_at: new Date() },
    });
    const row = await tx.organizationOwnershipTransfer.create({
      data: { organization_id: orgId, from_user_id: fromUserId, to_user_id: toUserId },
      select: { id: true },
    });
    return { id: row.id };
  });
}

export async function acceptOwnershipTransfer(
  orgId: string,
  actingUserId: string
): Promise<{ ok: true } | Fail> {
  const pending = await prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending', to_user_id: actingUserId },
    select: { id: true, from_user_id: true },
  });
  if (!pending)
    return {
      error: 'No pending transfer for you on this organization',
      code: 'NO_PENDING_TRANSFER',
    };

  const stillMember = await prisma.organizationMembership.findFirst({
    where: { organization_id: orgId, user_id: actingUserId, status: 'active' },
    select: { id: true },
  });
  if (!stillMember)
    return { error: 'You are no longer a member of this organization', code: 'NOT_A_MEMBER' };

  const currentOwner = await prisma.organizationMembership.findFirst({
    where: {
      organization_id: orgId,
      user_id: pending.from_user_id,
      role: 'owner',
      status: 'active',
    },
    select: { id: true },
  });

  await prisma.$transaction(async tx => {
    const claimed = await tx.organizationOwnershipTransfer.updateMany({
      where: { id: pending.id, status: 'pending' },
      data: { status: 'accepted', responded_at: new Date() },
    });
    if (claimed.count === 0) throw new Error('TRANSFER_ALREADY_PROCESSED');

    await tx.organization.update({
      where: { id: orgId },
      data: { league_owner_id: actingUserId },
      select: { id: true },
    });
    if (currentOwner) {
      await tx.organizationMembership.update({
        where: { id: currentOwner.id },
        data: { role: 'manager' },
        select: { id: true },
      });
    }
    await tx.organizationMembership.update({
      where: { id: stillMember.id },
      data: { role: 'owner' },
      select: { id: true },
    });
  });
  return { ok: true };
}

export async function respondCancelOrDecline(
  orgId: string,
  actingUserId: string,
  action: 'decline' | 'cancel'
): Promise<{ ok: true } | Fail> {
  const pending = await prisma.organizationOwnershipTransfer.findFirst({
    where: { organization_id: orgId, status: 'pending' },
    select: { id: true, from_user_id: true, to_user_id: true },
    orderBy: { created_at: 'desc' },
  });
  if (!pending) return { error: 'No pending transfer', code: 'NO_PENDING_TRANSFER' };
  const allowed =
    action === 'cancel'
      ? pending.from_user_id === actingUserId
      : pending.to_user_id === actingUserId;
  if (!allowed) return { error: 'Not allowed to respond to this transfer', code: 'FORBIDDEN' };
  await prisma.organizationOwnershipTransfer.update({
    where: { id: pending.id },
    data: { status: action === 'cancel' ? 'cancelled' : 'declined', responded_at: new Date() },
  });
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npm test -- --testPathPattern="organization-ownership-transfer" 2>&1 | tail -12`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/organizationOwnershipTransfer.ts server/src/__tests__/organization-ownership-transfer.test.ts
git commit -m "feat(org): accept-based ownership-transfer lib (initiate/accept/decline/cancel)"
```

---

### Task 3: Endpoints — change transfer-ownership to pending + add accept/decline/cancel

**Files:**

- Modify: `server/src/routes/organizations.ts` (replace the body of `POST /:id/transfer-ownership` at ~line 2451; add 3 routes after it)
- Test: `server/src/__tests__/organization-ownership-transfer-endpoints.test.ts` (supertest against the router)

**Interfaces:**

- Consumes: `initiateOwnershipTransfer`, `acceptOwnershipTransfer`, `respondCancelOrDecline`, `getPendingTransfer` from `../lib/organizationOwnershipTransfer.js`; existing `logAdminActivityFromReq`, `sendError`, `prisma`.
- Produces: `POST /:id/transfer-ownership` (pending), `POST /:id/transfer-ownership/accept`, `/decline`, `/cancel`.

- [ ] **Step 1: Write the failing endpoint test**

Assert: initiate returns `{ pending: true }` and does NOT change `league_owner_id`; a notification row of type `ORG_OWNERSHIP_TRANSFER_OFFER` is created for the recipient; accept by the recipient flips `league_owner_id`; accept by a non-recipient returns 403/400. Mirror the supertest setup in `server/src/__tests__/team-transfer-authorization.test.ts`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npm test -- --testPathPattern="organization-ownership-transfer-endpoints" 2>&1 | tail -12`
Expected: FAIL (routes still do immediate transfer / accept route 404).

- [ ] **Step 3: Replace the transfer-ownership handler body**

Replace the logic inside `POST /:id/transfer-ownership` (the block from the `transferSchema` parse through `res.json`) with:

```ts
const transferSchema = z.object({ new_owner_id: z.string().min(1) });
const parsed = transferSchema.safeParse(req.body);
if (!parsed.success) return sendError(res, 400, 'Invalid payload', { code: 'INVALID_PAYLOAD' });

const result = await initiateOwnershipTransfer(
  req.params.id,
  req.user.id,
  parsed.data.new_owner_id
);
if ('error' in result) return sendError(res, 400, result.error, { code: result.code });

// Notify the recipient (best-effort — never fail the request on notif error).
try {
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    select: { name: true },
  });
  await prisma.notification.create({
    data: {
      user_id: parsed.data.new_owner_id,
      actor_id: req.user.id,
      type: 'ORG_OWNERSHIP_TRANSFER_OFFER',
      meta: { organization_id: req.params.id, organization_name: org?.name ?? 'an organization' },
    },
  });
} catch (e) {
  console.warn('[org] transfer-offer notification failed:', (e as Error)?.message);
}

await logAdminActivityFromReq(
  req,
  'REQUEST_ORG_OWNERSHIP_TRANSFER',
  'organization',
  req.params.id,
  `Requested ownership transfer to ${parsed.data.new_owner_id}`,
  { new_owner_id: parsed.data.new_owner_id }
);

return res.json({
  pending: true,
  message: 'Transfer offer sent — waiting for the recipient to accept.',
});
```

- [ ] **Step 4: Add the accept/decline/cancel routes**

Immediately after that route, add three handlers (all `requireAuth, requireVerified, requireOnboarded, asyncHandler`). Accept:

```ts
organizationsRouter.post(
  '/:id/transfer-ownership/accept',
  requireAuth as any,
  requireVerified as any,
  requireOnboarded as any,
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const result = await acceptOwnershipTransfer(req.params.id, req.user.id);
    if ('error' in result) return sendError(res, 400, result.error, { code: result.code });
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.params.id },
        select: { name: true, league_owner_id: true },
      });
      // Notify the former owner that it was accepted.
      const prevOwner = await prisma.organizationOwnershipTransfer.findFirst({
        where: { organization_id: req.params.id, status: 'accepted', to_user_id: req.user.id },
        orderBy: { responded_at: 'desc' },
        select: { from_user_id: true },
      });
      if (prevOwner)
        await prisma.notification.create({
          data: {
            user_id: prevOwner.from_user_id,
            actor_id: req.user.id,
            type: 'ORG_OWNERSHIP_TRANSFER_ACCEPTED',
            meta: {
              organization_id: req.params.id,
              organization_name: org?.name ?? 'an organization',
            },
          },
        });
    } catch (e) {
      console.warn('[org] transfer-accepted notification failed:', (e as Error)?.message);
    }
    await logAdminActivityFromReq(
      req,
      'TRANSFER_ORG_OWNERSHIP',
      'organization',
      req.params.id,
      `Accepted ownership transfer`,
      {}
    );
    return res.json({ message: 'Ownership transferred successfully' });
  })
);
```

Decline and cancel (analogous, calling `respondCancelOrDecline(req.params.id, req.user.id, 'decline'|'cancel')`; on decline, notify `from_user_id` with type `ORG_OWNERSHIP_TRANSFER_DECLINED`).

- [ ] **Step 5: Import the lib at the top of organizations.ts**

Add: `import { initiateOwnershipTransfer, acceptOwnershipTransfer, respondCancelOrDecline, getPendingTransfer } from '../lib/organizationOwnershipTransfer.js';`

- [ ] **Step 6: Run tests + typecheck + envelope gate**

Run: `cd server && npm test -- --testPathPattern="organization-ownership-transfer-endpoints" 2>&1 | tail -12` → PASS.
Run: `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -3` → 0 errors.
Run: `npm run verify:error-envelope` → passes.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/organizations.ts server/src/__tests__/organization-ownership-transfer-endpoints.test.ts
git commit -m "feat(org): transfer-ownership becomes accept-based (pending + accept/decline/cancel)"
```

---

### Task 4: Surface the pending transfer on org detail GET

**Files:**

- Modify: `server/src/lib/serializeOrganization.ts` (add optional `pending_ownership_transfer`)
- Modify: `server/src/routes/organizations.ts` (`GET /:id` — attach it)
- Test: extend the endpoints test to assert the GET payload shows pending state for both sides.

**Interfaces:**

- Produces: org GET response gains `pending_ownership_transfer: { to_user_id: string; from_user_id: string } | null`.

- [ ] **Step 1: Failing test** — GET `/:id` after an initiate returns `pending_ownership_transfer.to_user_id === recipientId`.
- [ ] **Step 2: Run → FAIL** (`cd server && npm test -- --testPathPattern="organization-ownership-transfer-endpoints"`).
- [ ] **Step 3: In `GET /:id`, after loading the org, call `getPendingTransfer(orgId)` and include it in the JSON** (spread onto the `serializeOrganization(...)` result: `{ ...serialized, pending_ownership_transfer: pending }`).
- [ ] **Step 4: Run → PASS**; `npx tsc --noEmit --project server/tsconfig.json` → 0 errors.
- [ ] **Step 5: Commit** — `git commit -m "feat(org): expose pending_ownership_transfer on org detail"`.

---

### Task 5: Real-DB e2e harness (the verification pattern used this session)

**Files:**

- Create: `server/scripts/e2e/org-ownership-transfer-flow.ts` (mirrors `server/scripts/e2e/org-coach-authz-matrix.ts`: seed→assert→revert)

- [ ] **Step 1: Write the harness** driving the real lib: initiate → assert recipient NOT owner + initiator still `isOrgOwner` → assert `assertCanSelfDeleteUser(initiator)` still throws `SOLE_ORG_OWNER` → accept → assert ownership moved + initiator now passes `assertCanSelfDeleteUser` (if not sole-owner of anything else) → plus decline, cancel, supersede, and "recipient left before accepting" (delete their membership then accept → expect `NOT_A_MEMBER`). Delete all seeded rows at the end.
- [ ] **Step 2: Run it** — `cd server && npx tsx scripts/e2e/org-ownership-transfer-flow.ts 2>/dev/null | grep -E "PASS|FAIL|passed"` → all green.
- [ ] **Step 3: Confirm zero residue** (query `@test.local` users created by this run are gone).
- [ ] **Step 4: Commit** — `git commit -m "test(e2e): live-DB drive for accept-based ownership transfer"`.

---

### Task 6: Client — API methods, UI, and notification presentation

**Files:**

- Modify: `api/entities.ts` (add `Organizations.transferOwnership` change + `acceptTransfer/declineTransfer/cancelTransfer`)
- Modify: `app/(tabs)/edit-organization.tsx` (owner: show "pending — waiting for <name>" + Cancel after initiating; the existing `handleTransferOwnership` at ~line 131 now shows a "sent, awaiting acceptance" success instead of "done")
- Modify: the org detail screen the recipient sees (surface accept/decline when `pending_ownership_transfer.to_user_id === me`)
- Modify: `utils/notificationPresentation.ts` (add cases for the 3 new NotificationType values, mirroring the `JOIN_REQUEST_APPROVED` case at lines 102/155/235)

**Interfaces:**

- Consumes: server routes from Tasks 3–4.

- [ ] **Step 1: Add api methods** in `api/entities.ts` under the org section (mirror existing `httpPost` helpers):

```ts
transferOwnership: (id: string, new_owner_id: string) =>
  httpPost(`/organizations/${encodeURIComponent(id)}/transfer-ownership`, { new_owner_id }),
acceptOwnershipTransfer: (id: string) =>
  httpPost(`/organizations/${encodeURIComponent(id)}/transfer-ownership/accept`, {}),
declineOwnershipTransfer: (id: string) =>
  httpPost(`/organizations/${encodeURIComponent(id)}/transfer-ownership/decline`, {}),
cancelOwnershipTransfer: (id: string) =>
  httpPost(`/organizations/${encodeURIComponent(id)}/transfer-ownership/cancel`, {}),
```

- [ ] **Step 2: Update `edit-organization.tsx`** — in `handleTransferOwnership`, change the confirm copy from "This cannot be undone. You will become a manager." to "We'll send <name> a request. Ownership moves only after they accept." On success show "Request sent — waiting for <name> to accept." Add a "Cancel pending transfer" action shown when `pending_ownership_transfer` is set.
- [ ] **Step 3: Add recipient accept/decline UI** on the org detail screen when `pending_ownership_transfer?.to_user_id === currentUser.id`: a banner "You've been offered ownership of <org>" with Accept / Decline calling the new api methods, then refetch.
- [ ] **Step 4: Notification presentation** — add cases in `utils/notificationPresentation.ts` for `ORG_OWNERSHIP_TRANSFER_OFFER` ("offered you ownership of {org}" → routes to org detail), `_ACCEPTED` ("accepted ownership of {org}"), `_DECLINED` ("declined your ownership offer for {org}").
- [ ] **Step 5: Verify on web preview** — run the expo-web dev server, sign in as the recipient (guest browsing won't show authed actions), and confirm the offer banner + accept flow renders and refetches (use the verification workflow). Typecheck: `npx tsc --noEmit 2>&1 | tail -3` → 0 errors.
- [ ] **Step 6: Commit** — `git commit -m "feat(org): client UI for accept-based ownership transfer + notifications"`.

---

## Rollout (after all tasks green, on the worktree branch)

1. Open a PR from the worktree branch (do NOT push straight to main during the live fest for a schema change — let the additive migration land via a reviewed merge, then Railway auto-applies it).
2. After merge: client reaches users via `eas update` to BOTH runtimes (1.0.5 auto + 1.0.4 override).
3. Feature B (permanent account deletion) remains deferred to post-fest as a separate plan.

## Notes for the implementer

- The **guard is deliberately untouched** — do not modify `assertCanSelfDeleteUser`. Its correctness under a pending transfer is exactly what Task 5 verifies.
- One pending transfer per org is enforced in `initiateOwnershipTransfer`'s transaction (it cancels prior pending rows), not by a DB unique constraint (Postgres partial-unique is avoidable here).
- `isOrgOwner` already honors the legacy `league_owner_id` pointer, so the accept move updates both the pointer and the membership roles together (mirrors the pre-existing atomic transfer).
