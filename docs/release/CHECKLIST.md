# Release Checklist

Use this checklist before every production release.

## Data and Migrations
- [ ] `server/prisma` migrations generated and applied in staging
- [ ] Migration smoke check completed (read/write on core tables)

## Observability
- [ ] Sentry DSN configured for production (`SENTRY_DSN`)
- [ ] Sentry events visible in project dashboard

## Security and Rate Limiting
- [ ] Auth rate limiting enabled in production
- [ ] JWT secret rotated and stored securely
- [ ] Environment validation passes on boot (no missing required vars)

## Configuration
- [ ] `.env.example` updated for any new vars
- [ ] Railway/production env vars set and verified

## Smoke Test
- [ ] `./scripts/smoke-test.sh` passes against production URL

## Final Gate
- [ ] `./scripts/check-repo-health.sh` clean
- [ ] CI green (lint + typecheck + repo health)
