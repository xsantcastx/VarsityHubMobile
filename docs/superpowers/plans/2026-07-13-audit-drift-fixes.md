# Audit Drift Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the verified duplication-drift bugs from the 2026-07-13 audit — server security/business-rule drift (roster-limit bypass, admin verification bypass, missing org-admin fallback, silent scheduler job loss), the broken rate-limit checker, and client validation/display drift — by consolidating each duplicated rule onto its existing canonical helper.

**Architecture:** Every bug here has the same shape: a rule implemented twice, where one copy got a fix the other didn't. The fix strategy is always the same — make the stale copy call the canonical implementation (`lib/teamAuthorization.ts`, `lib/teamEntitlements.ts`, `middleware/requireAdmin.ts`, `utils/formUtils.ts`, `constants/plans.ts`, `utils/userDisplay.ts`) rather than patching the copy in place. Each task adds a source-contract regression test in the repo's established style (regex assertions over route source, as in `server/src/__tests__/team-invite-race-guards.test.ts`) so the drift can't silently reopen.

**Tech Stack:** Express + Prisma + Zod (server), React Native/Expo (client), Jest (server tests need `npm test` wrapper for `--experimental-vm-modules`; NEVER bare `npx jest` on server), node-cron (already a server dependency).

## Global Constraints

- Node 20 required for all tooling: prefix Bash commands with `source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1` (nvm state does not persist across shell calls).
- Server tests: `cd server && npm test -- --runTestsByPath <paths>` (the wrapper adds `--experimental-vm-modules`).
- Client tests: `npx jest <path>` from repo root is fine.
- Railway auto-deploys `main` on push. ALL work happens on branch `fix/audit-drift-2026-07`. Never push to main as part of this plan — merging/pushing is the user's decision.
- Never run `eas build` / `eas submit`.
- After every server change: `npx tsc --noEmit --project server/tsconfig.json` must be clean.
- After every client change: `npx tsc --noEmit` must be clean.
- Client-side fixes are NOT live for users until the user runs `eas update --branch production` — note this in the final summary, do not run it.
- All error responses use the established envelope patterns already present in the touched handlers (copy the neighboring style; no raw `res.status().json()` in new code beyond what matches the file's existing pattern).
- Commit messages end with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## Out of Scope (decided during audit; do not implement)

- Snyk monthly-quota / billing (user action in Snyk dashboard).
- Snyk→Sentry pipeline construction (docs already corrected to say it doesn't exist).
- Live-browser verification of Sentry on www.varsityhub.app (manual user check).
- Refund-logic-vs-no-refunds-policy contradiction (business decision, not a code bug).
- `team-page.tsx` stub replies/upvotes tabs (feature work, needs product decision).
- Prettier formatting sweeps beyond touched lines.
- Lower-priority maintenance duplication (no confirmed breakage yet — track as follow-ups, don't fix here): renaming organization.tsx's local `formatEventDate` shadow; consolidating avatar-initials JSX in PostCard/MasonryPostCard; replacing the 10 inline staff-role arrays with `TEAM_STAFF_ROLES`; folding league-approval HTML pages into `lib/reviewPage.ts`; extracting games.ts's read-path visibility checks into shared helpers.

---

### Task 0: Branch + commit the already-verified session fixes

The working tree already contains verified fixes from earlier in this audit session (dependency CVE overrides in both `package.json`/`package-lock.json` pairs, `.snyk` image-size ignores, two doc corrections). Get them committed on a branch before starting new work.

**Files:**

- Modify: none (commit existing changes)

**Interfaces:**

- Produces: branch `fix/audit-drift-2026-07` with a clean baseline commit; all later tasks commit on this branch.

- [ ] **Step 1: Verify what is pending and create the branch**

Run:

```bash
cd ~/Code/VarsityHubMobile && git status --short
git checkout -b fix/audit-drift-2026-07
```

Expected pending files: `package.json`, `package-lock.json`, `server/package.json`, `server/package-lock.json`, `.snyk`, `.docs/SENTRY_SNYK_INTEGRATION.md`, `PRODUCTION_AUDIT_REPORT.md`, plus this plan file under `docs/superpowers/plans/`. If anything ELSE is modified, stop and surface it to the user before committing.

- [ ] **Step 2: Confirm the pending changes still pass their verification**

Run:

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit && npx tsc --noEmit --project server/tsconfig.json
```

Expected: no output from either (clean).

- [ ] **Step 3: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add package.json package-lock.json server/package.json server/package-lock.json .snyk .docs/SENTRY_SNYK_INTEGRATION.md PRODUCTION_AUDIT_REPORT.md docs/superpowers/plans/2026-07-13-audit-drift-fixes.md
git commit -m "chore(security): dependency CVE overrides, image-size .snyk ignore, audit doc corrections

- npm overrides: brace-expansion 2.1.2 / shell-quote 1.9+ / fast-uri 3.1.3 (client), brace-expansion 5.0.7 / js-yaml 4.3.0 (server)
- .snyk: dated ignores for SNYK-JS-IMAGESIZE-17295814/17295816 (no 1.x fix exists; transitive via metro)
- Correct false claims in SENTRY_SNYK_INTEGRATION.md (pipeline never built) and PRODUCTION_AUDIT_REPORT.md (sourcemaps only disabled for development profile)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1: Port roster-limit + invite-role-conflict guards into `POST /teams/:id/invite`

`server/src/routes/team-invites.ts` (`POST /team-invites`) enforces a roster cap and a pending-invite role-conflict guard inside its transaction. The older sibling `POST /teams/:id/invite` in `teams.ts` has neither — a coach can bypass the plan's roster cap and silently overwrite a pending invite's role by using this endpoint.

**Files:**

- Modify: `server/src/routes/teams.ts` (import block ~line 29-36; invite transaction ~lines 2425-2490; catch block ~lines 2480-2500)
- Test: `server/src/__tests__/team-invite-endpoint-parity.test.ts` (create)

**Interfaces:**

- Consumes: `buildRosterLimitError`, `getTeamEntitlementState` from `../lib/teamEntitlements.js` (already partially imported in teams.ts — `buildRosterLimitError` must be ADDED to the existing import).
- Produces: `POST /teams/:id/invite` returns `403 {error:'ROSTER_LIMIT_REACHED',...}` (via `buildRosterLimitError`) and `409 {error:'INVITE_ROLE_CONFLICT',...}` matching team-invites.ts behavior. Task 2's test file is the same file created here.

- [ ] **Step 1: Write the failing contract test**

Create `server/src/__tests__/team-invite-endpoint-parity.test.ts`:

```typescript
/**
 * Regression: POST /teams/:id/invite and POST /team-invites are two live
 * implementations of the same operation. 2026-07-13 audit found they had
 * drifted (roster limit + role-conflict guard in one; already-member guard
 * in the other). These source contracts pin the guards in BOTH files.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const teamsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'teams.ts'), 'utf8');
const teamInvitesSrc = readFileSync(
  join(process.cwd(), 'src', 'routes', 'team-invites.ts'),
  'utf8'
);

// Slice teams.ts to just the POST /:id/invite handler so assertions can't
// accidentally match a different route in this large file.
const inviteHandlerStart = teamsSrc.indexOf("'/:id/invite'");
const inviteHandler = teamsSrc.slice(inviteHandlerStart, inviteHandlerStart + 12000);

describe('POST /teams/:id/invite parity with POST /team-invites', () => {
  it('enforces the roster limit inside the invite transaction', () => {
    expect(inviteHandlerStart).toBeGreaterThan(-1);
    expect(inviteHandler).toMatch(/entitlement\.maxRoster !== null/);
    expect(inviteHandler).toMatch(/ROSTER_LIMIT_REACHED/);
    expect(inviteHandler).toMatch(/buildRosterLimitError\(/);
  });

  it('rejects a role change on an existing pending invite instead of silently overwriting', () => {
    expect(inviteHandler).toMatch(/INVITE_ROLE_CONFLICT/);
    // The 409 branch must exist in the catch block
    expect(inviteHandler).toMatch(/status\(409\)[\s\S]{0,200}INVITE_ROLE_CONFLICT/);
  });
});

describe('POST /team-invites parity with POST /teams/:id/invite', () => {
  it('rejects inviting someone who is already an active member (ALREADY_MEMBER)', () => {
    expect(teamInvitesSrc).toMatch(/ALREADY_MEMBER/);
    expect(teamInvitesSrc).toMatch(/teamMembership\.findFirst\(/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/team-invite-endpoint-parity.test.ts
```

Expected: FAIL — teams.ts assertions fail (`ROSTER_LIMIT_REACHED` not found), team-invites.ts `ALREADY_MEMBER` assertion fails.

- [ ] **Step 3: Add `buildRosterLimitError` to teams.ts imports**

In `server/src/routes/teams.ts`, the existing import block (~line 29):

```typescript
import {
  buildRosterLimitError,
  buildTeamPlanLockedError,
  getTeamEntitlementState,
  getTeamEntitlementStates,
  isAuthorizedTeamRole,
  isManagementRole,
  TEAM_AUTHORIZED_ROLES,
} from '../lib/teamEntitlements.js';
```

(only `buildRosterLimitError,` is new — keep the rest untouched.)

- [ ] **Step 4: Add the two guards inside the invite transaction**

In `server/src/routes/teams.ts`, inside `prisma.$transaction(async tx => {` of the `POST /:id/invite` handler, the current code reads:

```typescript
const existingInvite = await tx.teamInvite.findFirst({
  where: {
    team_id: id,
    email: { equals: inviteEmail, mode: 'insensitive' },
  } as any,
  select: { id: true },
});
```

Change the `select` to also fetch `status` and `role`, then add the role-conflict and roster guards directly after it (mirroring team-invites.ts):

```typescript
const existingInvite = await tx.teamInvite.findFirst({
  where: {
    team_id: id,
    email: { equals: inviteEmail, mode: 'insensitive' },
  } as any,
  select: { id: true, status: true, role: true },
});

// Conflict: an invite for this email is ALREADY pending with a
// different role. Same rule as POST /team-invites — silently
// overwriting the role let a second invite downgrade/change what the
// invitee was already emailed about. Same role = idempotent re-invite.
if (
  existingInvite &&
  existingInvite.status === 'pending' &&
  String(existingInvite.role) !== assignedRole
) {
  throw new Error(
    `INVITE_ROLE_CONFLICT:An invite for this email is already pending with role "${existingInvite.role}". Cancel it first or re-invite with the same role.`
  );
}
```

Then, directly after the existing `if (entitlement.teamLocked) { throw new Error('TEAM_PLAN_LOCKED'); }` block, add the roster guard (mirroring team-invites.ts):

```typescript
// Enforce roster size limit — counts active members + all pending
// invites so the cap cannot be bypassed by sending invites instead of
// direct adds. Same rule as POST /team-invites; this endpoint was
// missing it (2026-07-13 audit).
if (entitlement.maxRoster !== null) {
  const activeMemberCount = await tx.teamMembership.count({
    where: { team_id: id, status: 'active' },
  });
  const pendingInviteCount = await tx.teamInvite.count({
    where: {
      team_id: id,
      status: 'pending',
      ...(existingInvite ? { id: { not: existingInvite.id } } : {}),
    },
  });
  if (activeMemberCount + pendingInviteCount + 1 > entitlement.maxRoster) {
    throw new Error(`ROSTER_LIMIT_REACHED:${entitlement.maxRoster}`);
  }
}
```

- [ ] **Step 5: Add the two error branches to the catch block**

In the same handler's `catch (e: any)` block, after the existing `TEAM_PLAN_LOCKED` branch, add:

```typescript
if (e?.message?.startsWith('INVITE_ROLE_CONFLICT:')) {
  const [, message] = e.message.split(':');
  return res.status(409).json({
    error: 'INVITE_ROLE_CONFLICT',
    message: message || 'An invite for this email is already pending with a different role.',
  });
}
if (e?.message?.startsWith('ROSTER_LIMIT_REACHED:')) {
  const limit = parseInt(e.message.split(':')[1], 10);
  return res.status(403).json(buildRosterLimitError(limit));
}
```

- [ ] **Step 6: Typecheck + run the test (teams.ts half should now pass)**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/team-invite-endpoint-parity.test.ts
```

Expected: tsc clean. Test: the two `POST /teams/:id/invite` specs PASS; the `ALREADY_MEMBER` spec still FAILS (that's Task 2).

- [ ] **Step 7: Run the neighboring invite suites to catch regressions**

```bash
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/team-invite-race-guards.test.ts src/__tests__/invite-username-resolution.test.ts src/__tests__/invite-identifier-routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/routes/teams.ts server/src/__tests__/team-invite-endpoint-parity.test.ts
git commit -m "fix(teams): enforce roster limit + invite role-conflict guard on POST /teams/:id/invite

POST /team-invites gained both guards; this older sibling endpoint never did,
so the roster cap was bypassable and a pending invite's role could be silently
overwritten. Ports the exact transaction guards + error envelopes and pins
both files with a parity contract test.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Port the ALREADY_MEMBER guard into `POST /team-invites`

The drift ran both directions: `teams.ts` rejects inviting an existing active member (`409 ALREADY_MEMBER`); `team-invites.ts` doesn't, so an invite row can be created for someone already on the team.

**Files:**

- Modify: `server/src/routes/team-invites.ts` (~line 108, after email resolution, before the transaction)
- Test: `server/src/__tests__/team-invite-endpoint-parity.test.ts` (from Task 1 — its third spec)

**Interfaces:**

- Consumes: `sendError` from `../lib/http/sendError.js` (already imported in team-invites.ts).
- Produces: `POST /team-invites` returns `409` with `code: 'ALREADY_MEMBER'` matching teams.ts behavior.

- [ ] **Step 1: Confirm the failing spec**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/team-invite-endpoint-parity.test.ts
```

Expected: only the `ALREADY_MEMBER` spec fails.

- [ ] **Step 2: Add the guard**

In `server/src/routes/team-invites.ts`, directly after `emailLower` is resolved (after the `else { emailLower = email!.toLowerCase(); }` block) and before `let invite;`:

```typescript
// Reject inviting someone who is already an active member of this team.
// Same rule as POST /teams/:id/invite; this endpoint was missing it
// (2026-07-13 audit).
const existingUserForInvite = await prisma.user.findFirst({
  where: { email: { equals: emailLower, mode: 'insensitive' } } as any,
  select: { id: true },
});
if (existingUserForInvite) {
  const existingMembership = await prisma.teamMembership.findFirst({
    where: {
      team_id: teamId,
      user_id: existingUserForInvite.id,
      status: 'active',
    },
    select: { id: true },
  });
  if (existingMembership) {
    return sendError(res, 409, 'That user is already on this team.', {
      code: 'ALREADY_MEMBER',
    });
  }
}
```

- [ ] **Step 3: Typecheck + full parity test passes**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/team-invite-endpoint-parity.test.ts
```

Expected: tsc clean, all 3 specs PASS.

- [ ] **Step 4: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/routes/team-invites.ts
git commit -m "fix(team-invites): reject inviting an already-active member (ALREADY_MEMBER parity)

POST /teams/:id/invite has this guard; POST /team-invites was missing it.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Close the unverified-admin-email gap (`isVerifiedAdminUser` helper)

`getIsAdmin()` requires `email_verified === true`; the bare `isEmailAdmin()` doesn't. Four read paths use the bare check with a fresh user lookup, so an admin-allow-listed but unverified email gets elevated visibility on `GET /games/:id`, `GET /games/:id/summary`, the pending-games list, and `GET /organizations/:id/members` — while being correctly denied on `/games/:id/media`.

**Files:**

- Modify: `server/src/middleware/requireAdmin.ts` (add helper)
- Modify: `server/src/routes/games.ts` (~lines 870-875 in `canViewGameRecord`; ~lines 966-971 and ~1035-1040 in the `GET /` handler)
- Modify: `server/src/routes/organizations.ts` (~lines 852-860, `GET /:id/members`)
- Test: `server/src/__tests__/admin-check-verification-parity.test.ts` (create)

**Interfaces:**

- Consumes: `prisma`, `isAdminEmail` (both already imported in requireAdmin.ts).
- Produces: `export async function isVerifiedAdminUser(userId?: string | null): Promise<boolean>` in `server/src/middleware/requireAdmin.ts` — takes a user id (not a req), returns true only for verified admin-email accounts. Later tasks and future routes should use this wherever only a userId is in hand.

- [ ] **Step 1: Write the failing contract test**

Create `server/src/__tests__/admin-check-verification-parity.test.ts`:

```typescript
/**
 * Regression: admin privilege must always require a VERIFIED email.
 * getIsAdmin() enforces email_verified; the bare isEmailAdmin() does not.
 * 2026-07-13 audit found four read paths using the bare check on fresh user
 * lookups. These contracts pin every games.ts/organizations.ts admin check
 * to the verified helpers.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const requireAdminSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireAdmin.ts'),
  'utf8'
);
const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');
const orgsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'organizations.ts'), 'utf8');

describe('verified-admin helper', () => {
  it('exists and checks email_verified', () => {
    expect(requireAdminSrc).toMatch(
      /export async function isVerifiedAdminUser\([\s\S]*?email_verified[\s\S]*?isAdminEmail/
    );
  });
});

describe('games.ts admin checks require verification', () => {
  it('no longer calls the bare isEmailAdmin()', () => {
    expect(gamesSrc).not.toMatch(/\bisEmailAdmin\(/);
  });
  it('canViewGameRecord uses isVerifiedAdminUser', () => {
    const start = gamesSrc.indexOf('async function canViewGameRecord');
    const fn = gamesSrc.slice(start, start + 3000);
    expect(fn).toMatch(/isVerifiedAdminUser\(/);
  });
});

describe('organizations.ts members endpoint requires verification', () => {
  it('the non-member platform-admin fallback uses isVerifiedAdminUser', () => {
    expect(orgsSrc).toMatch(/isVerifiedAdminUser\(/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/admin-check-verification-parity.test.ts
```

Expected: FAIL on all specs.

- [ ] **Step 3: Add the helper to requireAdmin.ts**

Append to `server/src/middleware/requireAdmin.ts`:

```typescript
/**
 * userId-based variant of getIsAdmin() for call sites that don't hold a req.
 * Admin privilege ALWAYS requires a verified email — the bare isEmailAdmin()
 * string check must never gate access on its own (2026-07-13 audit).
 */
export async function isVerifiedAdminUser(userId?: string | null): Promise<boolean> {
  if (!userId) return false;
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, email_verified: true },
  });
  return !!me?.email_verified && isAdminEmail(me?.email);
}
```

- [ ] **Step 4: Rewire games.ts (three sites)**

Site A — `canViewGameRecord` (~line 870). Replace:

```typescript
const viewer = await prisma.user.findUnique({
  where: { id: viewerId },
  select: { email: true },
});
if (isEmailAdmin(viewer?.email)) return true;
```

with:

```typescript
if (await isVerifiedAdminUser(viewerId)) return true;
```

Site B — `GET /` gate (~line 966). Replace:

```typescript
const requester = await prisma.user.findUnique({
  where: { id: authedReq.user.id },
  select: { email: true },
});
const isAdmin = isEmailAdmin(requester?.email);
```

with:

```typescript
const isAdmin = await isVerifiedAdminUser(authedReq.user.id);
```

Site C — `GET /` where-scope block (~line 1035). Replace the second identical `requester` lookup + `const isAdmin = isEmailAdmin(requester?.email);` with:

```typescript
const isAdmin = await isVerifiedAdminUser(authedReq.user.id);
```

Then update the games.ts import: remove `isEmailAdmin` from the `'../middleware/requireAdmin.js'` import and add `isVerifiedAdminUser` (keep `getIsAdmin` — `canViewGameMedia` still uses it). Find the import with `grep -n "requireAdmin.js" server/src/routes/games.ts`.

- [ ] **Step 5: Rewire organizations.ts (one site — `GET /:id/members` only)**

At ~line 852, replace:

```typescript
if (!callerMembership) {
  const caller = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { email: true },
  });
  if (!isEmailAdmin(caller?.email)) {
    return res.status(403).json({ error: 'You must be a member of this organization' });
  }
}
```

with:

```typescript
if (!callerMembership) {
  if (!(await isVerifiedAdminUser(req.user!.id))) {
    return res.status(403).json({ error: 'You must be a member of this organization' });
  }
}
```

Add `isVerifiedAdminUser` to organizations.ts's import from `'../middleware/requireAdmin.js'`. IMPORTANT: organizations.ts has OTHER admin checks (~lines 432-443, 2688, 3022) that already gate on `email_verified` correctly — do not touch them; only the members endpoint site changes.

- [ ] **Step 6: Typecheck + tests**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/admin-check-verification-parity.test.ts src/__tests__/games-approval-race.test.ts src/__tests__/organization-data-access-invariants.test.ts
```

