# VarsityHub Production Readiness Prompts

This prompt pack is tuned for VarsityHub's actual failure modes, especially coach upgrade, onboarding, organization join requests, approval gating, and paid plan access.

Use these in order. Do not skip the inventory and contract passes.

## Recommended usage

Default: run these as a checklist, one prompt at a time.

Reason: VarsityHub has enough stateful role, approval, and onboarding logic that a single giant prompt tends to blur cause-and-effect and produce shallow findings.

Use the single master prompt only when you need one pasteable handoff for another agent.

## Rules for the assistant you are prompting

Paste this before the prompt set if needed:

```text
Read first, then verify, then fix. Do not assume the UI reflects backend truth. Treat the server as the source of truth for permissions and state transitions. Cite file paths for every claim. If a flow depends on coach state, explicitly track these fields across the whole flow:

- User.approval_status
- User.paid_by_owner
- preferences.role
- preferences.plan
- preferences.onboarding_completed
- preferences.organization_id
- preferences.organization_name
- preferences.join_request_pending
- preferences.pending_plan
- preferences.payment_pending
- preferences.payment_approved
- preferences.proceeding_as_fan
- preferences.coach_agreement_accepted_at
- preferences.coach_agreement_version
- rejected_at
- rejection_reason

Do not include AWS, S3, Lambda, SNS, SES, or any AWS advice unless the codebase actually references them.
```

## Single master prompt

```text
You are auditing VarsityHub end-to-end. Work in phases, in order. Do not skip phases. Do not fix anything until the end-to-end flow phase unless I explicitly ask. Prioritize these three failure modes first before anything else:

1. API base URL or environment mismatch
2. Auth middleware silently blocking or misclassifying requests
3. Role, approval, or onboarding fields updating on the server but not being re-read by the client

VarsityHub-specific focus areas you must cover:
- fan -> coach upgrade flow
- coach onboarding and coach agreement versioning
- coach approval states: PENDING, APPROVED, REJECTED
- organization approval dependency (`organization.admin_approved`)
- paid-tier coach gating (`payment_pending`, `payment_approved`, `pending_plan`)
- `paid_by_owner` bypass logic
- 48h `REJECTION_COOLDOWN` on upgrade and reapply paths
- ad creation, banner upload, submission, approval, payment, activation
- minor signup and parental consent
- data export request -> build -> signed download
- iOS payment rules vs Android payment rules
- `/auth/me` cache refresh after role or approval changes

Phase 1 — Ground truth inventory

Produce `STACK_MAP.md` with:
1. Every frontend route or screen and intended purpose
2. Every backend endpoint, auth chain, and which frontend file calls it
3. Every database model and which routes read or write it
4. Every external integration and exactly where it is used
5. Every env var referenced by code, grouped by frontend or server, and whether it appears present or missing
6. Every user-visible feature and whether its full code path exists end-to-end
7. A coach state-machine table covering fan, upgrade requested, PENDING, APPROVED, REJECTED, REAPPLY, payment pending, and paid_by_owner

Requirements:
- cite file paths for every claim
- mark missing code paths as `MISSING`
- mark backend handlers with no client caller as `UNUSED`
- do not fix yet

Phase 2 — Frontend/backend contract check

Using `STACK_MAP.md`, verify every frontend API call against a real backend handler.

For each call, check:
- URL path
- HTTP method
- auth header usage
- request body shape
- query params
- response shape expected by the UI
- whether the client invalidates or refetches cached user state after mutations

Output a table:
frontend file -> endpoint -> backend handler -> status

Status must be one of:
- ✅ match
- ❌ mismatch
- ⚠️ missing
- ⚠️ stale client cache
- ⚠️ response shape drift

Pay special attention to:
- `/auth/me`
- `/auth/upgrade-to-coach`
- `/auth/coach/reapply`
- coach agreement acceptance/update path
- org join and org approval paths
- ad submission and payment paths
- data export status and download paths

Do not fix yet.

Phase 3 — Auth, roles, approvals, and gating sweep

Audit every protected route and action. Verify the real middleware chain and the business checks inside handlers.

For each protected route or action, confirm:
- auth is actually required
- email verification is actually required where intended
- onboarding completion is actually required where intended
- coach-only features reject fans
- pending and rejected coaches are blocked correctly
- org approval is enforced consistently
- coach agreement acceptance and versioning are enforced consistently
- paid tier gates are enforced consistently
- `paid_by_owner` bypass works only where intended
- session refresh or `/auth/me` re-read occurs after role-changing actions
- logout invalidates access correctly

Explicitly trace these state transitions:
- fan -> coach via `/auth/upgrade-to-coach`
- rejected coach -> reapply
- coach pending -> approved
- org pending -> admin approved
- agreement accepted on old version -> forced re-accept on new required version

List every inconsistency with:
- file
- line
- exact condition that fails
- expected behavior
- probable root cause

Do not fix yet.

Phase 4 — End-to-end flow verification

Trace these flows step-by-step through code:
1. fan signup -> verify email -> onboarding -> feed
2. fan -> upgrade to coach -> plan select -> agreement -> org create or join -> team create
3. coach with outdated agreement -> blocked -> re-accept -> regain access
4. coach on paid tier with `payment_pending` -> checkout -> access restored
5. coach under owner-paid org with `paid_by_owner=true` -> bypass self-checkout correctly
6. create ad -> pick banner image -> upload -> submit -> admin review visible -> payment -> go live
7. minor signup -> parent email -> consent approve -> unblock protected actions
8. data export request -> pending/building/ready -> signed download

For each broken step, report:
- flow name
- step number
- frontend file
- backend file
- line or handler
- why it breaks
- whether it is frontend-only, backend-only, or contract/state-sync
- the exact fix

Then fix the P0 blockers first, re-verify, and show diffs.

Phase 5 — External integration health

For each active integration, verify:
- required env vars are referenced and named correctly
- runtime behavior when vars are missing
- webhook or callback handlers exist where needed
- failure modes are handled
- happy path is test-covered or manually verifiable
- docs drift exists or not

Cover only integrations actually present in code:
- payments
- auth
- storage adapter currently in code
- email
- push notifications
- analytics or error reporting

Do not assume any provider unless the code references it directly.

Report each integration as:
- Confirmed working
- Broken
- Config missing
- Unverifiable without live credentials

Phase 6 — Ship checklist

Act like a real user on a real device and produce a release blocker list.

For each visible feature, answer:
- yes or no: does it work end-to-end?
- if no, what is the single blocker?

Prioritize:
- P0 = feature broken or blocked
- P1 = works but obvious bug
- P2 = polish or low risk

Fix all P0 issues you can fix in-repo, then re-run the affected flow checks and confirm results.

Phase 7 — Root cause pass

After all findings, identify 1-3 shared root causes. Prefer root causes like:
- stale `/auth/me` cache after mutations
- duplicated role or approval logic across client and server
- mismatched response shapes
- middleware order bugs
- dead routes or half-finished refactors
- environment or base URL misconfiguration

For each root cause:
- show which bugs it explains
- apply the smallest durable fix
- show the "one fix resolves N bugs" wins

Rules:
- cite file paths for every non-obvious claim
- do not hand-wave likely causes without tracing them
- prefer server truth over client assumptions for approvals, role state, and agreement versioning
- if a client bug depends on server truth being refetched, explicitly verify cache invalidation or `/auth/me` refresh
- do not mention any cloud provider unless the code directly uses it
- commit only after each isolated fix batch, not after the whole audit
```

