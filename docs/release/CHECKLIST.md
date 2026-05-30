# Release Checklist

Use this as the short gate card. The canonical ordered process now lives in [RELEASE_WORKFLOW.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/RELEASE_WORKFLOW.md).

## Required order

1. Run `npm run release:verify:local`
2. Run `npm run release:verify:build`
3. Run `BASE_URL="https://your-api" npm run release:verify:runtime`
4. Complete device UAT
5. Fill `LAUNCH_READINESS_GATE.md`

## Blocking checks

- [ ] `release:verify:local` passed
- [ ] `release:verify:build` passed
- [ ] `release:verify:runtime` passed
- [ ] Device UAT signed off
- [ ] Final GO/NO-GO gate signed with owner and evidence

## Use these appendices only when that phase is active

- Phase 1: [../PR_CHECKLIST.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/PR_CHECKLIST.md)
- Phase 3: [PENDING_OPERATOR_ACTIONS.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/PENDING_OPERATOR_ACTIONS.md)
- Phase 3 email: [EMAIL_GO_LIVE_CHECKLIST.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/EMAIL_GO_LIVE_CHECKLIST.md)
- Phase 5 sign-off: [LAUNCH_READINESS_GATE.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/LAUNCH_READINESS_GATE.md)
