# Contract Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## Medium

### Test server omits the canonical `/me` alias and the production `/v1` route bundle

- Affected files:
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:316)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:349)
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:1)
  - [api/README.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/README.md:32)
  - [api/auth.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/auth.ts:306)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:56)
- Failure path:
  - The production app exposes `/me` through `meProxy` and mounts the same API bundle again under `/v1`.
  - The client API layer and repo docs rely on `/me`, `/me/preferences`, and `/me/complete-onboarding`.
  - `server/src/testApp.ts` mounts only `/auth` and never exposes `/me` or `/v1`.
- Expected behavior:
  - The main test app should expose the same canonical auth/status and versioned API surfaces as production when those are part of the client contract.
- Actual behavior:
  - Tests run against a reduced route surface that does not match the documented client contract.
- Fix recommendation:
  - Mirror the production `/me` alias and `/v1` bundle in `testApp.ts`, or stop using `testApp.ts` as the default surface for contract-sensitive tests.
- Verification:
  - Add route-surface tests asserting `/me` and `/v1` are mounted anywhere the repo treats as a contract-bearing app instance.

### Critical flow and auth tests exercise `/auth/me*` aliases instead of the client-facing `/me*` paths

- Affected files:
  - [server/src/**tests**/critical-flows.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/critical-flows.test.ts:261)
  - [server/src/**tests**/critical-flows.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/critical-flows.test.ts:298)
  - [server/src/**tests**/api-auth.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/api-auth.test.ts:583)
  - [server/src/**tests**/coach-agreement-versioning.test.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/coach-agreement-versioning.test.ts:62)
  - [api/auth.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/auth.ts:306)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:60)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:64)
- Failure path:
  - The mobile client uses `/me`, `/me/preferences`, and `/me/complete-onboarding`.
  - Several auth and “critical flow” tests instead hit `/auth/me`, `/auth/me/preferences`, and `/auth/me/complete-onboarding`.
  - A regression in the `/me` alias path can therefore escape the tests that are supposed to represent the real client flow.
- Expected behavior:
  - Flow and contract tests should hit the same paths the shipped client uses unless they are explicitly testing alias compatibility.
- Actual behavior:
  - The suite validates a neighboring alias, not the canonical mobile contract.
- Fix recommendation:
  - Convert the main flow/contract tests to exercise `/me*`, then keep a smaller explicit alias-compatibility test for `/auth/me*` if backward compatibility still matters.
- Verification:
  - Update the affected tests to call `/me*` and confirm they still pass through the real app surface.
