# Release Runbook

Use this before every App Store submission and after every push to `main`.

## Pre-Deploy Gate

Run locally before pushing:

```bash
npm run typecheck
npm run verify:secrets
npm run verify:build
cd server && npx tsc -p . --noEmit
cd server && npm test -- --runTestsByPath src/__tests__/organization-data-access-invariants.test.ts --maxWorkers=2
```

Pass criteria:

- no type errors
- no secret scan failures
- build verification passes
- targeted server invariants pass

## Push Discipline

Rules:

- only commit scoped changes
- check staged files before commit
- check commit contents before push

Commands:

```bash
git status --short
git diff --cached --name-only
git show --stat --name-only -1
git push origin main
```

## Post-Deploy Railway Check

Confirm Railway built and deployed the new server:

```bash
railway logs --latest --build --lines 80
railway logs --latest --deployment --lines 80
```

Pass criteria:

- build successful
- container started
- migrations completed cleanly
- no startup crash

## Production Health Check

```bash
BASE_URL=https://api-production-8ac3.up.railway.app npm --prefix server run verify:production-health
```

Pass criteria:

- `Production health verification passed.`

## Production Auth Canary

Use a dedicated canary account, not the App Review demo account if possible:

```bash
BASE_URL=https://api-production-8ac3.up.railway.app \
AUTH_CANARY_EMAIL=... \
AUTH_CANARY_PASSWORD=... \
npm --prefix server run verify:auth-canary
```

Pass criteria:

- login passes
- `/auth/me` passes
- refresh passes
- old refresh rejected
- logout passes
- logged-out refresh rejected
- relogin passes

## Coach / Organizer Route Battery

Use an approved coach or organizer account that has a real organization context.

```bash
BASE_URL=https://api-production-8ac3.up.railway.app \
COACH_ROUTE_BATTERY_EMAIL=... \
COACH_ROUTE_BATTERY_PASSWORD=... \
npm --prefix server run verify:coach-route-battery
```

The route battery checks:

- `/auth/me`
- `/events/pending`
- `/events/my-events`
- `/teams/managed`
- `/organizations/invites/me`
- `/organizations/join-requests/me`
- `/organizations/:orgId/members`
- `/organizations/:orgId/admin-summary`
- `/organizations/:orgId/pending-coaches`
- `/organizations/:orgId/join-requests`

Pass criteria:

- `/auth/me` shows approved coach state
- no required organizer route returns `500`
- org-backed routes return `200`

## Reviewer Demo Account Check

Do this sparingly to avoid rate limits.

Prepare the review account explicitly when needed:

```bash
APP_REVIEW_PASSWORD='...' npm --prefix server run prepare:app-review
```

What to verify:

- login succeeds
- `/auth/me` says:
  - `role=coach`
  - `approval_status=APPROVED`
  - no legacy blocked `account_state`
  - `next_step` is empty or `/(tabs)`
  - `email_verified=true`
  - `onboarding_completed=true`
- `organization_id` present
- `proceeding_as_fan=false`

Automated check:

```bash
BASE_URL=https://api-production-8ac3.up.railway.app \
APP_REVIEW_PASSWORD='...' \
npm --prefix server run verify:app-review
```

Run this against:

- a normal approved coach account
- an approved coach account that still lacks an agreement signature

Both should pass. If the second account fails, approval-only access has regressed.

## Failure Triage

If a route fails:

```bash
railway logs --http --path /failing/path --status 500 --since 15m --lines 20 --json
railway logs --since 20m --lines 200 --filter "requestId-or-error-fragment"
```

Look for:

- Postgres type/operator mismatch
- missing env/config
- auth middleware rejection
- null/undefined data assumptions

## App Review Submission Gate

Before submitting, confirm:

- demo reviewer credentials still work
- approved coach tools are reachable
- verification flows work
- account deletion works for password and OAuth users
- iOS subscription purchase and restore were tested recently
- support, privacy, terms, and report-abuse screens load

## Account Separation Policy

Keep three separate accounts:

- `reviewer` account: only for App Review and final manual checks
- `canary` account: for automated auth verification
- `uat` coach accounts: for repeated production route testing

Do not repeatedly hammer the reviewer account or you will rate-limit yourself at the worst time.

## Hard Fail Conditions

Do not submit if any of these are true:

- reviewer login fails
- reviewer `/auth/me` is not approved coach state
- any organizer read route returns `500`
- coach tools depend on stale client cache to appear
- payment or verification flows are untested after a meaningful auth or server change
