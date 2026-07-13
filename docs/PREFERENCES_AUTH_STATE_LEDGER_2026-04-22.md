# Preferences Auth-State Ledger

Scope: Stream 3 auth/onboarding hoist from `User.preferences` into first-class `User` columns.

Tracked keys in this pass:

- `role`
- `onboarding_completed`
- `organization_id`
- `organization_name` (stays JSON for now; ledgered because it travels with `organization_id`)
- `proceeding_as_fan`
- `coach_agreement_accepted_at`
- `coach_agreement_version`

## Production Read/Write Ledger

| File                                        | Lines     | Mode       | Keys                                                                                                                             | Caller purpose                                                                       |
| ------------------------------------------- | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `server/src/routes/auth.ts`                 | 301-380   | write      | `role`, `onboarding_completed`                                                                                                   | Email/password registration seeds initial auth state in JSON.                        |
| `server/src/routes/auth.ts`                 | 516-523   | read       | `onboarding_completed`                                                                                                           | Login response computes `needs_onboarding`.                                          |
| `server/src/routes/auth.ts`                 | 887-918   | write      | `role`, `onboarding_completed`                                                                                                   | Google OAuth link/create backfills missing onboarding defaults.                      |
| `server/src/routes/auth.ts`                 | 940-963   | read       | `onboarding_completed`                                                                                                           | Google OAuth response computes `needs_onboarding`.                                   |
| `server/src/routes/auth.ts`                 | 1075-1109 | write      | `role`, `onboarding_completed`                                                                                                   | Apple OAuth link/create backfills missing onboarding defaults.                       |
| `server/src/routes/auth.ts`                 | 1146-1169 | read       | `onboarding_completed`                                                                                                           | Apple OAuth response computes `needs_onboarding`.                                    |
| `server/src/routes/auth.ts`                 | 1392-1457 | read/write | `role`, `onboarding_completed`                                                                                                   | `/auth/upgrade-to-coach` flips fan → coach and restarts onboarding.                  |
| `server/src/routes/auth.ts`                 | 1514-1558 | read/write | `role`, `onboarding_completed`                                                                                                   | `/auth/coach/reapply` validates coach state and reopens onboarding.                  |
| `server/src/routes/auth.ts`                 | 1604-1628 | read       | `role`, `onboarding_completed`                                                                                                   | `GET /auth/me` normalizes top-level role and ships preferences payload.              |
| `server/src/routes/auth.ts`                 | 1908-2148 | read/write | `role`, `onboarding_completed`, `organization_id`, `proceeding_as_fan`, `coach_agreement_accepted_at`, `coach_agreement_version` | `PATCH /auth/me/preferences` is the main ad hoc writer and policy gate.              |
| `server/src/routes/auth.ts`                 | 2286-2492 | read/write | `role`, `onboarding_completed`, `organization_id`, `organization_name`, `proceeding_as_fan`                                      | `POST /auth/me/complete-onboarding` finalizes onboarding state.                      |
| `server/src/routes/auth.ts`                 | 2684-2721 | read       | `role`, `onboarding_completed`, `organization_id`, `proceeding_as_fan`, `coach_agreement_*`                                      | `sanitizeUser()` shapes API payloads and preserves legacy preferences compatibility. |
| `server/src/middleware/requireOnboarded.ts` | 11-39     | read/write | `role`, `onboarding_completed`                                                                                                   | Fan auto-heal path repairs stuck onboarding state.                                   |
| `server/src/middleware/requireOnboarded.ts` | 111-198   | read       | `role`, `onboarding_completed`, `organization_id`, `coach_agreement_accepted_at`, `coach_agreement_version`                      | Highest-traffic guard for onboarded-only and coach-only mutations.                   |
| `server/src/lib/approvalService.ts`         | 71-104    | write      | `role`, `organization_id`, `organization_name`, `proceeding_as_fan`                                                              | Shared approval helpers build next auth-state JSON snapshots.                        |
| `server/src/lib/approvalService.ts`         | 160-168   | write      | `role`, `organization_id`, `organization_name`, `proceeding_as_fan`                                                              | League approval upgrades owner into approved coach state.                            |
| `server/src/lib/approvalService.ts`         | 354-361   | write      | `role`, `proceeding_as_fan`                                                                                                      | Coach approval clears pending/paid flags and enables coach access.                   |
| `server/src/lib/approvalService.ts`         | 460-467   | write      | `role`                                                                                                                           | Coach rejection preserves coach identity while stripping org/team progress.          |
| `server/src/routes/organizations.ts`        | 66-120    | write      | `role`, `organization_id`, `organization_name`, `proceeding_as_fan`                                                              | Local org-route helpers build pending/approved/rejected coach preference shapes.     |
| `server/src/routes/organizations.ts`        | 574-659   | read/write | `role`, `organization_id`, `organization_name`                                                                                   | Org creation flow requires coach role and attaches pending org ownership.            |
| `server/src/routes/organizations.ts`        | 764-845   | read/write | `role`, `organization_id`, `organization_name`                                                                                   | Alternate org creation path mirrors the same pending-coach transition.               |
| `server/src/routes/organizations.ts`        | 1406-1443 | read/write | `role`, `organization_id`, `organization_name`                                                                                   | Join-request creation requires coach role and stores pending org linkage.            |
| `server/src/routes/organizations.ts`        | 1691-1699 | write      | `role`, `organization_id`, `organization_name`, `proceeding_as_fan`                                                              | League owner approves coach join request.                                            |
| `server/src/routes/organizations.ts`        | 1844-1851 | write      | `role`, `organization_id`, `organization_name`                                                                                   | League owner rejects coach join request.                                             |
| `server/src/routes/organizations.ts`        | 2372-2380 | write      | `role`, `organization_id`, `organization_name`, `proceeding_as_fan`                                                              | Admin approve path for coach requests into org/team.                                 |
| `server/src/routes/organizations.ts`        | 2514-2521 | write      | `role`, `organization_id`, `organization_name`                                                                                   | Admin reject path for coach requests.                                                |
| `server/src/routes/admin.ts`                | 132-152   | read       | `role`                                                                                                                           | Pending-coach dashboard query still filters on JSON role.                            |
| `server/src/routes/payments.ts`             | 219-227   | read       | `role`                                                                                                                           | Membership checkout blocks unapproved coaches.                                       |
| `server/src/routes/payments.ts`             | 780-788   | read       | `role`                                                                                                                           | Ad checkout blocks unapproved coaches.                                               |
| `server/src/index.ts`                       | 149-193   | write      | `role`, `onboarding_completed`                                                                                                   | Demo-account bootstrap seeds auth state directly.                                    |
| `server/prisma/seed.ts`                     | 15-65     | write      | `role`, `onboarding_completed`                                                                                                   | Local seed data creates fan/coach fixtures using legacy JSON.                        |

