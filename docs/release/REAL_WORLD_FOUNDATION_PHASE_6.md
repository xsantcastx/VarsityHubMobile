# Real-World Foundation Phase 6

Date: 2026-09-02

## Scope

Phase 6 investigated the live Railway production environment for the remaining
readiness gaps, cleaned confirmed stale provider variables, and added guardrails
for the drift found during the investigation.

## Railway Project State

Command:

```bash
railway status
```

Result:

- Workspace: Emil Sanchez's Projects.
- Project: `capable-trust`.
- Environment: `production`.
- Linked service: `api`.
- `api` is online.
- Redis is online.
- Two Postgres services are online: `Postgres` and `Postgres-TnGR`.
- One detached Postgres volume exists: `postgres-dkc5-volume`.

## Runtime Provider Gate

Command:

```bash
BASE_URL="https://api-production-8ac3.up.railway.app" \
HEALTH_CHECK_SECRET="<from Railway api env>" \
npm run release:verify:runtime
```

Result:

- Passed.
- Production health passed.
- Email catalog/env audit passed.
- Email runtime config passed.
- SendGrid API key looked structurally valid.
- Critical templates: `32/32`.
- Template groups referenced by code: `41`.
- Template groups satisfied in shell: `41`.

## Sentry Provider Gate

Commands:

```bash
npm run verify:sentry-readiness
```

Direct Sentry API evidence:

- Project exists: `lime-productions/varsityhub`.
- Project platform: `javascript-react`.
- The old Sentry alert-rule API now returns `410 Gone`; alert-rule existence
  needs dashboard evidence or a newer provider API surface.
- Recent releases are visible.
- Latest observed Android release: `com.varsityhub.varsityhub@1.0.5+59`.
- Latest observed Android release had events, but no uploaded release files were
  returned by the Sentry release-files API.
- Sentry monitor/check-in list returned empty.
- Local production Expo config resolves with `uploadSourcemaps=true`.
- Native upload hooks are present for Android (`sentry.gradle`) and iOS
  (`sentry-xcode.sh`).

Open Sentry work:

- Confirm source-map upload for current EAS updates/builds. Sentry events show
  bundle/source-map names, but `origFilename` values are unresolved and the
  release-files endpoint returned `[]`.
- Confirm production alert rules in the Sentry dashboard because the previous
  alert-rule API endpoint now returns `410 Gone`.
- Triage or resolve recent unresolved issues before broad rollout. Fresh sampled
  issues included `VARSITYHUB-3V` (`Admin only`), `VARSITYHUB-3A`
  (`Token already used`), `VARSITYHUB-3T` (native iOS fatal),
  and `eventCard` dropped-item warnings.
- Current production `/event-discovery?surface=map&limit=200` and the
  `2026-08-28` map query both validate cleanly against the current client
  event-card schema, so the sampled `eventCard` issue did not reproduce against
  the current API response.

## EAS Env Drift

Command:

```bash
eas env:list production --format long
```

Findings:

- `SENTRY_AUTH_TOKEN` was stored as public/readable EAS env metadata.
- Several `EXPO_PUBLIC_*` names exist as duplicate EAS entries, usually one
  production-only public entry and one multi-environment secret entry.

Cleanup completed:

- Updated `SENTRY_AUTH_TOKEN` visibility to `sensitive`.

Guard added:

```bash
npm run verify:eas-env-drift
```

This command parses EAS env metadata and prints only names/counts/status, never
values. It fails if required production keys are missing or if `SENTRY_AUTH_TOKEN`
is readable. Duplicate public keys are warnings because this CLI exposes delete
by name/environment, not by id, and the current duplicate names cannot be safely
distinguished non-interactively.

Open EAS work:

- Rotate `SENTRY_AUTH_TOKEN` because it was historically readable through
  `eas env:list`.
- Clean duplicate `EXPO_PUBLIC_*` entries from the EAS dashboard or another
  ID-aware management surface.

## Protected Health Checks

Commands:

```bash
GET /health?include=payments
GET /health/egress
GET /health/email
GET /health/cloudinary
```

Results:

- `/health?include=payments`: `status=ok`, `ready=true`, `environment=production`.
- Core integrations true: database, JWT, Cloudinary, Twilio, Stripe, SendGrid,
  Google OAuth, Google Maps, Apple IAP, Apple IAP legacy receipt, Sentry, Redis.
- Payments config reports payments enabled, Stripe configured, and webhook
  secret present.
- `/health/egress`: `reachable=4`, `total=4`, no failed targets.
- `/health/email`: `status=ok`, SendGrid configured, service ready, no missing
  critical or recommended templates.
- `/health/cloudinary`: `status=ok`, signed-upload probe succeeded.

Open health warning:

- `dataExportStorage=false`. `POST /me/data-export` will return `503` until
  `DATA_EXPORT_S3_BUCKET`, `DATA_EXPORT_S3_REGION`,
  `DATA_EXPORT_S3_ACCESS_KEY_ID`, and `DATA_EXPORT_S3_SECRET_ACCESS_KEY` are
  configured.

Important distinction:

- Railway has public/media `R2_*` variables configured.
- GDPR data exports intentionally use separate `DATA_EXPORT_S3_*` variables.
- Do not alias the public media bucket into private data exports unless the
  bucket policy and object access model are explicitly reviewed.

## Railway Env Drift Found

These keys were present at the start of Phase 6:

- `HEALTH_CHECK_SECRET ` with a trailing space. Code currently tolerates it,
  but the canonical key should be the only key after rotation.
- `EXPO_PUBLIC_SENTRY_TRACES_SAMPL` is misspelled. Client code reads
  `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`.
