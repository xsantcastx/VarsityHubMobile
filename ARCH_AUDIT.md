# Architecture Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## High

### Data export endpoints are mounted in the test app but not in the real server app

- Affected files:
  - [server/src/routes/dataExport.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/dataExport.ts:4)
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:32)
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:75)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:307)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:342)
- Failure path:
  - The GDPR data export router defines live endpoints.
  - `server/src/testApp.ts` mounts `dataExportRouter`, so tests can pass.
  - `server/src/app.ts` never mounts `dataExportRouter`, so those endpoints are unreachable in the real app.
- Expected behavior:
  - Production route registration should match the tested server surface.
- Actual behavior:
  - The production app and test app expose different route sets.
- Fix recommendation:
  - Mount `dataExportRouter` in `server/src/app.ts` in both root and `/v1` bundles, or explicitly retire the feature and remove the client/test surface.
  - Add a route-registration regression test against `server/src/app.ts`, not only `testApp.ts`.
- Verification:
  - Hit `/me/data-export` through the real app instance and confirm it resolves.
  - Add a static test that `app.ts` mounts `dataExportRouter`.

### Test harnesses do not verify the real production route table for critical exported routers

- Affected files:
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:75)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:307)
  - [server/src/**tests**/data-export-endpoints.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/data-export-endpoints.test.ts:28)
  - [server/src/**tests**/data-export-endpoints.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/data-export-endpoints.test.ts:33)
- Failure path:
  - `server/src/testApp.ts` exposes a different route surface than `server/src/app.ts`.
  - `data-export-endpoints.test.ts` mounts `dataExportRouter` onto a one-off Express app instead of exercising the real app router.
  - This let the data-export feature test green while the production server never exposed the endpoint.
- Expected behavior:
  - Critical route tests should fail when a router is not mounted in the real server app.
- Actual behavior:
  - Isolated router tests and divergent test-app wiring can validate behavior that production never serves.
- Fix recommendation:
  - Add a route-registration test against `server/src/app.ts` for every exported feature router with frontend or user-facing reachability.
  - Reserve isolated router tests for handler semantics only, and pair them with an app-surface mount assertion.
- Verification:
  - Add a failing test if `dataExportRouter` is absent from `mountApiRoutes`.
  - Audit `testApp.ts` against `app.ts` and keep the mount lists intentionally synchronized.

## Medium

### Middleware coverage test asserts tournament-route protection on code that no app mounts

- Affected files:
  - [server/src/routes/tournaments.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/tournaments.ts:44)
  - [server/src/**tests**/middleware-coverage.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/middleware-coverage.test.ts:152)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:307)
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:48)
- Failure path:
  - `middleware-coverage.test.ts` enforces middleware chains for `tournamentsRouter` mutations.
  - Neither `server/src/app.ts` nor `server/src/testApp.ts` mounts `tournamentsRouter`.
  - The test therefore passes on unreachable code and overstates actual production coverage.
- Expected behavior:
  - Middleware coverage tests should only assert routes that are reachable from the shipped app surface, or separately assert mount status.
- Actual behavior:
  - The suite treats dead or unmounted routes as covered critical endpoints.
- Fix recommendation:
  - Either mount `tournamentsRouter` intentionally, or remove it from critical-route coverage until the feature is live.
  - Add a companion mount assertion so coverage claims cannot pass for unreachable routers.
- Verification:
  - Add a static test that every file referenced by `middleware-coverage.test.ts` is mounted by `app.ts` or explicitly marked dead code.
