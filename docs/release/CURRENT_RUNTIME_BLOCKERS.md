# Current Runtime Blockers

Snapshot date: `2026-06-08`

Use this with:

- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md)
- [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md)
- [EMAIL_GO_LIVE_CHECKLIST.md](./EMAIL_GO_LIVE_CHECKLIST.md)

## Current release status

- `npm run release:verify:local` is green.
- `npm --prefix server run verify:org-manager-access` is green.
- `npm --prefix server run verify:email-go-live` is green.
- `npm --prefix server run verify:email` is green.
- No current repo-side SendGrid config drift is being reported by the live verifiers.

## Remaining runtime blockers

1. `release:verify:runtime` still needs a real `HEALTH_CHECK_SECRET`.
   Evidence: without it, production health falls back to public-only checks and does not fully verify protected integrations.

2. Real outbound email delivery still needs proof against a controlled inbox.
   Evidence: config and template verification are green, but no live send confirmation was run in this pass.

3. Production runtime readiness is still pending one authenticated provider pass.
   Evidence: `BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime` has not been completed as part of this repo pass.

## Immediate operator actions

1. Run:
   - `BASE_URL="https://api-production-8ac3.up.railway.app" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime`
2. Run:
   - `npx tsx server/scripts/email-delivery-test.ts`
3. Confirm Railway production logs show no SendGrid `401`, `403`, or `template_id must be a valid GUID` errors during the live send.

## Exit criteria

- `npm run release:verify:local` exits `0`
- `npm --prefix server run verify:email-go-live` exits `0`
- `npm --prefix server run verify:email` exits `0`
- `BASE_URL="https://your-api" HEALTH_CHECK_SECRET="..." npm run release:verify:runtime` exits `0`
- one controlled verification email is delivered successfully
- one non-trivial production-style email flow is delivered successfully