Expected: tsc clean, all PASS. If `games.ts` still matches `isEmailAdmin(` per the test, grep for stragglers: `grep -n "isEmailAdmin" server/src/routes/games.ts` and rewire them the same way.

- [ ] **Step 7: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/middleware/requireAdmin.ts server/src/routes/games.ts server/src/routes/organizations.ts server/src/__tests__/admin-check-verification-parity.test.ts
git commit -m "fix(auth): admin visibility always requires verified email (isVerifiedAdminUser)

games.ts (game record/summary/pending-list) and organizations.ts (members)
gated admin access on the bare admin-email string check, skipping the
email_verified requirement that getIsAdmin() and /games/:id/media enforce.
Adds a userId-based verified helper and pins all sites with a contract test.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Give `PATCH /events/:id` the org-admin fallback its cancel sibling already has

The cancel handler's own comment documents the bug ("previously... skipped the org-admin fallback — league owners couldn't cancel events in their own league") and fixes it via `canManageAnyTeam`. The edit handler, same file, still has the unfixed inline check — org owners/managers without a direct team-staff row get 403 editing events for their own league's teams.

**Files:**

- Modify: `server/src/routes/events.ts` (~lines 1506-1530, PATCH `/:id` permission block)
- Test: `server/src/__tests__/event-edit-permissions.test.ts` (create)

