# Release Workflow

This is the canonical release/run-readiness path for VarsityHub.

- Start here for every real release.
- Run phases in order.
- Older docs in this folder are now either phase-specific appendices or historical records.

## Phase Map

| Phase           | Goal                                              | Primary command                  | Supporting docs                                                     |
| --------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| 1. Local gate   | Code health, security, approval flow, regressions | `npm run release:verify:local`   | `../PR_CHECKLIST.md`                                                |
| 2. Build gate   | Block bad EAS builds                              | `npm run release:verify:build`   | `CHECKLIST.md`                                                      |
| 3. Runtime gate | Verify Railway, SendGrid, health, and live env    | `npm run release:verify:runtime` | `PENDING_OPERATOR_ACTIONS.md`, `EMAIL_GO_LIVE_CHECKLIST.md`         |
| 4. Device UAT   | Confirm real-user paths on devices                | manual                           | `../COACH_DEVICE_UAT.md`, `../COACH_DEVICE_UAT_RESULTS_TEMPLATE.md` |
| 5. Go/No-Go     | Explicit launch sign-off                          | manual                           | `LAUNCH_READINESS_GATE.md`                                          |

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

### Production client publication

After the code/build gates and authorized API deployment/runtime checks, publish installed clients with `npm run update:production`. It requires a clean committed tree and loads the EAS production environment, public defaults from the production build profile, and the existing API's public Stripe configuration when needed. The shared launcher validates remote API settings, production mode, Sentry DSN and a live Stripe publishable key before export. It disables local dotenv loading so workstation settings cannot replace the production export configuration.

For the static website, run `eas env:exec production 'bash scripts/deploy-web-static.sh' --non-interactive` after OTA completes; both exports use `dist`. The script uses the same launcher and updates both custom domain aliases. Record and verify the actual OTA group/runtime/platforms and website deployment; successful export alone is not publication. These commands do not build or submit native binaries.

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

### Backup schema changes

API startup does not mutate the backup schema. Before deploying primary schema additions, apply reviewed additive equivalents to the backup and verify column/type coverage. Do not use `prisma db push --accept-data-loss`: it removes primary-only columns and can destroy the last complete backup. The atomic backup job rejects missing tables/columns and preserves the prior data on refresh failure. Primary migrations still run at startup.

## Verifiable failure safeguards

A root-cause ticket is not closed by a green unit suite alone. Record the failure trigger, invariant, regression test, original-source revision, failing output, fixed-source revision, passing output and runtime evidence together. Restore the original implementation in an isolated or automatically restored local test setup; the new test must fail for the intended behavioral reason, not a broken import or missing dependency.

- Enforce authorization, transaction ownership, uniqueness and durable state transitions at the server/database/storage boundary. UI state is not an invariant.
- Include controlled latency, reordered completions, cancellation/unmount, malformed payloads and persistence failures where applicable. Five concurrent client flushes prove client coalescing only; database fulfillment idempotency requires independent concurrent server requests and ledger/inventory assertions.
- Assert structured failure telemetry at the handler and telemetry-adapter boundaries. Use stable fingerprints by failure type/stage and put correlation IDs in sanitized context. Never attach signed receipts, tokens or raw provider payloads. Do not use per-receipt fingerprints that fragment one incident into thousands of groups.
- Verify deployed telemetry separately: record release/build/OTA, diagnostic case ID, timestamp, expected event and retrieved Sentry event. A mocked capture call, source-map upload, health endpoint or quiet incident counter does not demonstrate delivery from the affected edge case. Production diagnostics must avoid real charges, customer-data mutation and notification fan-out.
- Native process death, export cancellation and memory recovery need device/native measurements. If the installed API cannot cancel an export, label cancellation unsupported and keep that gate open; ignoring a late promise is not native cancellation.
- Keep separate statuses for implementation verified, runtime telemetry verified and native/device behavior verified. A missing gate remains open; it is never counted as a pass.

The client regression command includes receipt recovery/storage failures, search races, video lifecycle and Sentry filtering/fingerprint assertions. It runs in the local release gate. The current evidence ledger is [FAILURE_SAFEGUARDS_2026-09-06.md](FAILURE_SAFEGUARDS_2026-09-06.md).
