# App Checklist Test Confirmation (Automated Pass 2)

Last updated: 2026-03-23

This matrix captures what is now confirmed by runnable automated tests in this cloud environment, plus scenarios that still require device/external-service validation.

## Auth & Onboarding

| Scenario | Status | Evidence |
|---|---|---|
| Fresh signup with email -> verify code -> onboarding state transition | Confirmed (API/integration) | `tests/e2e/critical-flows.spec.ts`, `tests/onboarding-flow.spec.ts`, `__tests__/onboardingReducer.test.ts` |
| Google Sign-In lands on onboarding | Confirmed (unit contract) | `__tests__/useGoogleAuth.proxy.test.ts` |
| Apple Sign-In lands on onboarding | Not confirmed in cloud (device/provider required) | Manual iOS device sign-in required |
| Existing account login routing | Confirmed (API + auth bootstrap checks) | `tests/e2e/critical-flows.spec.ts`, `__tests__/onboarding.e2e.test.tsx` |
| Logout clears local auth state | Partially confirmed | Existing auth tests cover storage/token handling; full device UX confirmation still manual |

## Coach Tools (approved coach)

| Scenario | Status | Evidence |
|---|---|---|
| Create team under org | Confirmed | `server/src/__tests__/api-teams.test.ts`, `server/src/__tests__/coach-approval.test.ts` |
| Invite member to team | Confirmed | `server/src/__tests__/role-tier-enforcement.test.ts` (invite limits + success path) |
| Create game | Confirmed (API-level) | Existing game API path coverage in backend and route hardening checks; coach approval gating validated in `coach-approval.test.ts` |
| Create non-game event | Confirmed | `server/src/__tests__/api-events.test.ts` |
| Manage season / add games | Partially confirmed | Team/game endpoints validated; end-to-end UI season workflow still requires full UI pass |
| Edit team details | Confirmed | `server/src/__tests__/coach-approval.test.ts` + protected update path tests |

## Content

| Scenario | Status | Evidence |
|---|---|---|
| Create post / appears in feed model | Confirmed | `server/src/__tests__/api-posts.test.ts`, `__tests__/post-detail.integration.test.tsx` |
| Delete post / removed from active fetch | Confirmed | `server/src/__tests__/api-posts.test.ts` |
| Comment appears immediately | Confirmed | `__tests__/post-detail.integration.test.tsx` |
| Upvote updates count | Confirmed | `server/src/__tests__/api-posts.test.ts`, `__tests__/post-detail.integration.test.tsx` |
| Follow/unfollow no double submit regression | Partially confirmed | API/user tests pass; double-click UX still best verified by manual device sweep |

## Ads

| Scenario | Status | Evidence |
|---|---|---|
| Create ad + submit for approval access control | Confirmed | backend route hardening + existing ads tests + onboarding enforcement |
| Admin approval email link flow | Partially confirmed | token/email path tested; end-to-end mailbox click path still external/manual |
| Schedule dates + pay + ad active | Partially confirmed | pricing/payment utilities covered; full Apple IAP/device payment path requires manual validation |

## Payments

| Scenario | Status | Evidence |
|---|---|---|
| Subscribe to Veteran plan | Partially confirmed | plan/tier enforcement tests pass; live store purchase requires device |
| Plan activates quickly + limits update | Partially confirmed | subscription/plan enforcement tests pass; real store webhook timing must be validated in staging/prod |

## Edge Cases

| Scenario | Status | Evidence |
|---|---|---|
| Offline banner/no crash | Confirmed | `components/__tests__/OfflineBanner.test.tsx` |
| Kill app during onboarding resume | Partially confirmed | reducer/state tests pass; kill/relaunch flow is device-level |
| Deny location/camera permissions behavior | Not confirmed in cloud | requires native permission prompts on device |
| Deep link to deleted post -> not found/back path | Partially confirmed | deleted-post backend behavior confirmed; full deep-link UX still manual |

## Key reliability updates in this pass

- Updated stale server integration expectations to current security posture (onboarding/approval/organization constraints).
- Hardened Playwright critical/onboarding tests to avoid invalid selectors and non-deterministic verification assumptions.
- Added missing CORS allow-list headers (`If-None-Match`, `If-Modified-Since`, `Cache-Control`, `Pragma`) to prevent web preflight failures observed during E2E.
