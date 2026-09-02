# Real-World Foundation Phase 4

Date: 2026-09-02

## Scope

Phase 4 verifies production drift controls and provider/tooling readiness for
real-world use.

This phase covers:

- Railway runtime health
- Vercel web edge behavior
- SendGrid template/env readiness
- Sentry build/runtime setup
- Cloudinary credentials
- rate-limit coverage
- backup freshness
- Snyk/dependency scanning state

## Runtime Verification

### Release Runtime Gate

Command:

```bash
BASE_URL="https://api-production-8ac3.up.railway.app" npm run release:verify:runtime
```

Result:

- Passed.
- Production health verification passed.
- Email go-live audit passed.
- Email runtime config passed.
- SendGrid API key was structurally valid.
- Critical transactional templates were configured.
- Recommended templates were configured.

Important note:

- `verify:email` reported local shell `APP_BASE_URL=http://localhost:4000`.
  The verifier still applied the Railway template overlay, but provider-side
  production env review must confirm live `APP_BASE_URL` points at the intended
  production URL.

### Railway API Health

Command:

```bash
curl -fsS https://api-production-8ac3.up.railway.app/health
```

Result:

- Passed.
- Response returned `{"status":"ok"}`.

### Vercel Web Edge

Commands:

```bash
curl -I -fsS https://www.varsityhub.app
curl -I -fsS https://varsityhub.app
```

Result:

- `https://www.varsityhub.app` returned `200`.
- `https://varsityhub.app` returned `308` redirecting to
  `https://www.varsityhub.app/`.
- Response included expected security headers such as HSTS,
  `x-content-type-options: nosniff`, and `x-frame-options: DENY`.

Provider-side follow-up:

- Confirm Vercel production deployment source branch and commit.
- Confirm `vercel.json` rewrites still route share/OG pages to the Railway API.
- Confirm uptime monitoring exists for both the web app and API health endpoint.

## Provider And Tool Checks

### Sentry

Command:

```bash
bash scripts/verify-sentry-setup.sh
```

Result:

- Passed.
- Mobile and server Sentry packages are present.
- iOS and Android `sentry.properties` files are present.
- Native Sentry org/project configuration is present.
- EAS production `SENTRY_AUTH_TOKEN` is visible to the verifier.
- `utils/sentry.ts` and `server/src/lib/sentry.ts` exist.
- App initialization is wired through `app/_layout.tsx`.

Provider-side follow-up:

- Confirm alert rules exist for mobile crash spike, server error spike,
  payment finalization failures, webhook failures, queue failures, and ingest
  failures.
- Generate one test client issue and one test server issue.
- Confirm alerts reach the real operator channel.

### Cloudinary

Command:

```bash
npm --prefix server run verify:cloudinary
```

Result:

- Passed.
- Cloudinary credentials are real and working.

Provider-side follow-up:

- Confirm upload preset/folder lifecycle policy.
- Confirm account quota and alerting.
- Confirm media deletion/account-deletion behavior is covered by operational
  review.

### Rate Limits

Command:

```bash
npm --prefix server run verify:rate-limits
```

Result:

- Passed.
- All `25` sensitive endpoint rate-limit checks passed.

Covered surfaces:

- auth
- payments
- ad impression/click
- upload signatures/files/media/avatar

### Backup Freshness

Commands:

```bash
npm --prefix server run verify:backup-freshness
railway variables --service api --json
DATABASE_URL="$PRIMARY_URL" DATABASE_BACKUP_URL="$BACKUP_URL" npm --prefix server run verify:backup-freshness
```

Result:

- Passed after provider URL verification.
- Local shell verification first failed because local `.env` did not provide
  `DATABASE_BACKUP_URL`.
- Railway `api` variables show `DATABASE_BACKUP_URL` is configured.
- `railway run --service api` could not resolve the private Railway Postgres
  hostname from this local machine, so the verifier was rerun with the provider
  public URLs.
- The verifier checked `57` tables and reported the backup as reachable,
  complete, and restorable.
- Final summary reported byte-for-byte current row totals with `0` row drift.

