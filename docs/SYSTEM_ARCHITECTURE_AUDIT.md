# System Architecture Audit

Date: 2026-04-10

Scope:
- Authentication and email-triggered flows
- Payments and subscription enforcement
- Team and organization creation flows
- Deep links and invite handling
- Authorization and data exposure on shared endpoints

Method:
1. Map frontend -> backend -> persistence for critical flows.
2. Compare validation and permission checks across route variants.
3. Look for route drift, missing server endpoints, and deep-link mismatches.
4. Classify findings by impact on security, integrity, and operability.

## System Map

### Auth and email flows
- Frontend auth screens live under `app/` and call `src/api/auth.ts` / `src/api/entities.ts`.
- Backend auth flows are handled in `server/src/routes/auth.ts`.
- Email delivery is centralized through `server/src/lib/email.ts` and `server/src/services/email/*`.
- Password reset is code-based, not link-token based.

### Payments and subscriptions
- Frontend plan selection and billing flows call `httpPost('/payments/...')` through `src/api/entities.ts`.
- Backend payment orchestration is in `server/src/routes/payments.ts`.
- Subscription state is partly persisted in `user.preferences`.
- Team creation gates also read plan/subscription state in `server/src/routes/teams.ts`.

### Teams and organizations
- Team creation has two server entry points:
  - `POST /teams`
  - `POST /teams/create`
- Organization creation is handled in `server/src/routes/organizations.ts`.
- Frontend team creation uses `Team.create()` which calls `POST /teams/create`.

### Deep links and invites
- App-level link handling is implemented in `src/utils/deepLinks.ts` and wired from `app/_layout.tsx`.
- Invite emails generate app links from `server/src/lib/email.ts`.
- Payment success also relies on app-scheme redirects generated in `server/src/routes/payments.ts`.

## Findings

### CRITICAL: Public endpoint exposes all team-member emails across the system

Impact:
- Any unauthenticated caller can enumerate team membership records and user emails.
- This is a direct privacy leak and expands the attack surface for scraping and targeted abuse.

Evidence:
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L320) defines `GET /teams/members/all` with no auth or admin guard.
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L333) returns `user.email` for each membership.

Why it happened:
- The code comment says the endpoint is "for admin screens", but the route is not actually protected.

Recommended fix:
- Add `requireAuth` plus an admin-only guard.
- Remove email from the response unless it is strictly required.
- Add a regression test proving unauthenticated and non-admin requests are rejected.

### HIGH: Payment upgrade flows call a server endpoint that does not exist

Impact:
- Web and fallback billing flows can never succeed on the paths that call `/payments/create-payment-sheet`.
- Users can be pushed into dead-end upgrade flows depending on platform and screen.