## Prompt 1: Ground truth inventory

```text
Before fixing anything, produce a single markdown file called STACK_MAP.md with:

1. Every frontend route/screen and what it is supposed to do
2. Every backend endpoint, its auth requirements, and which frontend screens call it
3. Every database table/model and which endpoints read/write it
4. Every external service actually used in this repo and where it is integrated
5. Every env var the app expects, which ones are referenced in code, and which ones appear required for startup or feature execution
6. Every advertised feature from the UI and whether the full code path exists end-to-end
7. A separate coach state-machine table covering:
   fan
   fan -> upgrade requested
   coach + PENDING
   coach + APPROVED
   coach + REJECTED
   coach + REAPPLY
   coach + APPROVED + payment pending
   coach + APPROVED + paid_by_owner
8. A separate approval-path table distinguishing:
   platform-admin approval
   organization-owner approval
   organization join request approval

For every entry, cite file paths. If something is referenced but does not exist, flag it as MISSING.

Do not fix anything yet.
```

## Prompt 2: Frontend/backend contract check

```text
Using STACK_MAP.md, verify that every frontend API call matches a real backend handler.

For each call, check:
1. URL matches
2. HTTP method matches
3. Request body shape matches what the backend validates
4. Response shape matches what the frontend expects to render
5. Auth and verification requirements match what the frontend assumes

For coach-related calls, also verify state transitions, not just request/response shape. After each call, explicitly state which fields should change and which subsequent screens depend on those fields.

Output a table:
frontend file -> endpoint -> backend handler -> state change -> status

Status must be one of:
✅ match
❌ mismatch
⚠️ missing

Do not fix yet. I want the full mismatch list first.
```

## Prompt 3: Auth and permissions sweep

```text
Audit every protected route and action.

For each protected route or mutation, confirm:
1. The backend actually checks auth
2. Email verification is enforced where intended
3. Role-based access is enforced server-side, not just in the client
4. Token refresh and stale /me cache behavior do not leave the client in a wrong state
5. Logout actually invalidates access

Pay special attention to coach gating. Trace whether requireOnboarded and related handlers consistently enforce:
- approval_status
- coach_agreement_accepted_at
- coach_agreement_version
- organization_id
- join_request_pending
- pending_plan
- payment_pending
- payment_approved
- paid_by_owner
- proceeding_as_fan

Also verify that client-side coach UI checks match backend truth. Flag any case where the client reads preferences.role but ignores approval_status or other required server-side fields.

List every inconsistency with file path and exact reason.
Do not fix yet.
```

## Prompt 3B: Coach approval matrix

