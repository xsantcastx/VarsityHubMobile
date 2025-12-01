# VarsityHub Mobile & API

This repository contains the Expo mobile app and the Node/Express API.

## Key Docs

- Implementation guide: `IMPLEMENTATION_GUIDE.md`
- Launch checklist: `PRODUCTION_LAUNCH_CHECKLIST.md`
- Railway deployment runbook: `docs/RAILWAY_RUNBOOK.md`

## Quick Verify (Backend)

After deploying to Railway, verify endpoints:

```
SERVICE_URL="https://<your-service>.up.railway.app"
curl -i "$SERVICE_URL/health"     # 200 OK when DB reachable
curl -i "$SERVICE_URL/auth/me"    # 401 Unauthorized without token
```

Local DB connectivity check:

```
cd server
DATABASE_URL="postgresql://..." node scripts/check-db.js
```

## Start Mobile

```
npm install
npm run start
```

