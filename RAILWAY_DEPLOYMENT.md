# Railway Production Deployment

## Current Status
✅ Client refresh-token system implemented
✅ Sample-feed feature flag ready
✅ Migration script prepared

## Pending Actions

### 1. Deploy Prisma Migrations
Run as a **one-off command** in Railway Dashboard:

**Service → Settings → One-off Command:**
```bash
./scripts/railway-deploy-migrations.sh
```

**Or via CLI (if Railway shell is accessible):**
```bash
railway shell
cd server
npx prisma migrate deploy
npx prisma generate
exit
```

This will apply the security tables migration:
- `refresh_tokens` table with indexes
- `audit_logs` table with indexes

### 2. Rotate JWT_SECRET
**Railway Dashboard → Variables → Edit JWT_SECRET:**

Set to:
```
eVNlvOV3hIIlFcTqLInPCQCH53lnI7Jr1qOoi9tUZcdotVJnwytDPsnU4jDTXOm8
```

After setting, the service will auto-redeploy with the new secret.

### 3. Verify Deployment
```bash
curl -i https://api-production-8ac3.up.railway.app/health
```

Expected: `"status":"healthy"` with `"database":true` and `"jwt":true`

### 4. Test Refresh Flow

**Login and get tokens:**
```bash
curl -X POST https://api-production-8ac3.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com","password":"Admin2025!"}'
```

Response should include:
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": {...}
}
```

**Test refresh endpoint:**
```bash
curl -X POST https://api-production-8ac3.up.railway.app/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token_from_login>"}'
```

Expected: New `access_token` and rotated `refresh_token`

## Security Checklist
- [x] Strong JWT_SECRET generated (48-byte base64)
- [ ] JWT_SECRET set in Railway
- [ ] Database migrations deployed
- [ ] Refresh token endpoints live
- [ ] Client auto-refresh tested
- [ ] Audit logs recording events

## Feature Flags
- `EXPO_PUBLIC_FORCE_SAMPLE_FEED=true` - Show sample events in feed (demos/tests)

---

**Generated:** December 2, 2025  
**Security Grade:** A- (with pending deployment)
