# Release Checklist

**Use this checklist before every production release.** This gates releases and prevents "tribal knowledge" from causing issues. For security-relevant changes (auth, payments, approvals, ownership), also complete [docs/PR_CHECKLIST.md](../PR_CHECKLIST.md) Section B.

> For one-time post-audit operator actions (credential rotations, EAS rebuild bundle, DNS attach, etc.) see [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md). Work through that doc first; it consolidates the spring-2026 audit + spiderweb-sweep follow-ups.
> For provider-by-provider click paths in Stripe, Railway, SendGrid, App Store Connect, Play Console, EAS, and Namecheap, use [PROVIDER_DASHBOARD_VERIFICATION.md](./PROVIDER_DASHBOARD_VERIFICATION.md).

## Go / No-Go Security Gate (Run This First)

Mark release **NO-GO** if any required command fails.

### Required command gate

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npx tsc --noEmit --project server/tsconfig.json`
- [ ] `npm run verify:guardrails`
- [ ] `npm run verify:release`
- [ ] `npm run test:regressions` (or scoped equivalent with reason documented)

### Conditional command gate (required when relevant)

- [ ] `npm run verify:error-envelope` when error envelope paths changed
- [ ] `npm --prefix server run test:payments:confidence` when payment/subscription code changed
- [ ] `npm --prefix server run verify:rate-limits` when auth/abuse/rate-limit behavior changed

### Runtime security smoke gate (required for risky changes)

- [ ] Real-device auth flow validated (sign-in, sign-out, token refresh, protected screen access)
- [ ] Role/plan/ownership enforcement validated on server (UI hide + server deny path both checked)
- [ ] Payment success path validates server state (no trust in query params)
- [ ] Geofence denies verified for non-device coordinates and out-of-radius attempts
- [ ] Geofence allows verified for in-radius device coordinates
- [ ] Dark/light quick sweep completed for changed screens (critical actions visible and usable)

## Release Decision

- [ ] **GO** only if every required gate above is green, or an explicit signed exception is documented with owner + mitigation + follow-up date
- [ ] **NO-GO** when any required gate is red, unknown, or unverified

## Pre-Release: Code Quality
- [ ] `./scripts/check-repo-health.sh` passes (no logs/artifacts committed)
- [ ] CI green: `npm run lint` passes
- [ ] CI green: `npm run typecheck` passes
- [ ] All tests pass: `npm test`

## Data and Migrations
- [ ] `server/prisma` migrations generated and applied in staging
- [ ] Migration smoke check completed (read/write on core tables)
- [ ] Database backup created before migration (production)

## Observability
- [ ] Sentry DSN configured for production (`SENTRY_DSN`)
- [ ] Sentry events visible in project dashboard
- [ ] Error tracking verified (test error appears in Sentry)

## Security and Rate Limiting
- [ ] Auth rate limiting enabled in production (`RATE_LIMIT_DISABLE=0`)
- [ ] JWT secret rotated and stored securely (32+ chars, not in git)
- [ ] Environment validation passes on boot (server refuses to start if required vars missing)
- [ ] All secrets stored in Railway/environment (not in code)

## Configuration
- [ ] `.env.example` updated for any new vars
- [ ] Railway/production env vars set and verified
- [ ] Required env vars present:
  - `DATABASE_URL` (PostgreSQL)
  - `JWT_SECRET` (32+ characters)
  - `SENDGRID_API_KEY` (if using email)
  - `GOOGLE_MAPS_API_KEY` (if using maps)
  - `SENTRY_DSN` (for error tracking)

## Smoke Test
- [ ] `./scripts/smoke-test.sh` passes against production URL
  ```bash
  SERVICE_URL="https://your-service.up.railway.app" ./scripts/smoke-test.sh
  ```
- [ ] `/health` endpoint returns 200
- [ ] `/auth/me` returns 401 without token (auth working)
- [ ] Optional: Login test passes (if `SMOKE_TEST_EMAIL` and `SMOKE_TEST_PASSWORD` set)

## Final Gate
- [ ] All checklist items completed
- [ ] Release notes updated (CHANGELOG.md)
- [ ] Version bumped (package.json, app.json)
- [ ] Ready to deploy

---

**Note**: If any item fails, do not proceed with release. Fix the issue and re-run the checklist.
