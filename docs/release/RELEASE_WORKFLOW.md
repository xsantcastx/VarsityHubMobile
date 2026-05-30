# Release Workflow

This is the canonical release/run-readiness path for VarsityHub.

- Start here for every real release.
- Run phases in order.
- Older docs in this folder are now either phase-specific appendices or historical records.

## Phase Map

| Phase | Goal | Primary command | Supporting docs |
|---|---|---|---|
| 1. Local gate | Code health, security, approval flow, regressions | `npm run release:verify:local` | `../PR_CHECKLIST.md` |
| 2. Build gate | Block bad EAS builds | `npm run release:verify:build` | `CHECKLIST.md` |
| 3. Runtime gate | Verify Railway, SendGrid, health, and live env | `npm run release:verify:runtime` | `PENDING_OPERATOR_ACTIONS.md`, `EMAIL_GO_LIVE_CHECKLIST.md` |
| 4. Device UAT | Confirm real-user paths on devices | manual | `../COACH_DEVICE_UAT.md`, `../COACH_DEVICE_UAT_RESULTS_TEMPLATE.md` |
| 5. Go/No-Go | Explicit launch sign-off | manual | `LAUNCH_READINESS_GATE.md` |

## Commands

```bash
# Phase 1: local code + approval gate
npm run release:verify:local

# Phase 2: pre-build gate
npm run release:verify:build

# Phase 3: production/runtime gate
BASE_URL="https://your-api" npm run release:verify:runtime

# Full ordered run
BASE_URL="https://your-api" npm run release:verify:full
```

## What each phase owns

### Phase 1: Local gate

Runs the checks that should be green before any build or prod change:

- lint and both TypeScript passes
- `verify:guardrails`
- `audit:pre-release`
- `verify:release`
- regression suites
- Expo doctor
- coach UAT baseline
- coach approval wiring verification
- org-manager approval access verification
- email go-live audit

### Phase 2: Build gate

Runs only build-specific checks:

- `verify:build`
- EAS/env/build config validation
- native config validation
- Sentry/build prerequisites

This phase intentionally skips the full release-readiness audit because Phase 1 already owns that gate.

### Phase 3: Runtime gate

Runs after Railway/SendGrid/provider updates:

- `verify:production-health`
- `verify:email-go-live`
- `verify:email`

Then finish the operator tasks in:

- [PENDING_OPERATOR_ACTIONS.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/PENDING_OPERATOR_ACTIONS.md)
- [EMAIL_GO_LIVE_CHECKLIST.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/EMAIL_GO_LIVE_CHECKLIST.md)

### Phase 4: Device UAT

Required minimum accounts:

- approved coach
- fan-role org manager
- public fan
- paid account state
- blocked coach/fan-mode account

### Phase 5: Go/No-Go

Release only after [LAUNCH_READINESS_GATE.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/LAUNCH_READINESS_GATE.md) is filled with owners and evidence.

## Doc roles

- `CHECKLIST.md`: short release gate summary
- `LAUNCH_READINESS_GATE.md`: final sign-off form
- `PENDING_OPERATOR_ACTIONS.md`: provider/dashboard work the repo cannot do
- `EMAIL_GO_LIVE_CHECKLIST.md`: SendGrid-specific appendix
- `FINAL_LAUNCH_SEQUENCE.md`: compatibility pointer to this workflow
- `PRODUCTION_READINESS*.md`, `READY_FOR_PRODUCTION.md`: historical context only