```text
Build a coach approval matrix for this repo.

For each user state below, list:
1. Which screens should be visible
2. Which endpoints should succeed
3. Which endpoints should fail
4. What error code or response the server should return
5. Which client route should handle that failure

States:
- fan
- coach + PENDING
- coach + APPROVED + no coach agreement accepted
- coach + APPROVED + agreement accepted + rookie
- coach + APPROVED + agreement accepted + veteran/legend + payment_pending
- coach + APPROVED + paid_by_owner
- coach + REJECTED
- coach + REJECTED + cooldown expired

Use real code, not assumptions. Cite middleware, route handlers, and screens for every row.
Do not fix yet.
```

## Prompt 4: End-to-end flow verification

```text
Verify the top VarsityHub flows by simulating them step-by-step through the code.

You must include these flows:
1. Sign up -> verify email -> complete fan onboarding
2. Fan -> Settings -> Upgrade to Coach -> route into coach onboarding
3. Coach -> create new organization during onboarding
4. Coach -> request to join existing organization
5. Organization owner -> review and approve/reject coach join requests
6. Approved coach -> accept coach agreement -> access coach tools
7. Approved coach -> paid tier selection -> checkout/finalization or paid_by_owner bypass
8. Pending or rejected coach -> attempt coach-only action and confirm correct block behavior
9. Create ad -> upload banner -> submit -> schedule/pay
10. Profile -> follow/message action flow

For each broken step, give me:
- file
- line or handler
- why it breaks
- whether it is client, server, contract, cache, or state-machine failure
- the exact fix

Then apply the fixes and re-verify only after you have listed all broken steps.
```

## Prompt 5: External service integration health

```text
Audit every external service actually used by this repo.

Verify:
1. Credentials and env vars referenced in code exist where required
2. Happy path is implemented end-to-end
3. Failure states are handled cleanly
4. Webhook or callback handlers exist where needed
5. The client does not assume success without checking server state

Only include services actually present in this codebase, such as:
- Stripe
- Apple IAP / Google Play billing paths
- Cloudinary or file upload path
- the current data export object-storage adapter
- auth providers
- email provider
- Expo push notifications
- Railway runtime/config dependencies

Do not include AWS unless the code explicitly references it.

Report:
confirmed working
broken
unverifiable without credentials or live environment
```

## Prompt 6: Ship-it checklist

```text
Go through the app as if you were a new user on a real device and a real network.

For every advertised feature on the landing page and in the UI, answer yes/no: does it work?
If no, what is the single blocker?

You must explicitly include these coach surfaces:
- coach upgrade
- coach onboarding routing
- organization creation
- organization join request
- approval queue
- coach agreement
- manage subscription
- create team
- create game or coach-only event
- pending/rejected coach messaging

Output a prioritized list:
P0 = feature completely broken
P1 = works but has obvious bugs
P2 = polish or UX debt

Then fix all P0 items, show the diffs, and confirm the expected working path afterward.
```

## Prompt 7: Root-cause pass

```text
Look across all bugs found in the earlier passes.

Do not patch symptoms first. Ask whether multiple failures collapse to one of these shared root causes:
1. stale /me cache after role or approval mutation
2. mismatch between client role checks and requireOnboarded
3. client reads preferences.role but ignores approval_status
4. payment flags not cleared after approval or successful checkout finalization
5. organization membership or join-request state written on the server but not reflected in client onboarding state
6. onboarding step routing depends on stale local context instead of fresh server state
7. approval flow mixes platform-admin and organization-owner logic incorrectly

If a single fix resolves multiple bugs, implement that root-cause fix and explain which bugs it closes.
Show the "one fix that resolves N bugs" wins first.
```

## Prompt 8: VarsityHub-specific failure modes first

```text
Before doing broad exploration, test these specific failure modes first:

1. Upgrade-to-coach succeeds on the server but the client keeps stale /me state and never routes into coach onboarding
2. The client unlocks coach UI based only on preferences.role, while the server still blocks on approval_status, agreement, or payment state
3. Organization join request or coach approval writes succeed on the server, but client state is not refreshed so the user remains stuck
4. payment_pending or pending_plan are not cleared after approval, owner-paid coverage, or successful payment finalization
5. A pending or rejected coach is blocked correctly by the server, but the client shows the wrong next step or a dead-end error

Trace these first. If any are real, prioritize them over generic cleanup.
```

## Practical notes for this repo

- The critical backend coach transitions live in `server/src/routes/auth.ts`.
- The main server-side coach gate lives in `server/src/middleware/requireOnboarded.ts`.
- Organization approval and join flows live in `server/src/routes/organizations.ts`.
- Platform-admin coach approval lives in `server/src/routes/admin.ts`.
- Client approval UI and coach routes are primarily in:
  `app/settings/index.tsx`
  `app/onboarding/coach-agreement.tsx`
  `app/onboarding/step-3-league.tsx`
  `app/organization-join-requests.tsx`
  `app/(tabs)/approvals.tsx`
  `app/settings/manage-subscription.tsx`

- The biggest class of miss in this repo is passing backend correctness audits while failing real user flows. Always verify both:
  server truth
  client routing/state refresh after mutations
