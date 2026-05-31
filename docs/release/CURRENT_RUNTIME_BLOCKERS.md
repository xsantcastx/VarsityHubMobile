# Current Runtime Blockers

Snapshot date: `2026-05-31`

This is the current no-go list from the latest runtime/provider verification pass. Use it with:

- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md)
- [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md)
- [EMAIL_GO_LIVE_CHECKLIST.md](./EMAIL_GO_LIVE_CHECKLIST.md)

## Current release status

- Phase 1 code gates are green.
- `npm run release:verify:local` now passes lint, app/server typecheck, guardrails, pre-release drift audit, release-readiness audit, regression suites, Expo doctor, and coach UAT baseline until it reaches the email provider gate.
- Runtime/provider readiness is still `NO-GO`.
- The remaining blockers are operator-side, not app-code regressions.

## Blocking findings

1. `release:verify:runtime` is only valid when run with `HEALTH_CHECK_SECRET`.
   Evidence: without the secret, `verify:production-health` falls back to public-only checks and does not fully verify `cloudinary`, `sendgrid`, `redis`, `appleIAP`, or other protected integrations.

2. `SENDGRID_API_KEY` is still a placeholder.
   Evidence: `npm --prefix server run verify:email-go-live` reported `SendGrid API key status: placeholder`.

3. Real SendGrid sends are currently unauthorized.
   Evidence: during `npm run release:verify:local`, the coach UAT baseline triggered a real verification-email path and SendGrid returned:
   - HTTP `401`
   - `The provided authorization grant is invalid, expired, or revoked`

4. SendGrid template coverage is materially incomplete.
   Evidence from the same verifier:
   - canonical template envs referenced by code: `45`
   - template groups referenced by code: `42`
   - template groups currently satisfied in shell: `8`

5. Three tracked SendGrid template IDs are stale and must be recreated before launch.
   Evidence:
   - `SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID`
   - `SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID`
   - `SENDGRID_TEAM_INVITE_TEMPLATE_ID`

6. Cloudinary and production-health verification still need authenticated operator confirmation in the real runtime gate.
   Required proof:
   - `BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime`
   - no health-check failures for protected integrations

## Immediate operator actions

1. Replace `SENDGRID_API_KEY` in Railway with a real production key that does not return `401 invalid grant`.
2. Recreate and publish the three stale SendGrid templates above.
3. Apply the missing `SENDGRID_*_TEMPLATE_ID` values printed by `npm --prefix server run verify:email-go-live`.
4. Re-run:
   - `npm --prefix server run verify:email-go-live`
   - `npm --prefix server run verify:email`
   - `npx tsx server/scripts/email-delivery-test.ts`
5. Re-run `npm run release:verify:local` to confirm the local release workflow is fully green after SendGrid is fixed.
6. Run the real runtime gate with both `BASE_URL` and `HEALTH_CHECK_SECRET`.

## Exit criteria

- `BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime` exits `0`
- `npm --prefix server run verify:email-go-live` exits `0`
- `npm --prefix server run verify:email` exits `0`
- one controlled verification email is delivered successfully
- one non-trivial production-style email flow is delivered successfully