- `SENTRY_ENVIROMENT` is misspelled. Server Sentry currently uses `NODE_ENV`,
  so this is likely stale, but it should not remain as a misleading env key.
- `SENDGIRD_API_KEY` is misspelled. `SENDGRID_API_KEY` is also present and
  valid, so this is stale.
- A pasted SQL command is present as a variable key on both Postgres services.
  Remove it from Railway variables after confirming it is not used.

Cleanup completed:

- Added `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` to the `api` service using the
  value from the misspelled Railway key, without printing the value.
- Removed `EXPO_PUBLIC_SENTRY_TRACES_SAMPL` from the `api` service.
- Removed `SENTRY_ENVIROMENT` from the `api` service.
- Removed `SENDGIRD_API_KEY` from the `api` service.
- Removed `HEALTH_CHECK_SECRET ` from the `api` service. The canonical
  `HEALTH_CHECK_SECRET` key remains set.
- Removed the pasted SQL-command variable key from both Postgres services.

Post-cleanup verification:

```bash
npm run verify:railway-env-drift
```

Result:

- Passed.
- Remaining warnings are limited to missing `DATA_EXPORT_S3_*` keys.
- `api` stayed online on the same deployment id after the cleanup.

## Railway Logs

HTTP log summary from the last 24 hours:

- No 5xx HTTP responses were found.
- Most traffic was `/health`, `/events`, `/games`, user posts, subscription
  summary, `/me`, and feed bundle.
- Observed non-critical statuses included expected unauthenticated `401`,
  forbidden `403` for sample seeding, `404` for `robots.txt`/favicon, and client
  disconnect `499` responses.

App log observations:

- Repeated UptimeRobot `HEAD /health` requests were logged as slow requests.
- The prior production logger included request headers, which exposed
  `x-health-check-secret` for protected health probes in Railway logs.
- Scheduler jobs are running: push receipt verification, Stripe reconciliation,
  Apple IAP reconciliation, and Google Play reconciliation.
- Recent reconciliation logs showed zero stuck/orphaned/errors in the sampled
  window.

## Fixes Added In This Phase

Files:

- `apiclient/http.ts`
- `utils/sentry.ts`
- `__tests__/http.test.ts`
- `__tests__/observability-scrubbing.test.ts`
- `utils/mapClustering.ts`
- `__tests__/mapClustering.test.ts`
- `components/EventMap.tsx`
- `components/__tests__/EventMap.test.tsx`
- `server/src/lib/httpLogRedaction.ts`
- `server/src/app.ts`
- `server/src/routes/health.ts`
- `server/src/lib/sentry.ts`
- `server/src/__tests__/http-log-redaction.test.ts`
- `server/src/__tests__/sentry-scrubbing.test.ts`

Changes:

- Stop promoting ordinary handled client 4xx responses to Sentry exceptions in
  the shared HTTP client. This suppresses the sampled `/games/seed-samples`
  `403 Admin only` noise while preserving one Sentry capture for real 5xx
  responses.
- Drop expected auth/reset/verification UX errors such as invalid credentials,
  rate limits, expired codes, and `TOKEN_ALREADY_USED` before sending them to
  Sentry or analytics exception capture.
- Reject invalid map coordinates (`NaN`, infinities, out-of-range latitude or
  longitude, and numeric strings) before clustering or rendering native
  `Marker`s. This addresses the plausible `AIRMap insertReactSubview` crash
  path seen in the sampled iOS native fatal.
- Redact sensitive HTTP log headers before they reach Railway logs:
  authorization, cookies, proxy authorization, health-check secret, Stripe
  signature, idempotency key, and SendGrid webhook headers.
- Redact operational secret headers from Sentry request envelopes as
  defense-in-depth.
- Add a direct `HEAD /health` response so uptime probes do not perform a
  database health query.

Verification:

```bash
npm --prefix server test -- --runInBand \
  src/__tests__/http-log-redaction.test.ts \
  src/__tests__/sentry-scrubbing.test.ts \
  src/__tests__/healthCheckSecret.test.ts \
  src/__tests__/healthProbe.test.ts

npm test -- --runInBand \
  __tests__/http.test.ts \
  __tests__/observability-scrubbing.test.ts

npm test -- --runInBand \
  __tests__/mapClustering.test.ts \
  components/__tests__/EventMap.test.tsx \
  components/__tests__/EventMap.autofit.test.tsx

npx tsc --noEmit
npx tsc --noEmit --project server/tsconfig.json
```

Result:

- Server focused tests passed: `4` suites, `15` tests.
- Client focused tests passed: `2` suites, `20` tests.
- Map coordinate focused tests passed: `3` suites, `18` tests.
- Full client Jest passed: `199` suites, `1401` tests.
- Client TypeScript and server TypeScript passed.

## New Required Operator Actions

Guard added:

```bash
npm run verify:railway-env-drift
```

This command reads Railway variable names for the `api` service and fails on
known drift without printing secret values.

After this patch is deployed:

1. Rotate `HEALTH_CHECK_SECRET` in Railway.
2. Update any external monitors that send the health secret.
3. Confirm new Railway logs show `[redacted]` for `x-health-check-secret`.

Before data-export launch:

1. Create or choose a private R2/S3 bucket for GDPR exports.
2. Set `DATA_EXPORT_S3_BUCKET`.
3. Set `DATA_EXPORT_S3_REGION` (`auto` for Cloudflare R2).
4. Set `DATA_EXPORT_S3_ACCESS_KEY_ID`.
5. Set `DATA_EXPORT_S3_SECRET_ACCESS_KEY`.
6. Optionally set `DATA_EXPORT_S3_ENDPOINT` for R2.
7. Re-run protected `/health?include=payments`; `dataExportStorage` should be
   true and the warning should disappear.
