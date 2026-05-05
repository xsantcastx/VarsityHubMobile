# API Audit

No open findings remain from this audit pass.

Resolved in this branch:

- Production app now mounts the data export surface in [`server/src/app.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:1), with matching coverage in [`server/src/testApp.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:1) and [`server/src/__tests__/app-route-surface.test.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/app-route-surface.test.ts:1).
- `POST /me/consent/resend` is mounted on the real and test app surfaces and covered by [`server/src/__tests__/parental-consent-verify-allowlist.test.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/parental-consent-verify-allowlist.test.ts:1).
- `/geocoding/autocomplete` now honors the existing `limit` contract and is covered by [`server/src/__tests__/geocoding-contracts.test.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/__tests__/geocoding-contracts.test.ts:1).
- Organization coach approval and rejection payloads are schema-validated in [`server/src/routes/organizations.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:1).
