# PostgreSQL Database on Railway - Guide

This document intentionally avoids storing live connection strings, passwords,
or Railway proxy hosts in the repo.

## Security Baseline

- Production runtime must use the API service's private `DATABASE_URL`
- Mobile/web clients must never receive DB credentials
- Public Postgres proxy access should be disabled unless you deliberately need a
  short-lived admin session
- Any temporary external DB access should be created in Railway, used briefly,
  then removed

## Safe Access Patterns

### From the API service

Use Railway-run commands from the API service so the existing private
`DATABASE_URL` is used inside Railway's network:

```bash
cd server
railway service api
railway run npx prisma migrate status
railway run npx prisma db pull
railway run npx prisma generate
```

### Read-only diagnostics

Prefer these over opening raw Postgres from a laptop:

```bash
cd server
railway service api
railway run npx prisma migrate status
railway run -- node -e "console.log('DATABASE_URL present:', !!process.env.DATABASE_URL)"
```

### Local admin tools

If you must use Prisma Studio, pgAdmin, or DBeaver against production:

1. Create a temporary external admin connection in Railway
2. Scope it as narrowly as possible
3. Never commit the URL or paste it into repo docs/scripts
4. Revoke/rotate it after use

## Common Operations

### Check migration status

```bash
cd server
railway service api
railway run npx prisma migrate status
```

### Apply migrations

```bash
cd server
railway service api
railway run npx prisma migrate deploy
```

### Generate Prisma client

```bash
cd server
npx prisma generate
```

### Backups

Use Railway-managed backups from the Postgres service dashboard. If you need a
manual dump, run it from a controlled admin environment and do not save the
connection string in this repository.

## Troubleshooting

### App cannot reach the database

1. Confirm the API service has `DATABASE_URL` set
2. Confirm the host is the Railway internal host, not a public proxy
3. Check Railway deploy logs for Prisma startup errors
4. Check Postgres health/metrics in Railway

### Local tool cannot connect

1. Do not assume production should be publicly reachable
2. Create temporary access only if operationally necessary
3. Prefer using `railway run` from the API service instead

## Audit Reminder

If you see any of these checked into source, treat it as a security bug:

- `postgresql://...` with a real password
- production Railway proxy DB hosts
- instructions that normalize a public DB URL as the routine production path

**Database Status:** ✅ HEALTHY
**Last Checked:** November 1, 2025