## Test / Fixture Compatibility Sites

These are not production request paths, but they still matter during the dual-write window because they create users that production middleware reads. They should remain valid through JSON fallback until a later cleanup pass updates them.

| File(s)                                                   | Mode       | Notes                                                                          |
| --------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `server/src/__tests__/access-matrix.test.ts`              | read/write | Builds role/onboarding/agreement fixture matrices.                             |
| `server/src/__tests__/coach-approval.test.ts`             | read/write | Heavy fixture coverage for coach/org approval transitions.                     |
| `server/src/__tests__/coach-agreement-versioning.test.ts` | read/write | Pins `coach_agreement_*` behavior.                                             |
| `server/src/__tests__/coach-upgrade-e2e.test.ts`          | read/write | Security-critical `/auth/upgrade-to-coach` regression coverage.                |
| `server/src/__tests__/critical-flows.test.ts`             | read/write | Legacy JSON fixture coverage; currently blocked by separate Jest loader issue. |
| `server/src/__tests__/event-creation.test.ts`             | read/write | Uses coach role + agreement fixtures.                                          |
| `server/src/__tests__/game-approval.test.ts`              | read/write | Uses coach/fan role fixtures for approval gating.                              |
| `server/src/__tests__/minors-foundation.test.ts`          | read/write | Uses fan onboarding fixtures; currently blocked by separate Jest loader issue. |
| `server/src/__tests__/payments-finalization.test.ts`      | read/write | Uses coach billing/onboarding fixture state.                                   |
| `server/src/__tests__/api-teams.test.ts`                  | read/write | Uses coach role/org linkage fixtures.                                          |

## Migration Notes

- `approval_status` is intentionally excluded from this hoist because it is already a first-class column and must stay that way.
- `organization_name` remains JSON-only in Stream 3. It is coupled to `organization_id` operationally, so readers/writers touching org linkage are listed here.
- Production-safe cutover requires:
  - new columns populated from JSON via backfill
  - readers switched to columns-first with JSON fallback
  - writers dual-writing both columns and JSON
  - JSON cleanup deferred to a later migration after verification
