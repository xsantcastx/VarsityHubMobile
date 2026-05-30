# Final Launch Sequence

This file is now a compatibility pointer. The canonical ordered release flow lives in [RELEASE_WORKFLOW.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/RELEASE_WORKFLOW.md).

Use this condensed sequence for the last mile only:

1. `npm run release:verify:local`
2. `npm run release:verify:build`
3. `BASE_URL="https://your-api" npm run release:verify:runtime`
4. Complete [COACH_DEVICE_UAT.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/COACH_DEVICE_UAT.md)
5. Complete [LAUNCH_READINESS_GATE.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/LAUNCH_READINESS_GATE.md)

Supporting appendices:

- [PENDING_OPERATOR_ACTIONS.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/PENDING_OPERATOR_ACTIONS.md)
- [EMAIL_GO_LIVE_CHECKLIST.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/EMAIL_GO_LIVE_CHECKLIST.md)
