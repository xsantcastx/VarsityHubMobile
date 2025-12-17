# VarsityHub – Deploy Checklist (One‑Pager)

This checklist is optimized for a safe, fast release. Follow in order and check each item.

## 1) Preconditions
- Branch: Up to date with `main`, CI green.
- Tests: All pass locally and in CI.
  - Server: `pushd server && npm ci && npm test && popd`
  - App (if applicable): `npm ci && npm test`
- Lint/Types: `npm run lint` and `tsc --noEmit` clean for relevant packages.

## 2) Environment & Secrets
- Production `.env` (server) includes:
  - `APP_BASE_URL=https://varsityhub.app`
  - `SENDGRID_API_KEY=<prod key>`
  - `SENDGRID_CLICK_TRACKING_ENABLED=0` (keep 0 unless Link Branding is fully verified)
  - Any other required IDs (template IDs, DB URL, Redis, Sentry, etc.).
- Double‑check secret storage (CI/CD or host) is current and scoped to PROD.

## 3) Database & Services
- Prisma migrations (if used):
  - `pushd server && npx prisma migrate deploy && popd`
- Background services reachable: DB, Redis/Queue, Object storage, SendGrid.

## 4) Build Artifacts
- Server build: `pushd server && npm run build && popd` (verify build succeeds).
- Container or PM2 files (if used) updated to point to compiled output.

## 5) Email Safety Gate
- Click‑tracking policy:
  - Default: Leave `SENDGRID_CLICK_TRACKING_ENABLED=0` for production until Link Branding DNS is verified.
  - If analytics required later: complete Link Branding DNS + verification first, then flip to `1` and redeploy.
- Template validation (local, non‑prod):
  - `node sendgrid-preview-validator.js` → expect PASS for all templates.
- Smoke test (staging or maintenance window):
  - Trigger password reset for a test account; ensure received email links are direct (not SendGrid‑rewritten) and open correctly.

## 6) Security & Quality Gates
- SAST/SCA scans (must be green before deploy):
  - Snyk Code: `snyk code test` (or CI job)
  - Snyk Open Source (SCA): `snyk test` (or CI job)
- Ensure Helmet/CORS/rate‑limit settings match prod expectations.

## 7) Deploy
- Put app in maintenance (if needed) or do zero‑downtime rollout.
- Deploy server:
  - Roll out compiled build (or container) to PROD.
  - Ensure env vars/secrets applied.
- Health check:
  - `/health` (or equivalent) returns OK.

## 8) Post‑Deploy Verification (10–15 min)
- Authentication flows:
  - Forgot/Reset password → email received → link opens → reset completes.
  - Password Changed email triggers after reset completes.
- Critical UI/API paths respond and log cleanly.
- Logs/Monitoring:
  - No error spikes; check Sentry (if enabled) and application logs.

## 9) Rollback Plan (Have ready before deploy)
- Last known good build artifact or image tag.
- One‑command rollback (PM2, K8s, or platform‑specific) documented and tested.
- DB: Confirm migrations are backward‑compatible or have a down plan.

## 10) Optional: Enable Click Tracking Later
- Complete Link Branding DNS per SendGrid (CNAMEs) and verify.
- Send a staging email, confirm links use your branded domain and resolve correctly.
- Flip `SENDGRID_CLICK_TRACKING_ENABLED=1` in PROD env and redeploy.

---

Owner: Engineering. Last updated: 2025‑12‑17.
