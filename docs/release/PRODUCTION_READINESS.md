# Production Readiness

This document is now historical context.

Use [RELEASE_WORKFLOW.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/RELEASE_WORKFLOW.md) for the live release order:

1. `npm run release:verify:local`
2. `npm run release:verify:build`
3. `BASE_URL="https://your-api" npm run release:verify:runtime`
4. Device UAT
5. `LAUNCH_READINESS_GATE.md`

Build-only checks remain owned by `npm run verify:build`.