Classification:

- Closed repo/provider verification item.

Required launch-gate action:

- Record the successful backup freshness run in
  `docs/release/LAUNCH_READINESS_GATE.md`.
- Keep a provider-side reminder that local Railway private hostnames are not
  resolvable from this workstation; use Railway runtime logs or public provider
  URLs for future operator verification.

### Snyk And Dependency Drift

Commands already run in Phase 2:

```bash
npm audit --omit=dev --audit-level=high
npm --prefix server audit --omit=dev --audit-level=high
snyk test --all-projects --severity-threshold=high
```

Current state:

- Snyk CLI is installed.
- Snyk scan failed with `401 Unauthorized`.
- `snyk test --all-projects` also scanned `.claude/worktrees` and iOS sample
  Podfiles, which are not product release inputs.
- Root npm audit high count was reduced from `9` to `8` by bumping the
  `react-native > glob > minimatch` lockfile entry from `3.1.2` to `3.1.5`.
- `npm ls minimatch --all` now exits `0`, so the dependency tree is
  structurally valid.
- Root npm audit still reports high-severity findings through Expo/Metro build
  tooling, rooted in `image-size` via Metro.
- Server npm audit has no high-severity findings, but still reports moderate
  advisories through `query-string`/`decode-uri-component` and `sanitize-html`.
- `sanitize-html@2.17.7` would clear that moderate advisory, but it requires
  Node `>=22.12.0`; the current server runtime contract is Node 20.

Classification:

- Open security-tooling blocker until Snyk auth is fixed or the launch gate
  explicitly accepts npm audit as the temporary source of truth.

Required action:

- Re-authenticate Snyk.
- Run Snyk with explicit excludes for `.claude`, `ios/Pods`, and any local
  worktree/output directories.
- Review `.snyk` ignores before their 2026-09-30 expiry.
- Decide whether remaining Expo/Metro audit findings are accepted as
  build-tooling risk until the next native dependency upgrade.
- Plan a Node 22 server-runtime upgrade before moving `sanitize-html` to
  `2.17.7` or later.

## Minimum Provider Evidence For Launch Gate

Record each item in `docs/release/LAUNCH_READINESS_GATE.md`:

| Provider   | Evidence required                                                             |
| ---------- | ----------------------------------------------------------------------------- |
| Sentry     | Alert links, test issue links, alert-delivery confirmation                    |
| Railway    | Latest healthy deployment, env review, backup freshness pass                  |
| Vercel     | Production deployment commit, rewrite check, uptime monitor                   |
| Snyk       | Authenticated scan result or explicit risk acceptance                         |
| EAS        | Production branch/runtime mapping, Sentry token, latest OTA/build identifiers |
| Stripe     | Live key/webhook/price verification                                           |
| SendGrid   | Template/env verifier output and one real test inbox delivery                 |
| Cloudinary | Credential verifier output, quota/alert confirmation                          |
| Google     | Maps key restrictions and Play purchase verification config                   |
| Apple      | IAP/sign-in config, bundle ID, and cert/secret review                         |

## Phase 4 Status

Passed:

- Railway production health
- Vercel web reachability
- release runtime gate
- SendGrid template/env readiness
- Sentry local setup
- Cloudinary credential verification
- rate-limit coverage
- backup freshness verification
- valid `minimatch` dependency tree with React Native nested `minimatch`
  patched to `3.1.5`

Open blockers:

- Snyk authentication invalid, so Snyk cannot currently serve as a launch gate.
- Root npm audit still has high-severity Expo/Metro dependency advisories in
  mobile build/native tooling paths.
- Server moderate dependency advisories require either Node 22 runtime upgrade
  (`sanitize-html`) or upstream dependency movement
  (`query-string`/`decode-uri-component`).

## Phase 5 Entry Criteria

Do not move to broad real-world rollout until:

- Snyk auth or explicit temporary security-gate policy is resolved
- Sentry alert evidence is captured
- provider owners have signed off in the launch gate
- Phase 3 device UAT has no unresolved P0/P1 failures