**Interfaces:**

- Consumes: `canManageAnyTeam` from `'../lib/teamAuthorization.js'` (ALREADY imported in events.ts line 29 — no import change needed).
- Produces: edit permission = creator OR `canManageAnyTeam(userId, linkedTeamIds)` OR verified admin — byte-parallel to the cancel handler.

- [ ] **Step 1: Write the failing contract test**

Create `server/src/__tests__/event-edit-permissions.test.ts`:

```typescript
/**
 * Regression: PATCH /events/:id must use the same permission rule as
 * PATCH /events/:id/cancel — creator OR canManageAnyTeam (team staff
 * INCLUDING the org-admin fallback) OR admin. 2026-07-13 audit found the
 * edit handler still used the pre-fix inline teamMembership check that the
 * cancel handler's comment documents replacing.
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const eventsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf8');

// Slice to the PATCH /:id handler (starts after its route registration,
// ends where the cancel route begins).
const editStart = eventsSrc.indexOf("'/:id'", eventsSrc.indexOf('eventsRouter.patch'));
const cancelStart = eventsSrc.indexOf("'/:id/cancel'");
const editHandler = eventsSrc.slice(editStart, cancelStart);

describe('PATCH /events/:id permissions', () => {
  it('uses canManageAnyTeam (org-admin fallback included), not an inline membership query', () => {
    expect(editStart).toBeGreaterThan(-1);
    expect(cancelStart).toBeGreaterThan(editStart);
    expect(editHandler).toMatch(/canManageAnyTeam\(/);
  });
  it('no longer hand-rolls the staff-role membership check', () => {
    expect(editHandler).not.toMatch(
      /role:\s*\{\s*in:\s*\['owner',\s*'manager',\s*'coach',\s*'assistant_coach'\]/
    );
  });
});
```

