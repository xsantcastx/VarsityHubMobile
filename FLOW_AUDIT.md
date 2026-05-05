# Flow Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## High

### Minor signup and consent recovery flow has a documented resend path that is not actually reachable

- Affected files:
  - [server/src/routes/consent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/consent.ts:8)
  - [server/src/routes/consent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/consent.ts:323)
  - [server/src/middleware/requireParentalConsent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/middleware/requireParentalConsent.ts:43)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:316)
- Failure path:
  - A 13–17 user can enter the pending parental-consent state during signup/onboarding.
  - The codebase documents `POST /me/consent/resend` as the recovery path and explicitly allowlists it through the consent firewall.
  - The handler is exported but never mounted, so the recovery step in that flow does not exist at runtime.
- Expected behavior:
  - The consent recovery path should be live anywhere the flow and middleware say it is.
- Actual behavior:
  - The flow contains a dead-end branch.
- Fix recommendation:
  - Mount `handleConsentResend` on the real app surface and add a behavior test for the pending-minor recovery path.
- Verification:
  - Reproduce the flow with a pending-consent minor and confirm `/me/consent/resend` returns `200` instead of `404`.

## Medium

### Public verification and reset handoff flow is only protected by static source tests, not runtime behavior tests

- Affected files:
  - [server/src/**tests**/public-app-handoff-routes.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/public-app-handoff-routes.test.ts:1)
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:245)
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:293)
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:346)
- Failure path:
  - The repo has tests for the public handoff routes, but they assert source text with `readFileSync(...).toContain(...)`.
  - Those tests do not execute `/verify`, `/verify/resend`, or `/reset-password` against an app instance.
  - Runtime failures in validation, rendering, or async error propagation can therefore slip through while the tests still pass.
- Expected behavior:
  - Flow-critical browser handoff routes should have behavior tests, not only source-shape tests.
- Actual behavior:
  - The coverage is static and structural, not end-to-end.
- Fix recommendation:
  - Add supertest coverage for valid, expired, and invalid handoff routes plus resend behavior.
- Verification:
  - Break a runtime dependency intentionally and confirm a behavior test fails.

### Signup/onboarding smoke tests validate `/auth/me*` aliases instead of the client’s `/me*` flow

- Affected files:
  - [server/src/**tests**/critical-flows.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/critical-flows.test.ts:261)
  - [server/src/**tests**/critical-flows.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/critical-flows.test.ts:298)
  - [server/src/**tests**/coach-agreement-versioning.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/coach-agreement-versioning.test.ts:62)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:60)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:64)
- Failure path:
  - The shipped client uses `/me/preferences` and `/me/complete-onboarding`.
  - The server “critical flow” tests and related auth tests use `/auth/me/preferences` and `/auth/me/complete-onboarding`.
  - Alias regressions on the actual client path can therefore ship even while onboarding tests pass.
- Expected behavior:
  - Flow smoke tests should exercise the same paths the client uses in production.
- Actual behavior:
  - The tests cover a compatibility alias rather than the real mobile flow path.
- Fix recommendation:
  - Move primary onboarding flow tests to `/me*` and keep alias checks separate if needed.
- Verification:
  - Switch the affected tests to `/me*` and ensure they still pass against the real app surface.
