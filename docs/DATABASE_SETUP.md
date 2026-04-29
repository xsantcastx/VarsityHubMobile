# PostgreSQL Database Setup

This project is designed so production data is reached through the API service,
not directly from clients or checked-in tooling.

## Intended Production Model

- `server` talks to Postgres through `DATABASE_URL`
- That runtime URL should be the Railway internal/private host
- Mobile and web clients should only know the API host
- Direct public DB access is an exceptional admin action, not the default path

## What To Verify

### API runtime

Confirm in Railway that the API service has:

- `DATABASE_URL` set
- the host is the Railway internal Postgres host
- no DB credential is exposed in any `EXPO_PUBLIC_*` variable

### Local/admin workflows

Prefer running database-adjacent commands through Railway on the API service:

```bash
cd server
railway service api
railway run npx prisma migrate status
railway run npx prisma migrate deploy
railway run npx prisma db pull
```

### Temporary local inspection

If you need Prisma Studio or a desktop SQL client against production:

1. Create a temporary external admin connection in Railway
2. Use it only for the current task
3. Never save it to the repo
4. Revoke or rotate it after use

## Common Tasks

### Generate Prisma client

```bash
cd server
npx prisma generate
```

### Backups

Use Railway-managed backups from the Postgres service dashboard. Avoid storing
manual backup connection strings in local scripts or docs.

### Monitoring

Use Railway Metrics and Logs for:

- CPU
- memory
- storage growth
- failed connections

## Security Rules

- Never commit a live `postgresql://...` URL
- Never commit a production Railway proxy DB host
- Never document a public DB URL as the routine production path
- Treat any checked-in DB password as a security incident

## Resources

- Railway PostgreSQL docs: https://docs.railway.app/databases/postgresql
- Prisma PostgreSQL docs: https://www.prisma.io/docs/concepts/database-connectors/postgresql