Note: if the slice boundaries miss (e.g. `eventsRouter.patch` ordering differs), adjust the slicing to anchor on unique strings from the edit handler such as `'Cannot edit cancelled event'` — the assertions themselves stay the same.

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/event-edit-permissions.test.ts
```

Expected: FAIL (canManageAnyTeam absent from edit handler; inline role array present).

- [ ] **Step 3: Replace the inline check**

In `server/src/routes/events.ts` PATCH `/:id` handler, replace:

```typescript
const isCreator = event.creator_id === userId;
let isTeamOwner = false;
if (event.game?.home_team_id || event.game?.away_team_id) {
  const teamIds = [event.game.home_team_id, event.game.away_team_id].filter(Boolean) as string[];
  const ownership = await prisma.teamMembership.findFirst({
    where: {
      team_id: { in: teamIds },
      user_id: userId,
      role: { in: ['owner', 'manager', 'coach', 'assistant_coach'] },
      status: 'active',
    },
  });
  isTeamOwner = !!ownership;
}
const isAdmin = await getIsAdmin(req as any);

if (!isCreator && !isTeamOwner && !isAdmin) {
  return res.status(403).json({
    error: 'Permission denied',
    message: 'Only the event creator, team owner, or admin can edit this event.',
  });
}
```

with (mirrors the cancel handler exactly, including the event's own team_id):

```typescript
// Permission: creator OR any team staff (including org admin fallback)
// for any team linked to this event — same rule as /:id/cancel below.
// Previously this used an inline membership query without the org-admin
// fallback, so league owners couldn't edit events in their own league
// (2026-07-13 audit; the cancel handler had already been fixed).
const isCreator = event.creator_id === userId;
const linkedTeamIds: Array<string | null | undefined> = [
  event.game?.home_team_id ?? null,
  event.game?.away_team_id ?? null,
  (event as any).team_id ?? null,
];
const canManageLinkedTeam = linkedTeamIds.some(Boolean)
  ? await canManageAnyTeam(userId, linkedTeamIds)
  : false;
const isAdmin = await getIsAdmin(req as any);

if (!isCreator && !canManageLinkedTeam && !isAdmin) {
  return res.status(403).json({
    error: 'Permission denied',
    message: 'Only the event creator, team staff, or a league admin can edit this event.',
  });
}
```

- [ ] **Step 4: Typecheck + tests (new + neighbors)**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/event-edit-permissions.test.ts src/__tests__/event-cancel-permissions.test.ts src/__tests__/event-approval-race.test.ts
```

Expected: tsc clean, all PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/routes/events.ts server/src/__tests__/event-edit-permissions.test.ts
git commit -m "fix(events): PATCH /events/:id gets the org-admin fallback cancel already has

League owners/managers without a direct team-staff row were 403'd editing
events for their own league's teams. Uses canManageAnyTeam, identical to the
cancel handler's fixed rule, and pins both with a contract test.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Derive the scheduler's fallback cron from SCHEDULED_JOBS (stop silently dropping jobs)

`setupFallbackCron()` hand-reimplements each job as a `setInterval` and is missing 5 jobs that exist in `SCHEDULED_JOBS` (db-backup-sync, coach-state-drift-probe, stripe-webhook-reconciliation, apple-iap-reconciliation, ad-refund-reconcile). When `REDIS_URL` is unset these never run — silently. Fix by iterating the single `SCHEDULED_JOBS` source of truth with `node-cron` (already a dependency, already used in `src/cron/overnightTasks.ts`), so the two paths can never drift again.

**Files:**

- Modify: `server/src/jobs/scheduler.ts` (replace the body of `setupFallbackCron`, ~lines 414-575)
- Test: `server/src/__tests__/scheduler-fallback-parity.test.ts` (create)

**Interfaces:**

- Consumes: `SCHEDULED_JOBS` array (same module), `captureException`/`withJobTags` (same module), `node-cron` default export via dynamic import.
- Produces: `setupFallbackCron(): Promise<boolean>` — signature change from sync to async is safe; the only caller already does `await setupFallbackCron()` (line ~584).

- [ ] **Step 1: Write the failing contract test**

Create `server/src/__tests__/scheduler-fallback-parity.test.ts`:

```typescript
/**
 * Regression: the no-Redis fallback scheduler must derive from the single
 * SCHEDULED_JOBS list. 2026-07-13 audit found the fallback hand-reimplemented
 * each job as setInterval and had silently dropped 5 jobs (db-backup-sync,
 * coach-state-drift-probe, stripe-webhook-reconciliation,
 * apple-iap-reconciliation, ad-refund-reconcile).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'jobs', 'scheduler.ts'), 'utf8');
const fnStart = src.indexOf('function setupFallbackCron');
const fnEnd = src.indexOf('export async function startSchedulerWorker');
const fallback = src.slice(fnStart, fnEnd);

describe('setupFallbackCron parity with SCHEDULED_JOBS', () => {
  it('iterates SCHEDULED_JOBS instead of hand-listing jobs', () => {
    expect(fnStart).toBeGreaterThan(-1);
    expect(fallback).toMatch(/for \(const job of SCHEDULED_JOBS\)/);
    expect(fallback).toMatch(/node-cron/);
  });
  it('contains no hand-rolled per-job logic that can drift', () => {
    expect(fallback).not.toMatch(/notifyUpcomingGames/);
    expect(fallback).not.toMatch(/remindPendingCoachApprovals/);
    expect(fallback).not.toMatch(/setInterval/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/scheduler-fallback-parity.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Replace setupFallbackCron's body**

In `server/src/jobs/scheduler.ts`, replace the ENTIRE function `function setupFallbackCron(): boolean { ... return true; }` (everything from its declaration through its `return true; }` — currently ~lines 414-575, ending just before the `/** ... Start the scheduler worker ... */` comment) with:

```typescript
async function setupFallbackCron(): Promise<boolean> {
  // No Redis/BullMQ available — schedule every job from the single
  // SCHEDULED_JOBS list via node-cron. This function previously hand-copied
  // each job as a setInterval and had silently dropped five newer jobs
  // (2026-07-13 audit). Deriving from the array means a job added to
  // SCHEDULED_JOBS can never be missing here again.
  const { default: cron } = await import('node-cron');
  for (const job of SCHEDULED_JOBS) {
    cron.schedule(job.cron, async () => {
      try {
        console.log(`[Scheduler] (fallback) Running ${job.name}: ${job.description}`);
        await job.handler();
      } catch (error) {
        console.error(`[Scheduler] (fallback) ${job.name} failed:`, error);
        captureException(
          error instanceof Error ? error : new Error(String(error)),
          withJobTags(job.name, { context: 'scheduler_fallback_job_failed', cron: job.cron })
        );
      }
    });
  }
  console.log(`[Scheduler] Fallback cron armed for ${SCHEDULED_JOBS.length} jobs via node-cron`);
  return true;
}
```

Also delete the now-unused module-level `let lastTransactionReportDate` variable if it exists and nothing else references it (`grep -n "lastTransactionReportDate" server/src/jobs/scheduler.ts` — if only the deleted function used it, remove it).

- [ ] **Step 4: Typecheck + tests**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/scheduler-fallback-parity.test.ts
```

