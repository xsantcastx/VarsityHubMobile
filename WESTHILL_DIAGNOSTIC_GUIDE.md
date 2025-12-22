# Westhill Search Issue - Diagnostic Action Plan

## Current Status
- ✅ Code: All organization search endpoints have `status: 'active'` filter
- ✅ Backend: Dockerfile, start.sh, index.ts all configured correctly
- ✅ Port handling: Server respects `$PORT` env var from Railway
- ✅ Frontend: Added error logging and "no results" message
- ❓ Unknown: Is Westhill in the database? Is the backend deployed?

## Why It "Worked Before" But Doesn't Now

Most likely causes:
1. **Backend not deployed** - New code (with Westhill search) hasn't been pushed to Railway yet
2. **Wrong API URL** - App is pointing to old/wrong API endpoint
3. **Westhill not in DB** - Organization doesn't exist or has status != 'active'
4. **Missing env vars** - Railway missing required environment variables

## Verification Steps (Do These in Order)

### Step 1: Verify Backend Deployment (5 min)
```bash
# Check if latest code is deployed to Railway
# Go to: https://railway.app → Your Project → API Service → Deployments
# 
# Look for:
# ✅ Latest deployment shows "Success"
# ✅ Deployment includes the search fixes
# ✅ Build logs show no errors
#
# If latest deployment is old or failed:
# → Git push to trigger redeploy: git push origin chore/deploy-checklist
```

### Step 2: Test Health Endpoint (2 min)
```bash
curl https://api-production-8ac3.up.railway.app/health

# Expected output (if working):
# {"status":"ok","database":"connected",...}
#
# If fails or returns error:
# → Check Railway logs for startup errors
# → Verify DATABASE_URL and other required env vars are set
```

### Step 3: Test Organization Search Endpoint (2 min)
```bash
curl "https://api-production-8ac3.up.railway.app/organizations?q=Westhill"

# Expected output:
# [] (empty array if not found)
# or
# [{"id":"...", "name":"Westhill High School", ...}]
#
# If error or timeout:
# → API is not working; check Railway logs
# → May need to restart/redeploy
```

### Step 4: Check if Westhill Exists in Database (5 min)
```bash
# Use the diagnostic script (requires local setup):
bash scripts/diagnose-westhill.sh

# Output shows:
# 1. API curl result (does search endpoint return Westhill?)
# 2. DB query result (is Westhill in the database?)
# 3. Config check (is app pointing to right API?)
```

### Step 5: Verify App Configuration (2 min)
- Rebuild app: `npm run build:mobile` or Expo CLI rebuild
- Ensure app uses correct API URL (check `api/http.ts` getApiBaseUrl())
- Test search in onboarding step 4

## If Still Not Working

**Collect and share:**
1. Output of health check: `curl -v https://api-production-8ac3.up.railway.app/health`
2. Output of search: `curl "https://api-production-8ac3.up.railway.app/organizations?q=test"`
3. Railway deployment logs (screenshot of Deployments tab)
4. Railway environment variables (screenshot of Variables tab, redact secrets)
5. Output of: `bash scripts/diagnose-westhill.sh`
6. What error message appears on the app (screenshot)

## Code Changes Made

Recent commits fixed:
- ✅ Removed "100 athletes" from Veteran plan
- ✅ Implemented S3 presigned URL signing
- ✅ Added error handling for 401 auth errors in onboarding
- ✅ Added "no results found" message to search UI
- ✅ Added console logging for search errors

These should all help diagnose the issue once deployed to Railway.
