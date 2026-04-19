# Release Checklist

**Use this checklist before every production release.** This gates releases and prevents "tribal knowledge" from causing issues. For security-relevant changes (auth, payments, approvals, ownership), also complete [docs/PR_CHECKLIST.md](../PR_CHECKLIST.md) Section B.

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