Expected: tsc clean, PASS.

- [ ] **Step 5: Smoke the fallback path actually schedules without Redis**

```bash
cd ~/Code/VarsityHubMobile/server && node --input-type=module -e "
process.env.REDIS_URL = '';
const mod = await import('./node_modules/node-cron/dist/cjs/node-cron.js').catch(() => import('node-cron'));
console.log('node-cron loads OK');
" 2>&1 | tail -2
```

Expected: `node-cron loads OK`. (Full startSchedulerWorker smoke needs the DB; the contract test + typecheck cover the wiring.)

- [ ] **Step 6: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/jobs/scheduler.ts server/src/__tests__/scheduler-fallback-parity.test.ts
git commit -m "fix(scheduler): fallback cron derives from SCHEDULED_JOBS — no more silently dropped jobs

Without Redis the fallback hand-reimplemented jobs as setIntervals and had
drifted to miss 5 (db-backup-sync, coach-state-drift-probe, stripe/apple
reconciliation, ad-refund-reconcile). Now iterates the single job list via
node-cron, preserving exact cron schedules.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Fix the stale rate-limit checker regexes (unblocks `verify:p0:foundation`)

`scripts/verify-rate-limit-coverage.ts`'s five `uploads.ts` patterns expect the path string immediately after the opening paren (`uploadsRouter.get('/sign',`), but a prettier sweep reformatted `uploads.ts` to one-argument-per-line, so all five false-fail — which is the only reason `npm run verify:p0:foundation` is red. The `uploadLimiter` middleware is confirmed present at all five routes.

**Files:**

- Modify: `server/scripts/verify-rate-limit-coverage.ts` (the five uploads patterns, ~lines 134-160)

**Interfaces:**

- Produces: `npm --prefix server run verify:rate-limits` exits 0; `npm run verify:p0:foundation` chain proceeds past it.

- [ ] **Step 1: Confirm the current failure**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm run verify:rate-limits 2>&1 | tail -10
```

Expected: 5 `[FAIL] uploads ...` lines, exit 1.

- [ ] **Step 2: Fix the five patterns**

In `server/scripts/verify-rate-limit-coverage.ts`, change each uploads pattern from the same-line form to the whitespace-tolerant form the ads patterns already use (`\(\s*'`). Exact replacements:

```typescript
  // Uploads — \(\s*' tolerates prettier's one-arg-per-line formatting.
  {
    file: 'src/routes/uploads.ts',
    pattern:
      /uploadsRouter\.get\(\s*'\/cloudinary-signature',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads cloudinary-signature limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.get\(\s*'\/sign',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads sign limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\(\s*'\/',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads media endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\(\s*'\/files',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads files endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\(\s*'\/avatar',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads avatar limiter',
  },
```

- [ ] **Step 3: Verify the checker passes AND still catches a real gap**

```bash
cd ~/Code/VarsityHubMobile/server && npm run verify:rate-limits
```

Expected: all checks `[OK]`, exit 0.

Then prove the checker still works (temporarily break it): change `'\/avatar',` to `'\/avatarX',` in the pattern, re-run, expect `[FAIL] uploads avatar limiter`, then revert that character. This guards against writing a regex that vacuously passes.

- [ ] **Step 4: Run the full p0 foundation gate**

```bash
cd ~/Code/VarsityHubMobile && npm run verify:p0:foundation 2>&1 | tail -15
```

Expected: exits 0 (both npm audits clean from Task 0's committed overrides, rate-limits OK, payments confidence suite passes).

- [ ] **Step 5: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/scripts/verify-rate-limit-coverage.ts
git commit -m "fix(scripts): rate-limit checker tolerates prettier formatting (unblocks verify:p0:foundation)

The five uploads.ts patterns required the route path on the same line as the
router call; a prettier sweep reformatted uploads.ts to one-arg-per-line and
all five false-failed. uploadLimiter was present the whole time.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: `settings/reset-password.tsx` uses canonical `validatePassword`

The logged-in change-password screen only checks `length >= 8`; sign-up and forgot-password use `validatePassword(p, 8, true)` which also requires a letter and a number ("must match backend"). Result: this one screen accepts `"aaaaaaaa"` client-side and round-trips a server 400.

**Files:**

- Modify: `app/settings/reset-password.tsx` (~lines 53-56 and the import block)
- Test: `__tests__/validation-consistency.test.ts` (create — shared by Tasks 7-10)

**Interfaces:**

- Consumes: `validatePassword(password: string, minLength = 8, requireStrong = true): {valid: boolean; error?: string}` from `utils/formUtils.ts`.
- Produces: `__tests__/validation-consistency.test.ts` — Tasks 8-10 append specs to this same file.

- [ ] **Step 1: Write the failing contract test**

Create `__tests__/validation-consistency.test.ts`:

```typescript
/**
 * Regression: screens must use the canonical validators/formatters instead of
 * hand-rolled copies. 2026-07-13 audit found four screens whose local copies
 * had drifted from the canonical rule (weaker password check, missing plan
 * aliases, inverted name precedence, dead-code username validator).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('password validation consistency', () => {
  const src = read('app/settings/reset-password.tsx');
  it('settings change-password uses validatePassword from formUtils', () => {
    expect(src).toMatch(/import\s*\{[^}]*validatePassword[^}]*\}\s*from\s*'@\/utils\/formUtils'/);
    expect(src).toMatch(/validatePassword\(/);
  });
  it('no longer hand-rolls a length-only check', () => {
    expect(src).not.toMatch(/p\.length < 8/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx jest __tests__/validation-consistency.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

In `app/settings/reset-password.tsx`:

Add to imports (match the file's existing `@/` import style):

```typescript
import { validatePassword } from '@/utils/formUtils';
```

Replace:

```typescript
if (p.length < 8) {
  Alert.alert('Password too short', 'Use at least 8 characters.');
  return;
}
```

with:

```typescript
const passwordCheck = validatePassword(p, 8, true);
if (!passwordCheck.valid) {
  Alert.alert('Invalid password', passwordCheck.error || 'Use at least 8 characters.');
  return;
}
```

- [ ] **Step 4: Typecheck + test passes**

```bash
cd ~/Code/VarsityHubMobile && npx tsc --noEmit && npx jest __tests__/validation-consistency.test.ts
```

Expected: clean, PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add app/settings/reset-password.tsx __tests__/validation-consistency.test.ts
git commit -m "fix(settings): change-password uses canonical validatePassword (letter+number rule)

This screen only checked length, accepting passwords that sign-up and
forgot-password reject — then round-tripping a server 400.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `create-team.tsx` plan badge uses canonical `normalizePlan`

`create-team.tsx` has a local `normalizePlanTier()` that doesn't know the legacy aliases (`'premium'→'veteran'`, `'pro'→'legend'`) that canonical `normalizePlan()` in `constants/plans.ts` was explicitly fixed to handle — a legacy tier value renders a raw wrong badge on this screen only.

**Files:**

- Modify: `app/(tabs)/create-team.tsx` (~lines 152-163 and the `@/constants/plans` import)
- Test: `__tests__/validation-consistency.test.ts` (append)

**Interfaces:**

- Consumes: `normalizePlan(planId: Plan | string | undefined): Plan` from `constants/plans.ts`.

- [ ] **Step 1: Append the failing specs**

Append to `__tests__/validation-consistency.test.ts`:

```typescript
describe('plan tier normalization consistency', () => {
  const src = read('app/(tabs)/create-team.tsx');
  it('create-team uses normalizePlan from constants/plans', () => {
    expect(src).toMatch(/import\s*\{[^}]*normalizePlan[^}]*\}\s*from\s*'@\/constants\/plans'/);
  });
  it('no longer defines a local normalizePlanTier', () => {
    expect(src).not.toMatch(/const normalizePlanTier\s*=/);
  });
});
```

- [ ] **Step 2: Run to verify the new specs fail**

```bash
cd ~/Code/VarsityHubMobile && npx jest __tests__/validation-consistency.test.ts
```

Expected: the two new specs FAIL, Task 7 specs still PASS.

- [ ] **Step 3: Implement**

In `app/(tabs)/create-team.tsx`:

Add `normalizePlan` to the existing `@/constants/plans` import (line ~36 already imports `ROOKIE_PROGRAM_LIMIT` from it).

Replace:

```typescript
const normalizePlanTier = (tier?: string | null) => {
  const value = String(tier ?? 'rookie').toLowerCase();
  if (value === 'free') return 'rookie';
  if (['rookie', 'veteran', 'legend'].includes(value)) return value;
  return value;
};

