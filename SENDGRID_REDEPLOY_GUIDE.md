# SendGrid Email Fix – Railway Redeploy Guide

**Status**: Code ready; Railway needs fresh deploy  
**Last commit**: `0690e41` (health version bumped to `v2025.12.17-rw-redeploy`)  
**Production URL**: `https://api-production-8ac3.up.railway.app`

---

## ⚡ Quick Action – Trigger Railway Redeploy

Railway isn't picking up the latest code or environment variables. Here's how to force a clean rebuild:

### Option A: CLI Redeploy (Fastest)

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
railway redeploy --service api
```

**Wait 3–5 minutes for build/deploy.**

### Option B: Dashboard Redeploy

1. Visit [Railway Dashboard → capable-trust project](https://railway.app/project/capable-trust)
2. Select the **api** service
3. **Deployments** tab → click the **⋯** menu on the latest deployment → **Redeploy**
4. Confirm and wait for build

---

## ✅ Verify Deployment

Once Railway shows "✓ Deployed" (green checkmark):

```bash
# 1. Check health endpoint shows new version and sendgrid=true
curl -s https://api-production-8ac3.up.railway.app/health | jq '{version, sendgrid: .integrations.sendgrid, ready}'

# Expected:
# {
#   "version": "v2025.12.17-rw-redeploy",
#   "sendgrid": true,
#   "ready": true
# }

# 2. Test password reset email
curl -s -X POST https://api-production-8ac3.up.railway.app/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com"}'

# Expected:
# {"ok": true}
```

**Check your email inbox** (emilmancero@gmail.com) for the password reset email within ~10 seconds.

---

## 🐛 If Email Still Doesn't Arrive

### Step 1: Verify SENDGRID_API_KEY in Railway

```bash
railway variables --service api | grep SENDGRID_API_KEY
```

**Should show**: `SENDGRID_API_KEY=SG.u2pg...` (truncated)

If missing:

```bash
railway variables --service api --set SENDGRID_API_KEY=SG.REDACTED
```

Then **redeploy** again.

### Step 2: Check Logs

```bash
railway logs --service api --tail 100
```

Look for:

- `[startup] ✓ All required env vars present`
- `✅ SendGrid email service initialized`
- `[HEALTH CHECK] SENDGRID_API_KEY length=...`

If you see `⚠️ SENDGRID_API_KEY not set`, the variable isn't being passed to the container.

### Step 3: Verify Template ID

```bash
railway variables --service api | grep SENDGRID_PASSWORD_RESET_TEMPLATE_ID
```

**Should show**: `d-0f8c1353d4d44599bff28635cd39c167`

If missing:

```bash
railway variables --service api --set SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-0f8c1353d4d44599bff28635cd39c167
```

---

## 📋 Summary of Changes Made

1. **Health endpoint**: Now reports `sendgrid: true` if API key exists (missing templates = warnings only)
2. **Dockerfile**: Added `BUILD_REVISION` ARG to force Railway cache-bust
3. **Dotenv behavior**: Only loads `.env` in dev; production uses Railway variables exclusively
4. **CI throttling**: Snyk workflow now has path filters and `[skip snyk]` support

---

## 🚀 Next Steps

1. **Redeploy** via CLI or dashboard (choose Option A or B above)
2. **Verify** health endpoint shows new version
3. **Test** password reset and confirm email arrives
4. If issues persist, grab logs and we'll debug the SendGrid API call directly
