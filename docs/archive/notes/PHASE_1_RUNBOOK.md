# Phase 1 Runbook: Production Configuration (45 min - 1 hour)

## Overview

Load 6 critical service secrets into Railway, verify health endpoint, confirm email delivery. After this phase, the platform is production-ready for Phase 2 comprehensive testing.

**Timeline:** 45 min - 1 hour  
**Owner:** DevOps Lead  
**Blocking:** Phase 2 cannot start until all integrations return `true`

---

## Step 1: Context Check (5 min)

### What you need before starting:

- [ ] Access to Railway dashboard (https://railway.app)
- [ ] Production project selected in Railway CLI
- [ ] API deployment ready in Railway (should already be running)
- [ ] SendGrid account with created template IDs
- [ ] Stripe account with API keys
- [ ] Cloudinary account with CLOUDINARY_URL
- [ ] Google Cloud project with Maps API & OAuth credentials
- [ ] Optional: Twilio account, Sentry project

### Verify CLI access:

```bash
railway login
railway project
# Should show your production project
```

---

## Step 2: Gather All Secrets (10 min)

Before setting variables, collect all values. Reference **RAILWAY_SECRETS_SETUP.md** for detailed descriptions.

### SendGrid (Required)

```
SENDGRID_API_KEY = sk-proj-xxxxx
SENDGRID_EMAIL_VERIFICATION_TEMPLATE_ID = d-xxxxx
SENDGRID_PASSWORD_RESET_TEMPLATE_ID = d-xxxxx
SENDGRID_TEAM_INVITE_TEMPLATE_ID = d-xxxxx
SENDGRID_FROM_EMAIL = noreply@varsityhub.app (or your domain)
```

### Stripe (Required)

```
STRIPE_PUBLIC_KEY = pk_live_xxxxx
STRIPE_SECRET_KEY = sk_live_xxxxx
```

### JWT (Required)

```
JWT_SECRET = [generate: openssl rand -hex 32]
```

### Cloudinary (Required)

```
CLOUDINARY_URL = cloudinary://key:secret@cloud-name
```

### Google (Required)

```
GOOGLE_MAPS_API_KEY = xxxxx
GOOGLE_OAUTH_CLIENT_IDS = client1.apps.googleusercontent.com,client2.apps.googleusercontent.com
```

### Twilio (Optional - only if using SMS)

```
TWILIO_ACCOUNT_SID = ACxxxxx
TWILIO_AUTH_TOKEN = xxxxx
TWILIO_PHONE_NUMBER = +1234567890
```

### Sentry (Optional - for error tracking)

```
SENTRY_DSN = https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

---

## Step 3: Load Secrets into Railway (20-25 min)

### Option A: CLI (Recommended for batch operations)

#### View current variables:

```bash
railway variables list
```

#### Set SendGrid variables:

```bash
railway variables set SENDGRID_API_KEY "sk-proj-xxxxx"
railway variables set SENDGRID_EMAIL_VERIFICATION_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_PASSWORD_RESET_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_FROM_EMAIL "noreply@varsityhub.app"
```

#### Set Stripe variables:

```bash
railway variables set STRIPE_PUBLIC_KEY "pk_live_xxxxx"
railway variables set STRIPE_SECRET_KEY "sk_live_xxxxx"
```

#### Set other required variables:

```bash
railway variables set JWT_SECRET "$(openssl rand -hex 32)"
railway variables set CLOUDINARY_URL "cloudinary://key:secret@cloud-name"
railway variables set GOOGLE_MAPS_API_KEY "xxxxx"
railway variables set GOOGLE_OAUTH_CLIENT_IDS "client1.apps.googleusercontent.com,client2.apps.googleusercontent.com"
```

#### (Optional) Set Twilio:

```bash
railway variables set TWILIO_ACCOUNT_SID "ACxxxxx"
railway variables set TWILIO_AUTH_TOKEN "xxxxx"
railway variables set TWILIO_PHONE_NUMBER "+1234567890"
```

#### (Optional) Set Sentry:

```bash
railway variables set SENTRY_DSN "https://xxxxx@xxxxx.ingest.sentry.io/xxxxx"
```

### Option B: Railway Dashboard (if CLI not available)

1. Go to https://railway.app → Your Project → Variables
2. Click "New Variable" for each secret
3. Enter KEY and value (or reference)
4. Save

---

## Step 4: Redeploy API Service (5-10 min)

After setting all variables, redeploy so they take effect:

```bash
railway up
# or in Railway dashboard: Deployments → Redeploy (top-right)
```

Wait for deployment to complete. Watch logs to confirm no errors:

```bash
railway logs
```

---

## Step 5: Verify Integration Health (5-10 min)

Once deployment is live, check that all integrations are active.

### Get your API URL:

```bash
railway domains
# Should show: https://your-api.railway.app (or custom domain)
```

### Check health endpoint:

```bash
curl https://your-api.railway.app/health | jq .integrations
```

### Expected output (all true):

```json
{
  "database": true,
  "jwt": true,
  "cloudinary": true,
  "stripe": true,
  "sendgrid": true,
  "googleOAuth": true,
  "googleMaps": true,
  "twilio": false, // OK if not using SMS
  "sentry": false // OK if not using error tracking
}
```

**✅ All required integrations = true** → Proceed to Step 6

**❌ Any required integration = false** → Check logs and fix (see Troubleshooting below)

---

## Step 6: Verify Email Delivery (5 min)

Confirm SendGrid is working with a test email:

```bash
curl -X POST https://your-api.railway.app/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test@example.com"}'
```

Expected response:

```json
{
  "success": true,
  "message": "Test email sent to your-test@example.com"
}
```

Check your email inbox within 1-2 minutes. You should receive a verification test email.

**✅ Email received** → Proceed to Phase 2

**❌ Email not received** → Check SendGrid logs, verify SENDGRID_FROM_EMAIL is whitelisted

---

## Step 7: Mark Completion (1 min)

Update **LAUNCH_CHECKLIST.md**:

```markdown
## Phase 1: Production Configuration

- [x] Load production secrets (SendGrid, Stripe, JWT, Cloudinary, Google, Twilio)
- [x] Verify /health endpoint (all integrations = true)
- [x] Test email delivery (confirmation received)
- [x] Redeploy and confirm green
```

---

## Troubleshooting

### Symptom: `/health` returns `"database": false`

**Likely cause:** DATABASE_URL not set or unreachable  
**Fix:**

1. Verify `DATABASE_URL` in railway variables list
2. Confirm production database is running (Railway → Postgres plugin)
3. Test connection: `psql $DATABASE_URL -c "SELECT 1"`
4. Redeploy and retry

### Symptom: `/health` returns `"sendgrid": false`

**Likely cause:** SENDGRID_API_KEY invalid or permissions issue  
**Fix:**

1. Double-check API key is correct in SendGrid dashboard
2. Confirm key has permission for Mail Send API
3. Try test-email endpoint first to get detailed error
4. Redeploy and retry

### Symptom: `/health` returns `"stripe": false`

**Likely cause:** STRIPE_SECRET_KEY invalid or test key instead of live  
**Fix:**

1. Confirm using live keys (sk*live*), not test keys (sk*test*)
2. Verify key in Stripe dashboard
3. Redeploy and retry

### Symptom: `/health` returns `"googleOAuth": false`

**Likely cause:** GOOGLE_OAUTH_CLIENT_IDS not set or format incorrect  
**Fix:**

1. Format should be: `client1.apps.googleusercontent.com,client2.apps.googleusercontent.com`
2. Verify client IDs in Google Cloud console
3. Redeploy and retry

### Symptom: Test email endpoint returns error

**Likely cause:** SendGrid template ID incorrect or template doesn't exist  
**Fix:**

1. Go to SendGrid → Email API → Dynamic Templates
2. Verify template IDs exist and are active
3. Copy exact IDs from SendGrid: `d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
4. Update variables and redeploy

### Symptom: Deployment fails after setting variables

**Likely cause:** Invalid secret format or special characters  
**Fix:**

1. For complex secrets with special characters, use quotes: `"value"`
2. For URLs with `@` or `&`, wrap in double quotes
3. Check railway logs for parsing errors
4. Retry deployment

---

## Quick Command Reference

```bash
# Check current setup
railway variables list

# View full .env in production
railway variables get SENDGRID_API_KEY  # etc for each

# Check API health
curl https://your-api.railway.app/health | jq .

# View deployment logs
railway logs --tail=50

# Redeploy after secret changes
railway up

# Trigger redeploy from CLI (no code changes)
railway redeploy

# SSH into running instance (if needed)
railway shell
```

---

## Success Checklist

Before proceeding to Phase 2, confirm:

- [ ] All 6 required secrets loaded into Railway
- [ ] Deployment completed without errors
- [ ] `/health` endpoint returns all integrations = true
- [ ] Test email delivered successfully
- [ ] LAUNCH_CHECKLIST.md Phase 1 marked complete
- [ ] Team notified Phase 2 can begin

---

## Next Phase

Once Phase 1 is complete:

1. QA team reviews AUTH_ROLES_TEST_PLAN.md
2. Distribute test assignments (Parts 1-4)
3. Execute Phase 2 comprehensive testing (5-6 hours)
4. Log results in AUTH_ROLES_EXECUTION_LOG.md
5. Get team sign-offs

**Reference:** LAUNCH_CHECKLIST.md (overall schedule), CRITICAL_FLOWS_TEST.md (6 critical flows), QA_CHECKLIST.md (8 sections)

---

## Questions?

- Stuck on secrets? Check RAILWAY_SECRETS_SETUP.md for detailed descriptions
- Need help with Railway? See railway documentation: https://docs.railway.app
- Error in health check? Look at server/src/routes/health.ts (line 11) for integration checks