const formatPlanBadge = (tier?: string | null) => normalizePlanTier(tier).toUpperCase();
const formatPlanDisplay = (tier?: string | null) => {
  const normalized = normalizePlanTier(tier);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
```

with:

```typescript
// Plan labels route through the canonical normalizer so legacy tier strings
// ('premium', 'pro') render their mapped plan, matching every other screen.
const formatPlanBadge = (tier?: string | null) => normalizePlan(tier ?? undefined).toUpperCase();
const formatPlanDisplay = (tier?: string | null) => {
  const normalized = normalizePlan(tier ?? undefined);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
```

- [ ] **Step 4: Typecheck + tests**

```bash
cd ~/Code/VarsityHubMobile && npx tsc --noEmit && npx jest __tests__/validation-consistency.test.ts
```

Expected: clean, all PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add "app/(tabs)/create-team.tsx" __tests__/validation-consistency.test.ts
git commit -m "fix(create-team): plan badge uses canonical normalizePlan (legacy premium/pro aliases)

The local copy predated the alias fix in constants/plans.ts, so legacy tier
values rendered a raw wrong badge on this screen only.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: `message-thread.tsx` uses canonical `formatUserLabel`

Two spots build the other participant's label as `username ? '@'+username : display_name || email || 'User'` — handle-first, the inverse of canonical `formatUserLabel()` (display-name-first). Same user renders differently here than on every other screen.

**Files:**

- Modify: `app/message-thread.tsx` (~lines 704 and 724, plus import)
- Test: `__tests__/validation-consistency.test.ts` (append)

**Interfaces:**

- Consumes: `formatUserLabel(user?: {display_name?, username?, email?, id?} | null, fallback = 'User'): string` from `utils/userDisplay.ts`.

- [ ] **Step 1: Append the failing specs**

Append to `__tests__/validation-consistency.test.ts`:

```typescript
describe('user label consistency', () => {
  const src = read('app/message-thread.tsx');
  it('message-thread uses formatUserLabel', () => {
    expect(src).toMatch(/import\s*\{[^}]*formatUserLabel[^}]*\}\s*from\s*'@\/utils\/userDisplay'/);
    expect(src).toMatch(/formatUserLabel\(otherParticipant/);
  });
  it('no longer inverts precedence with a handle-first inline chain', () => {
    expect(src).not.toMatch(/otherParticipant\.username \? `@\$\{otherParticipant\.username\}`/);
  });
});
```

- [ ] **Step 2: Run to verify the new specs fail**

```bash
cd ~/Code/VarsityHubMobile && npx jest __tests__/validation-consistency.test.ts
```

Expected: the two new specs FAIL.

- [ ] **Step 3: Implement**

In `app/message-thread.tsx`, add the import:

```typescript
import { formatUserLabel } from '@/utils/userDisplay';
```

Site A (report-abuse navigation, ~line 704). Replace:

```typescript
`/report-abuse?userId=${otherParticipant.id}&userName=${encodeURIComponent(otherParticipant.username ? `@${otherParticipant.username}` : otherParticipant.display_name || otherParticipant.email || 'User')}`;
```

with:

```typescript
`/report-abuse?userId=${otherParticipant.id}&userName=${encodeURIComponent(formatUserLabel(otherParticipant))}`;
```

Site B (block confirmation, ~line 724). Replace:

```typescript
                        `Are you sure you want to block ${otherParticipant.username ? `@${otherParticipant.username}` : otherParticipant.display_name || otherParticipant.email || 'this user'}? They will no longer be able to message you.`,
```

with:

```typescript
                        `Are you sure you want to block ${formatUserLabel(otherParticipant, 'this user')}? They will no longer be able to message you.`,
```

Check for any other inline chains in the same file: `grep -n "otherParticipant.username ?" app/message-thread.tsx` — rewire any remaining hits the same way.

- [ ] **Step 4: Typecheck + tests (including the existing userDisplay suite)**

```bash
cd ~/Code/VarsityHubMobile && npx tsc --noEmit && npx jest __tests__/validation-consistency.test.ts utils/__tests__/userDisplay.test.ts
```

Expected: clean, all PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add app/message-thread.tsx __tests__/validation-consistency.test.ts
git commit -m "fix(messages): thread labels use canonical formatUserLabel (display-name-first)

Two inline chains showed the handle first — the inverse of every other
screen's precedence for the same user.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Consolidate username validation onto `formUtils`

`validateUsername()` in `utils/formUtils.ts` is dead code while `edit-username.tsx` and `onboarding/step-2-basic.tsx` each hand-roll the identical rule. Wire `edit-username.tsx` to the function; export the regex for `step-2-basic.tsx` (which needs the raw regex for its reactive `canContinue` derivation, not an Alert-flow validator).

**Files:**

- Modify: `utils/formUtils.ts` (export the regex; use it inside validateUsername)
- Modify: `app/settings/edit-username.tsx` (~lines 37-52, plus import)
- Modify: `app/onboarding/step-2-basic.tsx` (~line 27, plus import)
- Test: `__tests__/validation-consistency.test.ts` (append)

**Interfaces:**

- Consumes: existing `validateUsername(username: string): ValidationResult`.
- Produces: `export const USERNAME_REGEX = /^[a-z0-9_.]+$/;` from `utils/formUtils.ts`.

- [ ] **Step 1: Append the failing specs**

Append to `__tests__/validation-consistency.test.ts`:

```typescript
describe('username validation consistency', () => {
  it('formUtils exports USERNAME_REGEX and validateUsername uses it', () => {
    const src = read('utils/formUtils.ts');
    expect(src).toMatch(/export const USERNAME_REGEX = \/\^\[a-z0-9_\.\]\+\$\//);
  });
  it('edit-username uses validateUsername instead of a hand-rolled copy', () => {
    const src = read('app/settings/edit-username.tsx');
    expect(src).toMatch(/validateUsername\(/);
    expect(src).not.toMatch(/\/\^\[a-z0-9_\.\]\+\$\/\.test/);
  });
  it('onboarding step-2 imports USERNAME_REGEX instead of defining its own', () => {
    const src = read('app/onboarding/step-2-basic.tsx');
    expect(src).toMatch(/USERNAME_REGEX/);
    expect(src).not.toMatch(/const usernameRe = \//);
  });
});
```

- [ ] **Step 2: Run to verify the new specs fail**

```bash
cd ~/Code/VarsityHubMobile && npx jest __tests__/validation-consistency.test.ts
```

Expected: the three new specs FAIL.

- [ ] **Step 3: Export the regex from formUtils.ts**

In `utils/formUtils.ts`, directly above `validateUsername`:

```typescript
/** Canonical username rule — matches backend: lowercase letters, numbers, dots, underscores. */
export const USERNAME_REGEX = /^[a-z0-9_.]+$/;
```

and inside `validateUsername`, replace the literal `if (!/^[a-z0-9_.]+$/.test(username)) {` with `if (!USERNAME_REGEX.test(username)) {`.

- [ ] **Step 4: Rewire edit-username.tsx**

Add import: `import { validateUsername } from '@/utils/formUtils';`

Replace the three hand-rolled blocks (format regex + too-short + too-long Alerts, ~lines 37-52):

```typescript
// Validate username format (lowercase letters, numbers, dots, underscores only)
if (!/^[a-z0-9_.]+$/.test(v)) {
  Alert.alert(
    'Invalid username',
    'Username can only contain lowercase letters, numbers, dots, and underscores'
  );
  return;
}
if (v.length < 3) {
  Alert.alert('Username too short', 'Username must be at least 3 characters');
  return;
}
if (v.length > 20) {
  Alert.alert('Username too long', 'Username must be 20 characters or less');
  return;
}
```

with:

```typescript
const usernameCheck = validateUsername(v);
if (!usernameCheck.valid) {
  Alert.alert('Invalid username', usernameCheck.error);
  return;
}
```

- [ ] **Step 5: Rewire step-2-basic.tsx**

Add `USERNAME_REGEX` to the existing `@/utils/formUtils` import (line ~17 already imports `BIO_MAX_LENGTH` from it).

Delete the local definition (~line 27):

```typescript
// Username validation: lowercase letters, numbers, dots, underscores only (matches backend)
// Spaces are normalized to underscores BEFORE validation
const usernameRe = /^[a-z0-9_.]+$/;
```

and replace both `usernameRe` usages (~lines 385 and 394) with `USERNAME_REGEX`. Keep the "Spaces are normalized to underscores BEFORE validation" comment wherever the normalization happens.

- [ ] **Step 6: Typecheck + tests**

```bash
cd ~/Code/VarsityHubMobile && npx tsc --noEmit && npx jest __tests__/validation-consistency.test.ts
```

Expected: clean, ALL specs in the file PASS (Tasks 7-10).

- [ ] **Step 7: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add utils/formUtils.ts app/settings/edit-username.tsx app/onboarding/step-2-basic.tsx __tests__/validation-consistency.test.ts
git commit -m "refactor(validation): consolidate username rule onto formUtils (was dead code + 2 copies)

validateUsername existed but nothing imported it; both screens hand-rolled
the identical rule. Exports USERNAME_REGEX for reactive-validation use.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Harden `renderAppHandoffPage` — escape title/description inside the helper

The helper interpolates `title` and `description` unescaped; today every call site passes hardcoded titles and pre-escapes the one dynamic value (email), so it's not exploitable — but the next call site that forgets creates a real reflected XSS. Move escaping inside the helper and strip the now-double-escaping `escapeHtml()` wrappers at call sites. `extraHtml` stays raw by design (it is intentional markup, and its builders already escape their interpolations).

**Files:**

- Modify: `server/src/routes/publicAppHandoff.ts` (helper ~line 68-80; call sites ~lines 170, 183, 191, 350, 380, 389)
- Test: `server/src/__tests__/public-handoff-escaping.test.ts` (create)

**Interfaces:**

- Produces: `renderAppHandoffPage(title, description, nativeUrl, extraHtml?, options?)` — same signature, but `title`/`description` are HTML-escaped internally; callers pass RAW strings for these two params.

- [ ] **Step 1: Write the failing contract test**

Create `server/src/__tests__/public-handoff-escaping.test.ts`:

```typescript
/**
 * Regression: renderAppHandoffPage must escape title/description itself.
 * Previously escaping was call-site discipline only — safe today, one
 * forgotten escapeHtml() away from reflected XSS (2026-07-13 audit).
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'routes', 'publicAppHandoff.ts'), 'utf8');
const fnStart = src.indexOf('function renderAppHandoffPage');
const fnEnd = src.indexOf('\n}', fnStart) + 2;
const helper = src.slice(fnStart, fnEnd);

describe('renderAppHandoffPage escaping', () => {
  it('escapes title and description inside the helper', () => {
    expect(helper).toMatch(/const safeTitle = escapeHtml\(title\)/);
    expect(helper).toMatch(/const safeDescription = escapeHtml\(description\)/);
    expect(helper).toMatch(/<title>\$\{safeTitle\}<\/title>/);
  });
  it('call sites no longer pre-escape values passed into description (no double-escaping)', () => {
    // Any escapeHtml(...) interpolated inside a template literal that is an
    // argument in a renderAppHandoffPage call's description would now
    // double-escape. The email-interpolating sites must pass raw values.
    const callSiteSection = src.slice(fnEnd);
    expect(callSiteSection).not.toMatch(/for \$\{escapeHtml\(state\.email\)\}/);
    expect(callSiteSection).not.toMatch(/for \$\{escapeHtml\(email\)\}/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/public-handoff-escaping.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Escape inside the helper**

In `renderAppHandoffPage` (~line 68), before the `return` statement add:

```typescript
// Escape here — not at call sites — so a future caller can never forget.
// extraHtml stays raw by design: it is intentional markup whose builders
// escape their own interpolations.
const safeTitle = escapeHtml(title);
const safeDescription = escapeHtml(description);
```

and in the returned template literal replace all `${title}` with `${safeTitle}` (two occurrences: `<title>` and `<h1>`) and `${description}` with `${safeDescription}` (one occurrence in `<p>`).

- [ ] **Step 4: Strip pre-escaping at all call sites**

Replace every `${escapeHtml(state.email)}` and `${escapeHtml(email)}` that appears inside a `renderAppHandoffPage(...)` description argument with the raw `${state.email}` / `${email}`. Sites (verify with `grep -n "escapeHtml(state.email)\|escapeHtml(email)" server/src/routes/publicAppHandoff.ts`):

- ~line 172: `Verification Link Expired` description
- ~line 183: `Email Already Verified` description
- ~line 191: `Verification Link Invalid` description
- ~line 350: `Check Your Email` description
- ~line 380: `Reset Link Expired` description
- ~line 389: `Reset Link Invalid` description

Do NOT touch `escapeHtml(...)` uses inside `buildVerifyResendCtaHtml` / `buildVerifyFallbackHtml` / other extraHtml builders or `escapeHtml(nativeUrl)` in the helper's anchor href — those are raw-HTML contexts that must keep their own escaping.

- [ ] **Step 5: Typecheck + tests**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile && npx tsc --noEmit --project server/tsconfig.json
cd server && npm test -- --runTestsByPath src/__tests__/public-handoff-escaping.test.ts
```

Expected: tsc clean, PASS.

- [ ] **Step 6: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/src/routes/publicAppHandoff.ts server/src/__tests__/public-handoff-escaping.test.ts
git commit -m "fix(security): renderAppHandoffPage escapes title/description internally

Escaping was call-site discipline; every current caller was safe but one
forgotten escapeHtml() away from reflected XSS. Call sites now pass raw
values (pre-escaping removed to avoid double-escaping).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Extend `.snyk` ignores to the remaining verified-false-positive XSS files

Snyk SAST can't trace `escapeHtml()` as a sanitizer (already documented in `.snyk` for `organizations.ts`/`ads.ts`). The 2026-07-13 audit verified the same pattern holds for the remaining flagged files — inline escaping, or escaping one layer down in shared `lib/reviewPage.ts`. Extend the existing `javascript/XSS` ignore section with per-file justifications.

**Files:**

- Modify: `.snyk` (the `javascript/XSS:` section)

**Interfaces:**

- Consumes: existing `.snyk` `javascript/XSS` entry format (path + reason + expires).

- [ ] **Step 1: Append the entries**

In `.snyk`, inside the existing `javascript/XSS:` list (after the `ads.ts` entry), add:

```yaml
- 'server/src/routes/og.ts':
    reason: 'OG link-preview pages escape every interpolated value inline via escape-html (genericOgPage/ogPage helpers). Verified 2026-07-13 — Snyk SAST false positive.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/admin.ts':
    reason: 'Coach review pages escape via shared lib/reviewPage.ts (renderResultPage/renderReviewPage) — Snyk cannot trace the sanitizer across the file boundary. Verified 2026-07-13.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/events.ts':
    reason: 'Event review pages escape via shared lib/reviewPage.ts — cross-file sanitizer Snyk cannot trace. Verified 2026-07-13.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/games.ts':
    reason: 'Game review pages escape via shared lib/reviewPage.ts — cross-file sanitizer Snyk cannot trace. Verified 2026-07-13.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/adminReports.ts':
    reason: 'Abuse-report review pages escape all interpolated values inline via escape-html. Verified 2026-07-13 — Snyk SAST false positive.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/consent.ts':
    reason: 'Parental-consent pages escape all interpolated values inline via escape-html (incl. CSRF token fields). Verified 2026-07-13 — Snyk SAST false positive.'
    expires: '2027-03-27T23:59:59Z'
- 'server/src/routes/publicAppHandoff.ts':
    reason: 'renderAppHandoffPage escapes title/description internally (hardened 2026-07-13) and extraHtml builders escape their interpolations. Snyk SAST false positive.'
    expires: '2027-03-27T23:59:59Z'
```

- [ ] **Step 2: Validate the YAML parses**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile/server && node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const doc = yaml.load(fs.readFileSync('../.snyk', 'utf8'));
console.log('parsed OK —', Object.keys(doc.ignore).length, 'ignore rules,', doc.ignore['javascript/XSS'].length, 'XSS file entries');
"
```

(run from `server/` — js-yaml resolves from the server's node_modules)
Expected: `parsed OK — <N> ignore rules, 9 XSS file entries`.

- [ ] **Step 3: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add .snyk
git commit -m "chore(snyk): ignore verified-false-positive XSS findings (escapeHtml sanitizer untraced)

Extends the existing organizations.ts/ads.ts pattern to the 7 remaining
flagged route files — each verified 2026-07-13 to escape inline or via
shared lib/reviewPage.ts, which Snyk SAST cannot trace cross-file.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13 (GATED — get explicit user approval before starting): Dockerfile hardening for container CVEs

All 23 non-app container findings come from stale base-image OS packages (no `apt-get upgrade`) and the Node image's bundled npm CLI. STOP before this task and ask the user: the Dockerfile feeds Railway's production build, and while this change only lands on deploy-after-merge, the user explicitly deferred this decision during the audit.

**Files:**

- Modify: `server/Dockerfile` (both stages' apt-get blocks)

- [ ] **Step 1: ASK THE USER for go-ahead. Do not proceed without it.**

- [ ] **Step 2: Apply the same change to BOTH stages**

Stage 1 (`web-builder`, line ~7) and stage 2 (runtime, line ~29) — replace each:

```dockerfile
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential python3 openssl \
  && rm -rf /var/lib/apt/lists/*
```

with:

```dockerfile
RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends build-essential python3 openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g npm@latest
```

- [ ] **Step 3: Verify the image still builds locally (if Docker is available)**

```bash
cd ~/Code/VarsityHubMobile && docker build -f server/Dockerfile -t varsityhub-server:audit-test . 2>&1 | tail -5
```

Expected: `Successfully tagged` / `naming to ...` final line. If Docker isn't available locally, note that in the commit body and flag that the first Railway build after merge is the real verification.

- [ ] **Step 4: Commit**

```bash
cd ~/Code/VarsityHubMobile
git add server/Dockerfile
git commit -m "fix(docker): apt-get upgrade + latest npm in both stages (clears base-image CVEs)

Container scan findings were all stale Debian packages (never upgraded after
install) and the Node image's bundled npm CLI internals — not app code.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Full verification battery + summary

- [ ] **Step 1: Full gates**

```bash
source ~/.nvm/nvm.sh 2>/dev/null; nvm use 20 >/dev/null 2>&1
cd ~/Code/VarsityHubMobile
npx tsc --noEmit && npx tsc --noEmit --project server/tsconfig.json
npm run test:regressions
npm run verify:p0:foundation
npm run check:conflicts
npm run format:check
```

Expected: everything exits 0. If `format:check` flags touched files, run `npm run format` and amend the relevant commits (or add a single `style:` commit).

- [ ] **Step 2: Run every new test file in one pass**

```bash
cd ~/Code/VarsityHubMobile/server && npm test -- --runTestsByPath src/__tests__/team-invite-endpoint-parity.test.ts src/__tests__/admin-check-verification-parity.test.ts src/__tests__/event-edit-permissions.test.ts src/__tests__/scheduler-fallback-parity.test.ts src/__tests__/public-handoff-escaping.test.ts
cd ~/Code/VarsityHubMobile && npx jest __tests__/validation-consistency.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Summarize for the user**

Report: branch name, commit list (`git log --oneline main..fix/audit-drift-2026-07`), and the three decisions that remain THEIRS:

1. Merge/push to `main` (Railway auto-deploys the server on push).
2. `eas update --branch production` afterward — the client fixes (Tasks 7-10) are NOT live for users until this runs.
3. Snyk quota (billing) + the Vercel-site Sentry browser check — still outstanding from the earlier audit, untouched by this plan.
