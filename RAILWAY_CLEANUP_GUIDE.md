# Railway Cleanup & Health Monitoring Guide

**Objective:** Disable unused services (rare-liberation, varsityhub, VarsityHubMobile) and keep only the `api` service. Align with server/Dockerfile and automated health checks.

---

## 📋 Pre-Cleanup Verification

Before disabling services, verify current health status:

```bash
# Check current health endpoint
curl -s https://api-production-8ac3.up.railway.app/health | jq

# Expected response (production setup):
# {
#   "status": "ok",
#   "ready": false,
#   "uptime": "123456"
# }

# Or use the automated script:
bash scripts/railway-health-check.sh
```

**Status meaning:**
- `status: "ok"` → API is running and responding
- `ready: false` → May indicate pending migrations or SendGrid setup (expected initially)
- `ready: true` → API is fully initialized and ready

---

## 🛑 Step 1: Disable Unused Services (Dashboard)

1. Open Railway Dashboard: https://railway.app
2. Navigate to your VarsityHub project
3. Go to **Settings → Deployments → Services**

For each service:

### ✅ Keep: `api` service
- Ensure **Auto Deploy** is **enabled**
- Source: GitHub (xsantcastx/VarsityHubMobile) → `/server/Dockerfile`
- This is the only service needed

### ❌ Disable: `rare-liberation`
- Toggle off **Auto Deploy** or delete service
- This is a stale/test service

### ❌ Disable: `varsityhub`
- Toggle off **Auto Deploy** or delete service
- This is a stale/test service

### ❌ Disable: `VarsityHubMobile`
- Toggle off **Auto Deploy** or delete service
- Mobile builds go through EAS, not Railway

---

## 🚀 Step 2: Redeploy API Service

After disabling services:

1. Select **`api` service** in Railway dashboard
2. Click **Redeploy** to trigger a fresh build
3. Monitor the build logs to verify success

### Required build configuration

| Setting | Value | Why |
| --- | --- | --- |
| **Root directory** | `server` | Keeps deployments scoped to the API code + package-lock |
| **Install command** | `npm ci` | Ensures prod deps (typescript/tsx) are installed even with `--omit=dev` defaults |
| **Build command** | `npm run build` | Runs `prisma generate` + `tsc -p .` |
| **Start command** | `npm start` | Launches compiled server (`node dist/index.js`) |
| **Post-deploy (optional)** | `npx prisma migrate deploy` | Applies DB schema changes before traffic hits |

> Tip: If Railway still caches an old build, trigger **Deploy from scratch** so the new dependency graph is used.

Expected build output:
```
[1/4] FROM node:20-bookworm-slim
[2/4] WORKDIR /app
[3/4] COPY server/package*.json ./ && npm ci
[4/4] npm run build && npm prune --omit=dev
✓ Build successful
```

---

## ✅ Step 3: Verify Health Endpoint

Once API redeployed:

```bash
# Quick check
curl -s https://api-production-8ac3.up.railway.app/health | jq '.status'
# Expected: "ok"

# Full report
bash scripts/railway-health-check.sh

# Expected output:
# ✅ API status is OK
# ✅ Uptime visible
# ⚠️ SendGrid templates pending (expected if not configured yet)
```

---

## 📊 Automated Health Monitoring

Once cleanup is complete, monitoring is automatic:

### **Local Health Check**
```bash
bash scripts/railway-health-check.sh                 # Full report
bash scripts/railway-health-check.sh --ci             # Exit code only
bash scripts/railway-health-check.sh --monitor        # Watch every 30s
```

### **CI/CD Health Monitoring**
- **Location:** `.github/workflows/railway-health.yml`
- **Frequency:** Hourly (0 * * * *)
- **Triggers:**
  - Scheduled: Every hour
  - On push to main
  - Manual: `workflow_dispatch`
- **Actions:**
  - ✅ Passes if `/health` returns status="ok"
  - 🔴 Creates GitHub issue if health check fails
  - 📊 Uploads detailed report to artifacts

### **View Status in GitHub**
1. Go to **Actions** tab
2. Find **Railway Health Check** workflow
3. See last run status and artifacts

---

## 🔧 Environment Variables

Ensure these are set in Railway **Env Vars**:

### Required (for API to start)
```
NODE_ENV=production
PORT=3000
```

### Database (if applicable)
```
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Email Service (SendGrid)
```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
```

### OAuth (Apple/Google)
```
APPLE_CLIENT_ID=com.xsantcastx.varsityhub
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

---

## 🚨 Alerts & Monitoring

### What triggers an alert?

The automated health check will fail (and create a GitHub issue) if:
- HTTP request to `/health` returns non-200
- Endpoint is unreachable or times out
- API service is down or restarting

### Example failure alert:
```
🚨 Railway API Health Check Failed

The Railway API health endpoint is not responding. 
Check the API deployment and logs.
```

### What to do if alert fires:

1. **Check Railway Logs:**
   - Dashboard → API service → Logs tab
   - Look for crash/error messages

2. **Common issues:**
   - Env var missing → API won't start
   - Database unreachable → Migrations fail
   - Memory/CPU limit hit → Restart needed
   - Build failed → Check build logs

3. **Fix & redeploy:**
   - Fix issue (add env var, fix code, etc.)
   - Push to GitHub
   - Railway auto-redeploys (via Auto Deploy)
   - Health check verifies recovery

---

## 📈 Health Check Status Examples

### ✅ Healthy (API running, migrations done)
```json
{
  "status": "ok",
  "ready": true,
  "uptime": "3600"
}
```

### ⚠️ Initializing (API running, pending setup)
```json
{
  "status": "ok",
  "ready": false,
  "uptime": "30"
}
```
→ May take a few minutes. Health check will retry automatically.

### ❌ Unhealthy (API down or unresponsive)
```
HTTP 503 or timeout
```
→ GitHub issue created automatically. Check logs in Railway dashboard.

---

## 🔄 Integration with check-web-errors.sh

The existing `check-web-errors.sh` script (lines 36-44) already uses this health endpoint:

```bash
curl -s https://api-production-8ac3.up.railway.app/health
```

It flags failures as "Railway backend issue" automatically. Once cleanup is complete, it will only alert when the real API build breaks.

---

## ✨ Summary

| Step | Action | Verification |
|------|--------|--------------|
| 1 | Disable rare-liberation, varsityhub, VarsityHubMobile | Only `api` service has Auto Deploy enabled |
| 2 | Redeploy `api` service | Build logs show success |
| 3 | Run health check | `status: "ok"` in response |
| 4 | Confirm CI monitoring active | GitHub Actions → Railway Health Check workflow runs hourly |

Once complete: The repo is clean, health monitoring is automated, and you'll get alerts only when the API actually has issues. 🚀

---

## 📞 Quick Reference

- **Health endpoint:** `https://api-production-8ac3.up.railway.app/health`
- **Local check:** `bash scripts/railway-health-check.sh`
- **CI workflow:** `.github/workflows/railway-health.yml`
- **Dashboard:** https://railway.app
- **Docs:** `CONFIGURATION_AUDIT_COMPLETE.md` (sendgrid status: line 248)
