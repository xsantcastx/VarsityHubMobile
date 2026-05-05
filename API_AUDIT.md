# API Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## High

### Mobile data-export client contract points at endpoints that the real server never mounts

- Affected files:
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:185)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:204)
  - [app/settings/data-export.tsx](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/settings/data-export.tsx:147)
  - [server/src/routes/dataExport.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/dataExport.ts:75)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:307)
- Failure path:
  - The frontend calls `/me/data-export`, `/me/data-exports`, `/me/data-export/:id`, `/download`, and `DELETE`.
  - Those paths are implemented in `server/src/routes/dataExport.ts`.
  - The real app does not mount `dataExportRouter`, so the mobile screen is wired to endpoints that are not present in production.
- Expected behavior:
  - Every frontend API entity should map to a live backend route in the real Express app.
- Actual behavior:
  - The contract is valid in isolated test wiring but invalid in the production app wiring.
- Fix recommendation:
  - Mount `dataExportRouter` in `server/src/app.ts` or remove the data-export client and UI until the route is live.
  - Add a contract test that exercises the real `app.ts` route table for all `DataExport` methods.
- Verification:
  - From the real server app, request `POST /me/data-export` with auth and confirm it no longer 404s.
  - Add a frontend/backend contract test for the `DataExport` API wrapper.

### Minor parental-consent resend flow is documented and allowlisted but never mounted

- Affected files:
  - [server/src/routes/consent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/consent.ts:8)
  - [server/src/routes/consent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/consent.ts:323)
  - [server/src/middleware/requireParentalConsent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/middleware/requireParentalConsent.ts:13)
  - [server/src/middleware/requireParentalConsent.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/middleware/requireParentalConsent.ts:43)
  - [server/src/app.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/app.ts:316)
  - [server/src/testApp.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/testApp.ts:48)
- Failure path:
  - The consent route file documents `POST /me/consent/resend` and exports `handleConsentResend` for that purpose.
  - The parental-consent firewall explicitly allowlists `/me/consent/resend` so blocked minors can request a fresh parent email.
  - Neither `server/src/app.ts` nor `server/src/testApp.ts` mounts `handleConsentResend`, and the `/me` proxy only forwards to `authRouter`.
- Expected behavior:
  - The allowlisted resend path should resolve to a real handler in both the production app and the test app.
- Actual behavior:
  - The route is referenced as part of the auth/consent contract but is unreachable.
- Fix recommendation:
  - Mount `handleConsentResend` explicitly at `POST /me/consent/resend` in `server/src/app.ts` and `server/src/testApp.ts`, or remove the documented/allowlisted path until the feature is live.
  - Add a regression test that a pending-consent minor can hit `/me/consent/resend` without tripping the consent firewall.
- Verification:
  - Exercise `POST /me/consent/resend` through the real app instance with an authenticated minor in `pending` state and confirm it returns `200 { ok: true }` instead of `404`.
  - Add a route-registration test that asserts the resend handler is mounted in `app.ts`.

## Medium

### Frontend sends a `limit` param to geocoding autocomplete, but the backend contract ignores it

- Affected files:
  - [api/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/geocoding.ts:53)
  - [api/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/geocoding.ts:66)
  - [server/src/routes/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/geocoding.ts:58)
  - [server/src/routes/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/geocoding.ts:66)
  - [server/src/routes/geocoding.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/geocoding.ts:121)
- Failure path:
  - The mobile client includes `limit=${limit}` in `/geocoding/autocomplete`.
  - The backend Zod schema for that route does not accept or use `limit`.
  - The server always returns the full upstream suggestion set and the client trims locally.
- Expected behavior:
  - The client and server should agree on whether `limit` is part of the contract.
- Actual behavior:
  - The parameter is silently ignored server-side.
- Fix recommendation:
  - Either add `limit` to the backend schema and enforce it before returning suggestions, or remove it from the client request and document client-side slicing as the intended behavior.
- Verification:
  - Add a contract test asserting that a `limit` request changes the server response length, or remove the param from the client and update tests accordingly.

### Organization coach-approval client wrapper sends `note`, but the backend only reads `team_id`

- Affected files:
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:636)
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:3983)
  - [app/(tabs)/organization.tsx](</Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/(tabs)/organization.tsx:300>)
- Failure path:
  - The mobile API wrapper defines `Organization.approveCoach(organizationId, userId, note?)` and sends `{ note }`.
  - The backend approval route only reads `team_id` from the request body and ignores any `note` field.
  - Any client code expecting an approval note to be recorded gets a silent no-op, while there is also no typed client path to assign a coach to a team through this endpoint.
- Expected behavior:
  - The client wrapper and backend route should agree on the request body for coach approval.
- Actual behavior:
  - The wrapper advertises one payload shape and the server consumes a different one.
- Fix recommendation:
  - Decide whether coach approval supports `note`, `team_id`, or both.
  - Align the client wrapper, route schema, and UI to the same payload contract with Zod validation.
- Verification:
  - Add a contract test for `POST /organizations/:id/coaches/:userId/approve` that asserts the accepted request shape and resulting side effects.

### Organization coach-rejection route accepts unvalidated freeform `reason` while adjacent rejection flow is schema-bound

- Affected files:
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:4176)
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:4212)
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:4269)
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:2746)
  - [server/src/routes/organizations.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/organizations.ts:2758)
  - [api/entities.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/api/entities.ts:641)
- Failure path:
  - `POST /organizations/:id/coaches/:userId/reject` reads `req.body?.reason` directly with no schema parse or length bound.
  - That reason is then written into persistent state and fanned out into email, push, and in-app notification payloads.
  - A nearby, closely related rejection path, `POST /organizations/join-requests/:requestId/deny`, already enforces `reason: z.string().max(500).optional()`.
- Expected behavior:
  - Rejection flows in the same domain should share a bounded, validated reason contract before persisting or broadcasting reviewer text.
- Actual behavior:
  - Coach rejection is looser than join-request denial and can accept arbitrarily large or malformed input.
- Fix recommendation:
  - Add a Zod schema for coach rejection payloads and reuse the same `reason` bound as the join-request denial path unless product explicitly wants different limits.
  - Normalize the rejection contract across owner/admin review flows.
- Verification:
  - Add request-validation tests that reject oversized or non-string `reason` payloads on coach rejection.