Evidence:
- [`app/(tabs)/create-team.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/(tabs)/create-team.tsx#L415) posts to `/payments/create-payment-sheet`.
- [`app/subscription-paywall.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/subscription-paywall.tsx#L190) posts to the same endpoint.
- [`app/settings/manage-subscription.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/settings/manage-subscription.tsx#L153) posts to the same endpoint.
- [`app/ad-calendar.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/ad-calendar.tsx#L600) posts to the same endpoint.
- The payments router exposes `/checkout`, `/update-subscription-quantity`, `/subscription/summary`, and `/finalize-session`, but no `create-payment-sheet` route in [`server/src/routes/payments.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/payments.ts).

Why it happened:
- The frontend has at least two payment architectures mixed together: Stripe Checkout and a PaymentSheet flow.

Recommended fix:
- Pick one supported contract per platform.
- Either implement `/payments/create-payment-sheet` end to end, or remove these callers and use the existing `/payments/checkout` flow consistently.
- Add an API contract test for every payment entry point used by the app.

### HIGH: Veteran team expansion flow is logically blocked by a client/server mismatch

Impact:
- Veteran users can be asked to pay for an extra team, but the server rejects the quantity update before the team exists.
- This creates a broken paid path and can strand users between billing and team creation.

Evidence:
- [`app/(tabs)/create-team.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/(tabs)/create-team.tsx#L511) computes `newTeamCount = teamCount + 1`.
- [`app/(tabs)/create-team.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/(tabs)/create-team.tsx#L524) sends that future count to `/payments/update-subscription-quantity` before creating the team.
- [`server/src/routes/payments.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/payments.ts#L835) rejects the request unless `team_count === actualTeamCount`.

Why it happened:
- The frontend treats the endpoint as "reserve capacity for the next team".
- The backend enforces it as "only pay for teams that already exist".

Recommended fix:
- Decide on one invariant:
  - Pre-authorize capacity before team creation, or
  - Create the team in a pending state and bill immediately after.
- Keep billing and team creation inside a single explicit workflow contract.
- Add a test covering `veteran -> add team -> update quantity -> create team`.

### HIGH: Invite links and app deep-link handling are not wired to real invite routes

Impact:
- Team and organization invite emails can send users into non-resolvable app routes.
- Invite acceptance relies on a manual in-app screen instead of the invite token that email actually contains.

Evidence:
- [`server/src/lib/email.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/lib/email.ts#L793) generates `varsityhubmobile://invites/{token}` for team invites.
- [`server/src/lib/email.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/lib/email.ts#L935) generates the same pattern for organization invites.
- [`src/utils/deepLinks.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/src/utils/deepLinks.ts#L44) has no `invites` route mapping.
- [`app/team-invites.tsx`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/app/team-invites.tsx#L17) only renders the current user's pending invites list; it does not consume an invite token from the deep link.

Why it happened:
- Email URL generation and app routing evolved independently.

Recommended fix:
- Add a real invite-token route in Expo Router, or change email links to a supported route.
- Extend the deep-link parser to support query-based routes and invite tokens.
- Add tests for email invite links opening the correct screen with a token.

### MEDIUM: Duplicate team creation endpoints enforce different business rules

Impact:
- Behavior depends on which endpoint a caller uses.
- Security, plan limits, and organization-association rules are not defined in one place.
- This increases drift risk and makes future fixes easy to apply to only one path.

Evidence:
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L351) defines basic `POST /teams`.
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L392) uses `max_teams` fallback logic and creates a team without any organization handling.
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L649) defines enhanced `POST /teams/create`.
- [`server/src/routes/teams.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/teams.ts#L772) auto-associates or creates an organization.
- [`src/api/entities.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/src/api/entities.ts#L579) routes primary frontend creation through `/teams/create`, while [`src/api/entities.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/src/api/entities.ts#L581) still exposes `createBasic()` for `/teams`.

Why it happened:
- A safer onboarding-oriented path was added without retiring or aligning the older route.

Recommended fix:
- Collapse to a single team-creation service on the backend.
- Keep one public route contract and make all clients use it.
- If the basic route must remain, wrap it around the same shared validator/service.

### MEDIUM: Deep-link parser is narrower than the URLs the app and backend generate

Impact:
- Route handling is brittle for query-param links and one-segment routes.
- Payment success, reset-password, and invite links depend on routing behavior that is not consistently modeled in one place.

Evidence:
- [`src/utils/deepLinks.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/src/utils/deepLinks.ts#L96) rejects scheme links with fewer than two path parts.
- [`src/utils/deepLinks.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/src/utils/deepLinks.ts#L163) rejects path links with fewer than two parts.
- Payment success URLs generated by [`server/src/routes/payments.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/payments.ts#L250) and [`server/src/routes/payments.ts`](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/payments.ts#L439) are query-based one-segment routes.

Why it happened:
- Custom parsing logic assumes content-detail links (`type/id`) while the app now also uses action routes (`payment-success`, `reset-password`, `verify`).

Recommended fix:
- Model deep links as explicit route contracts, not a generic `type/id` parser.
- Add test cases for `payment-success`, `reset-password`, `verify`, and invite-token links.

## Architectural Inconsistencies

- `app/` still contains many stateful, feature-heavy screens instead of staying thin route wrappers.
- Payments use mixed concepts: Stripe Checkout, PaymentSheet, IAP, and manual preference reconciliation.
- Team, org, invite, and subscription rules are implemented in routes instead of shared domain services.
- Some route comments describe stronger protections than the code actually enforces.

## Recommended Remediation Order

1. Lock down `GET /teams/members/all`.
2. Unify the payment contract and remove dead frontend calls to `/payments/create-payment-sheet` unless the endpoint is intentionally restored.
3. Repair the Veteran quantity-update workflow so billing and team creation agree on state transitions.
4. Make invite links resolve to a real route that can consume an invite token.
5. Consolidate team creation into a single backend service and retire the divergent basic route.
6. Add integration tests for the critical flows above.

## Validation Gaps

Not fully validated in this audit:
- Live Stripe / IAP execution
- Full Expo deep-link runtime behavior on device
- End-to-end email clickthrough on iOS and Android

Manual tests recommended:
- Anonymous request to `/teams/members/all` returns `401/403`.
- Rookie, Veteran, and Legend team creation behave correctly from the UI.
- Payment success deep links open the intended screen with parameters intact.
- Team and organization invite emails open the app and allow acceptance.
