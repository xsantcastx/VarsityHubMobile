# Launch Readiness Gate (GO/NO-GO)

Use this as the final release sign-off gate for real-world readiness.

- This is a release blocker checklist, not guidance.
- Every required gate must be marked PASS or FAIL.
- Every PASS must include owner + evidence.
- Any required FAIL or UNKNOWN means NO-GO.

Related docs:

- [RELEASE_WORKFLOW.md](./RELEASE_WORKFLOW.md)
- [CHECKLIST.md](./CHECKLIST.md)
- [PROVIDER_DASHBOARD_VERIFICATION.md](./PROVIDER_DASHBOARD_VERIFICATION.md)
- [../PR_CHECKLIST.md](../PR_CHECKLIST.md)

---

## Decision Rule

- **GO** only if all required gates below are PASS.
- **NO-GO** if any required gate is FAIL or UNKNOWN.
- Exceptions are allowed only with explicit risk acceptance:
  - approver,
  - mitigation,
  - rollback plan,
  - follow-up owner and deadline.

---

## Sign-Off Header

- Release tag/version:
- Date/time (UTC):
- Release owner:
- Incident commander (if rollback needed):
- Scope summary:

---

## Required Gates

Fill every row before release.

| #   | Gate                               | Owner              | Pass Criteria                                                                                                    | Evidence                            | Status (PASS/FAIL/UNKNOWN) |
| --- | ---------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------- |
| 1   | Real-device smoke (iOS + Android)  | Mobile QA          | Auth, onboarding, payment, geofence, deep links, dark/light verified on physical devices                         | Test run IDs / checklist links      |                            |
| 2   | Production-like staging drill      | Release owner      | Full release flow succeeds in staging with prod-like config and realistic data                                   | Staging runbook result link         |                            |
| 3   | Observability + alerting           | Backend/Ops        | Alerts fire for auth failures, payment/webhook failures, 5xx spikes, and geofence anomalies; logs support triage | Alert screenshots / dashboard links |                            |
| 4   | Load + race/concurrency validation | Backend lead       | Critical race-sensitive flows show no integrity drift under concurrent traffic                                   | Load test report / logs             |                            |
| 5   | Rollback readiness drill           | Incident commander | App/API/schema rollback path validated and time-bounded                                                          | Rollback drill notes                |                            |
| 6   | Security operations hygiene        | Security owner     | Secrets hygiene verified, dependency risks triaged, no unreviewed critical findings                              | Security scan links / ticket refs   |                            |
| 7   | Backup + restore drill             | DB owner           | Restore from recent backup works for critical tables and basic read/write checks                                 | Restore drill evidence              |                            |
| 8   | Abuse/fraud controls               | Backend/Ops        | Rate limits and abuse controls active; suspicious flows are blocked and logged                                   | Config proof / log examples         |                            |
| 9   | Canary and kill-switch readiness   | Release owner      | Canary plan, abort criteria, and safe stop path are documented and tested                                        | Rollout plan link                   |                            |
| 10  | Support and incident readiness     | Product/Support    | On-call/support runbooks ready for top incidents with ownership                                                  | Runbook links / rota snapshot       |                            |

---

## Required Command Gate (must be green)

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npx tsc --noEmit --project server/tsconfig.json`
- [ ] `npm run verify:guardrails`
- [ ] `npm run verify:release`
- [ ] `npm run test:regressions`
- [ ] `npm run test:regressions:server`

Evidence:

- CI run URL:
- Local/agent run logs:

Agent evidence snapshot, 2026-09-02:

- Runtime gate passed against `https://api-production-8ac3.up.railway.app`.
- Railway `/health` returned `{"status":"ok"}`.
- Vercel `https://www.varsityhub.app` returned `200`; apex domain redirected
  to `https://www.varsityhub.app/`.
- `npm run release:verify:local` passed.
- `npm run release:verify:build` passed with non-blocking warnings recorded in
  `docs/release/REAL_WORLD_FOUNDATION_PHASE_5.md`.
- Full client Jest passed: `199` suites, `1399` tests.
- Full server Jest passed: `304` suites, `2860` tests.
- Client TypeScript and server TypeScript passed.
- Focused readiness regression tests passed for event-map previews/autofit,
  guest create-entry routing, and share fallback behavior.
- Sentry setup verifier passed locally; provider test issues still need operator
  evidence.
- Cloudinary credential verifier passed.
- Rate-limit verifier passed: `25/25`.
- Backup freshness verifier passed with provider database URLs: `57` tables
  checked, backup reachable/complete/restorable, `0` row drift summary.
- Play Store verifier passed after fixing `docs/well-known/assetlinks.json`:
  `13` passed, `0` failed, `0` warnings.
