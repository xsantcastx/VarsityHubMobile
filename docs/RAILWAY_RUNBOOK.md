# Railway Deployment Runbook

This runbook captures everything needed to reliably build, run, verify, and troubleshoot the VarsityHub backend on Railway.

## Overview
- Container: Built from `server/Dockerfile`
- Startup: `./start.sh` (runs Prisma migrations with retries, then boots the server)
- Port/Host: Binds to `process.env.PORT` on `0.0.0.0`
- Routes: Mounted at root (e.g., `/auth/*`, `/users/*`, `/health`) — NOT under `/api`
- Health: `/health` returns 200 when DB reachable; returns 503 when DB is unreachable (includes integration summary)

## One-Time Service Settings
- Start Command (Service → Settings):
  - Leave blank (preferred, uses Dockerfile `CMD ["./start.sh"]`)
  - OR explicitly set to `./start.sh`
  - DO NOT set to `node dist/index.js` (that skips DB retry logic)

## Environment Variables (Required)
Set these in the Railway Dashboard → Variables (or via CLI):
- `DATABASE_URL` (see below)
- `JWT_SECRET`
- `STRIPE_SECRET_KEY` (and `STRIPE_WEBHOOK_SECRET`)
- SMTP: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (or your provider’s equivalents)
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional: `SENTRY_DSN`, `ALLOWED_ORIGINS`, `GOOGLE_MAPS_API_KEY`

## DATABASE_URL Selection
Choose ONE form based on where your API and DB services live:
- Same Railway Environment (preferred):
  - Use Internal URL from DB → Connect tab
  - Example: `postgresql://user:pass@postgres-XXXX.railway.internal:5432/railway`
- Different Environment OR Public Connection:
  - Use the Public URL and append SSL: `?sslmode=require`
  - Example: `postgresql://user:pass@containers-XXXXX.railway.app:5432/railway?sslmode=require`

## Redeploy + Logs (CLI)
```sh
railway redeploy
railway logs --tail 200
```
Expected healthy logs:
- `[startup] Applying Prisma migrations (up to 20 retries)…`
- `🚀 Server listening on port 4000`
- `Cron: Game reminders scheduled (every hour)`

## Verify Endpoints
Replace with your actual subdomain shown by `railway status`.
```sh
SERVICE_URL="https://<your-service>.up.railway.app"

# DB-aware health: 200 when DB OK, 503 if DB unreachable
curl -i "$SERVICE_URL/health"

# Unauthed me: 401 expected without token
curl -i "$SERVICE_URL/auth/me"
```

## Mobile Client Base URL
The app reads `EXPO_PUBLIC_API_URL` at runtime. If your backend host differs from the default in `api/http.ts`:
```sh
echo "EXPO_PUBLIC_API_URL=$SERVICE_URL" >> .env
npm run start
```

## Troubleshooting
- Prisma P1001 (can’t reach database):
  - Ensure API and DB are in the same Railway Environment when using internal URL
  - Otherwise use Public URL with `?sslmode=require`
  - Confirm Start Command uses `./start.sh` to enable migrate retries
- `/health` returns 503:
  - DB still unreachable — revisit `DATABASE_URL` host and SSL params
- 404 from Railway edge (“Application not found”):
  - Build failed or service not running; open dashboard and inspect build logs
- Routes not found under `/api/*`:
  - Use root-mounted paths: `/auth/*`, `/users/*`, `/health`, etc.

## Useful Local Checks
Quick DB connectivity check (uses `server/scripts/check-db.js`):
```sh
cd server
DATABASE_URL="<your-db-url>" node scripts/check-db.js
```
Expected: `✅ Database connected. SELECT 1 ok.`
