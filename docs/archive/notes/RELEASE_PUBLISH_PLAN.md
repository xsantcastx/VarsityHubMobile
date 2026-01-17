# VarsityHub Launch Publish Plan

This document tracks the final engineering steps needed to publish on time. Each section maps to the six action items we outlined (CI lockdown → deployment hardening → smoke tests → scope freeze → release assets → comms).

## 1. CI Lockdown & Status
- `npm run lint:strict` → ✅ (Dec 17 @ 02:45 UTC). TypeScript issues around `__DEV__` and `react-native-calendars` resolved via `types/globals.d.ts` and `types/react-native-calendars.d.ts`.
- `npm test -- --runInBand --passWithNoTests` → ✅ after adding `UTFSequence` shim (`jest.config.js`, `shims/UTFSequenceMock.js`).
- Required branch protection (to configure in GitHub UI):
  1. Require PR reviews for `main`.
  2. Require status checks `CI / lint-and-test`, `Railway Health Check`, `Railway Env Audit`.
  3. Block force pushes + deletions.
- Reference workflow: `.github/workflows/ci.yml`.

## 2. Production Deploy Hardening (Railway)
- All runtime dependencies (including `typescript`/`tsx`) now live in `server/package.json`.
- Updated instructions in `RAILWAY_CLEANUP_GUIDE.md`:
  - **Root directory**: `server`
  - **Install**: `npm ci`
  - **Build**: `npm run build`
  - **Start**: `npm start`
  - **Post-deploy**: `npx prisma migrate deploy` (optional but recommended)
- Environment checklist lives in `RAILWAY_ENV_VARS.md` (now includes Sentry DSN + missing template IDs).

## 3. Smoke Tests (current run)
| Test | Command | Result | Notes |
| --- | --- | --- | --- |
| Lint + typecheck | `npm run lint:strict` | ✅ | Uses Expo lint + `tsc --noEmit`. |
| Component/Jest suite | `npm test -- --runInBand --passWithNoTests` | ✅ | Added UTFSequence mock; QuickAddGameModal suite now green. |
| Payments regression | `node qa-test-stripe-fix.mjs` | ✅ w/ warning | Confirms veteran/legend → role=coach path, highlights unpaid-session branch still implicit (see console warning). |
| Railway health ping | `curl https://api-production-8ac3.up.railway.app/health` | ⚠️ Blocked (no outbound network in sandbox). Run locally or in CI to confirm once deploy finishes. |
| Email/SMS verification | `scripts/email-verification-test.sh` | ⚠️ Requires running API + Redis; queued for post-deploy validation. |

Follow-up smoke steps once Railway deploy completes:
1. Password reset: `curl -X POST https://api-production-8ac3.up.railway.app/auth/password/forgot -d '{"email":"<test>"}'`.
2. Twilio code: `curl -X POST .../auth/verify/request` and confirm SMS.
3. Stripe vet/legend checkout on staging (see script instructions inside `qa-test-stripe-fix.mjs` footer).

## 4. Scope Freeze Guidelines
- Allow only P0/P1 fixes (crashes, data loss, compliance). Anything else defers to post-launch patch release.
- Every change must have:
  1. Green `npm run lint:strict` and `npm test`.
  2. Linked issue / checklist entry referencing the launch blocker it solves.
  3. Review from one other engineer (branch protection enforces this).
- Keep a running blocker list in `APP_FIXES_LOG.md` and mark resolved items with commit hashes.
- If a fix touches native code or build config, schedule an immediate EAS build after merge to avoid last-minute surprises.

## 5. Release Assets & Comms
- Release notes → `RELEASE_NOTES_v1.0.0.md` (refresh with latest fixes).
- App Store / Play Store text → `TESTFLIGHT_RELEASE_NOTES.md`, `DEPLOYMENT_WEB_TESTFLIGHT.md`.
- Privacy/support links already documented in `LAUNCH_ENGINEERING_CHECKLIST.md` (`§5 Compliance`). Confirm the published pages are live.
- Screenshots / marketing: use `assets/marketing` + `varsity-sim-screenshot.png`. Ensure final set uploaded to App Store Connect.
- Post-launch monitoring plan: hook Sentry DSN + add BetterStack uptime monitor pointed at `/health`.

## 6. Comms Cadence
- Status updates every ~3 hours (what shipped, what is blocked, ETA). Template lives in `APP_LAUNCH_VERIFIED.md`.
- If Railway deploy breaks, file in `BUILD_TROUBLESHOOTING.md` with log excerpt + fix.
- Keep TestFlight cohort informed via `TESTFLIGHT_RELEASE_NOTES.md` updates before each resubmission.

> Checklist owners: Emil (deploy + SMS), Codex (CI/tests), QA (manual smoke), Ops (store assets). Update this file as items flip to ✅.