- `npm ls minimatch --all` passed after bumping React Native's nested
  `minimatch` lockfile entry to `3.1.5`.
- Root dependency audit still reports the time-boxed Expo/Metro `image-size`
  high advisory chain. CI allowlists only that no-compatible-fix build-tooling
  chain; all other high/critical frontend dependency findings must fail.
- Server `npm audit --omit=dev --audit-level=high` has no high-severity
  findings after the dependency refresh. Moderate advisories remain for
  `sanitize-html` and `query-string`/`decode-uri-component`.
- Authenticated Snyk runs in GitHub are the source of truth for Snyk because the
  local CLI is not authenticated. Commit `f3f13111` passed Snyk Code &
  Dependency Scan and Container Security Scan after the dependency refresh.
- Physical-device iOS/Android UAT and real push delivery are not proven by
  local/repo automation.
- Railway production investigation passed the runtime/provider gate and found
  no recent 5xx responses, but discovered env drift and a log-redaction issue.
  See `docs/release/REAL_WORLD_FOUNDATION_PHASE_6.md`.
- Railway env drift cleanup completed for the `api`, `Postgres`, and
  `Postgres-TnGR` services; `npm run verify:railway-env-drift` now passes with
  only data-export storage warnings.
- EAS env drift guard added and passing. `SENTRY_AUTH_TOKEN` visibility was
  changed from readable/public to sensitive. Duplicate Google `EXPO_PUBLIC_*`
  env names remain as warnings because this EAS CLI cannot safely delete a
  duplicate by id.
- Sentry readiness guard added and passing. Project and `7` production alert
  rules are visible, but source-map/release-file and unresolved-issue warnings
  remain.
- Client observability noise reduced: handled 4xx HTTP outcomes no longer emit
  transport exceptions, and expected auth/reset/verification UX errors are
  dropped before Sentry or analytics exception capture. Focused tests passed.
- Production OTA published for both active runtime lines: `1.0.5` update group
  `e48da7af-229a-498c-838b-61727ff4a543` and `1.0.4` update group
  `d34628be-aef0-4c76-8a25-eeb61ea6db8c`.
- Production OTA automation drift found: GitHub's OTA workflow was green while
  skipping publish because `EXPO_TOKEN` was not configured in GitHub Actions.
  The workflows now fail if either `EXPO_TOKEN` or `SENTRY_AUTH_TOKEN` is
  missing, and local `npm run update:production` now runs through
  `eas env:exec production` so Sentry source-map upload gets the sensitive EAS
  token.
- Follow-up OTA published from commit `fc2192ed` for both active runtime lines:
  `1.0.5` update group `ae5fe04f-2ddf-4b98-8328-09c7ce366ecc` and `1.0.4`
  update group `bce5581a-20d4-4bb0-97ca-cacb51232584`. Explicit Sentry
  `expo-upload-sourcemaps dist` succeeded and uploaded debug-id artifact
  bundles for Android, iOS, and web.
- Vercel env drift guard added. Production Vercel env was cleaned from 88 to 27
  entries by removing clearly server-only Railway secrets, adding required
  public web build keys, and verifying `npm run verify:vercel-env-drift`
  passes. GitHub web deploy now pulls Vercel production env before `expo export`
  instead of baking only the Sentry DSN into the static bundle.
- Data export storage is not configured in production health diagnostics;
  `POST /me/data-export` will return `503` until `DATA_EXPORT_S3_*` vars point
  at private export storage.
- `HEALTH_CHECK_SECRET` was rotated after the Phase 6 redaction patch. The
  follow-up direct Railway deployment
  `f25b1cf3-1bb3-4e32-bcde-afb3c2b6c71c` succeeded. The latest direct Railway
  deployment, `09cea309-e80a-4c3c-839f-ce11d2c3d17d`, also succeeded after
  readiness-output redaction was tightened. Protected runtime verification
  passed, `HEAD /health` returned `200`, and new logs show the health-check
  header value as `[redacted]`. One transient `502` health response was observed
  during deployment activation.
- Railway GitHub autodeploy remains source-drifted: env changes triggered a
  failed stale-source deployment from `xsantcastx/VarsityHubMobile` `main`,
  while current tested commits are on `fork/main`. Fix by restoring push access
  to `origin/main`, reconnecting Railway to the maintained branch, or keeping
  direct CLI deploys as the explicit production path.

---

## Exception Log (if any)

| Gate # | Approved by | Risk accepted | Mitigation now | Follow-up owner | Follow-up deadline |
| ------ | ----------- | ------------- | -------------- | --------------- | ------------------ |
|        |             |               |                |                 |                    |

---

## Final Release Decision

- [ ] GO
- [ ] NO-GO

Decision owner:

Notes:
