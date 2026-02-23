# Railway Environment Variables Setup

**Status:** Action Required  
**Date:** December 3, 2025  
**Platform:** Railway  
**Goal:** Load all production secrets before QA & deployment

---

## Quick Start (5 minutes)

### Prerequisites
- Railway CLI installed: `npm i -g @railway/cli`
- Connected to VarsityHub project: `railway link`

### View Current Status
```bash
railway variables list
```

This shows all currently configured variables. Check for these critical ones:

---

## Critical Secrets (⚠️ MUST CONFIGURE BEFORE LAUNCH)

### 1. Email Service (SendGrid)
**Status:** Check current setup
```bash
railway variables get SENDGRID_API_KEY
```

**If missing, add:**
```bash
railway variables set SENDGRID_API_KEY "SG.xxxxx"
railway variables set SENDGRID_VERIFICATION_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_PASSWORD_RESET_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID "d-xxxxx"
railway variables set SENDGRID_TEAM_INVITE_TEMPLATE_ID "d-xxxxx"
```

**Get your values from:**
1. SendGrid Dashboard: https://app.sendgrid.com
2. Settings → API Keys
3. Dynamic Templates section for template IDs

### 2. Stripe (Payment Processing)
**Status:** Check current setup
```bash
railway variables get STRIPE_SECRET_KEY
```

**If missing, add:**
```bash
railway variables set STRIPE_PUBLIC_KEY "pk_live_xxxxx"
railway variables set STRIPE_SECRET_KEY "sk_live_xxxxx"
```

**Get your keys from:**
1. Stripe Dashboard: https://dashboard.stripe.com
2. Developers → API Keys
3. Use live keys for production

### 3. JWT Secret (Authentication)
**Status:** Check current setup
```bash
railway variables get JWT_SECRET
```

**If using default, change it:**
```bash
# Generate a strong random value (32+ chars)
openssl rand -base64 32
# Then set:
railway variables set JWT_SECRET "your-generated-secret"
```

### 4. Twilio (SMS - Optional)
**Status:** Only if SMS verification needed
```bash
railway variables get TWILIO_ACCOUNT_SID
```

**If you want SMS, add:**
```bash
railway variables set TWILIO_ACCOUNT_SID "ACxxxxx"
railway variables set TWILIO_AUTH_TOKEN "xxxxx"
railway variables set TWILIO_FROM_PHONE "+1234567890"
```

**Get your values from:**
1. Twilio Console: https://www.twilio.com/console
2. Account info section
3. Phone number with SMS capability

### 5. Cloudinary (Image/Video Upload)
**Status:** Check current setup
```bash
railway variables get CLOUDINARY_URL
```

**If missing, add:**
```bash
railway variables set CLOUDINARY_URL "cloudinary://key:secret@cloudname"
```

**Get your URL from:**
1. Cloudinary Dashboard: https://cloudinary.com
2. Settings → API Environment variable
3. Copy the full CLOUDINARY_URL

### 6. Error Tracking (Sentry)
**Status:** Recommended but not critical
```bash
railway variables get SENTRY_DSN
```

**If you have Sentry, add:**
```bash
railway variables set SENTRY_DSN "https://key@sentry.io/project"
```

---

## Verification Commands

### Test Health Endpoint
After setting variables, restart the service and check:
```bash
curl https://varsityhub-api.up.railway.app/health | jq .integrations
```

**Expected output (all should be true):**
```json
{
  "database": true,
  "jwt": true,
  "cloudinary": true,
  "twilio": false,  // OK to be false (optional)
  "stripe": true,
  "sendgrid": true,
  "googleOAuth": true,
  "googleMaps": true,
  "sentry": false   // OK to be false (optional)
}
```

**If any critical service shows false:**
1. Check the variable is set: `railway variables list`
2. Verify the value is correct (no typos)
3. Check the format (API key vs URL vs secret)
4. Restart the app: `railway up` or redeploy

### Test Email
```bash
curl -X POST https://varsityhub-api.up.railway.app/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected:** `{ "success": true }`  
**If fails:** Check SENDGRID_API_KEY + SENDGRID_VERIFICATION_TEMPLATE_ID

### Test Database
```bash
curl https://varsityhub-api.up.railway.app/health | jq .integrations.database
```

**Expected:** `true`  
**If false:** DATABASE_URL not set or connection failing

---

## Environment Variables Reference

### Required for Production

| Variable | Type | Example | Source |
|----------|------|---------|--------|
| `DATABASE_URL` | Connection String | `postgresql://user:pass@host/db` | Railway PostgreSQL plugin |
| `NODE_ENV` | String | `production` | Set to production |
| `STRIPE_SECRET_KEY` | API Key | `sk_live_xxxxx` | Stripe Dashboard |
| `JWT_SECRET` | Random String | (32+ char random) | Generate yourself |
| `SENDGRID_API_KEY` | API Key | `SG.xxxxx` | SendGrid Dashboard |
| `SENDGRID_VERIFICATION_TEMPLATE_ID` | ID | `d-xxxxx` | SendGrid Templates |

### Important for Features

| Variable | Type | Example | Required | Source |
|----------|------|---------|----------|--------|
| `STRIPE_PUBLIC_KEY` | API Key | `pk_live_xxxxx` | Yes | Stripe Dashboard |
| `SENDGRID_PASSWORD_RESET_TEMPLATE_ID` | ID | `d-xxxxx` | Yes | SendGrid Templates |
| `SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID` | ID | `d-xxxxx` | Recommended | SendGrid Templates |
| `SENDGRID_TEAM_INVITE_TEMPLATE_ID` | ID | `d-xxxxx` | Yes | SendGrid Templates |
| `CLOUDINARY_URL` | URL | `cloudinary://...` | Yes | Cloudinary Dashboard |
| `GOOGLE_OAUTH_CLIENT_IDS` | CSV | `xxx.apps.googleusercontent.com` | Yes | Google Cloud |
| `GOOGLE_MAPS_API_KEY` | API Key | `AIzaSyxxxxx` | Yes | Google Cloud |

### Optional Services

| Variable | Type | Required | Source |
|----------|------|----------|--------|
| `TWILIO_ACCOUNT_SID` | ID | No | Twilio Console |
| `TWILIO_AUTH_TOKEN` | Token | No | Twilio Console |
| `TWILIO_FROM_PHONE` | Phone | No | Twilio Console |
| `SENTRY_DSN` | URL | No | Sentry Dashboard |
| `ADMIN_EMAILS` | CSV | No | Your choice |

---

## Step-by-Step Setup (10 minutes)

### For SendGrid
1. Go to https://sendgrid.com
2. Sign up or log in
3. Navigate to Settings → API Keys
4. Create new API key (select "Mail Send" permission)
5. Copy the key (shown only once!)
6. Run: `railway variables set SENDGRID_API_KEY "SG.xxxxx"`
7. Go to Dynamic Templates section
8. Copy each template ID and set:
   - `SENDGRID_VERIFICATION_TEMPLATE_ID`
   - `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
   - `SENDGRID_TEAM_INVITE_TEMPLATE_ID`

### For Stripe
1. Go to https://stripe.com
2. Sign in to your account
3. Go to Developers → API Keys
4. Copy the published key (pk_live_xxx)
5. Copy the secret key (sk_live_xxx)
6. Run both:
   - `railway variables set STRIPE_PUBLIC_KEY "pk_live_xxxxx"`
   - `railway variables set STRIPE_SECRET_KEY "sk_live_xxxxx"`

### For JWT Secret
1. Generate random: `openssl rand -base64 32`
2. Copy the output
3. Run: `railway variables set JWT_SECRET "your-generated-value"`

### For Cloudinary
1. Go to https://cloudinary.com
2. Sign in to your account
3. Go to Settings → API Environment variable
4. Copy the full URL (starts with "cloudinary://")
5. Run: `railway variables set CLOUDINARY_URL "cloudinary://..."`

### For Google Services
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create or select your project
3. Enable "Google Maps API" and "Google OAuth 2.0"
4. Create API keys and OAuth credentials
5. Run:
   - `railway variables set GOOGLE_OAUTH_CLIENT_IDS "xxx.apps.googleusercontent.com"`
   - `railway variables set GOOGLE_MAPS_API_KEY "AIzaSyxxxxx"`

---

## Verification Checklist

After setting all variables:

- [ ] `railway variables list` shows all critical vars
- [ ] `curl /health | jq .integrations` all required are true
- [ ] `curl /auth/test-email` returns {"success": true}
- [ ] Can register account and receive verification email
- [ ] Can checkout with Stripe test card
- [ ] Errors are logged to Sentry (optional but helpful)

---

## Troubleshooting

### Variable not appearing
```bash
# Try fetching it directly
railway variables get SENDGRID_API_KEY

# If still missing, set it again
railway variables set SENDGRID_API_KEY "SG.xxxxx"

# Restart the app
railway up --redeploy
```

### Health check fails
```bash
# Check what's missing
curl https://your-api.up.railway.app/health | jq .

# Look for any false values in integrations
# Set the missing variable and redeploy
```

### Email not sending
```bash
# Verify the key is set
railway variables get SENDGRID_API_KEY

# Check template ID is set
railway variables get SENDGRID_VERIFICATION_TEMPLATE_ID

# Test the endpoint
curl -X POST https://your-api.up.railway.app/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com"}'
```

### Stripe errors
```bash
# Make sure you're using live keys, not test keys
railway variables get STRIPE_SECRET_KEY
# Should start with sk_live_ (not sk_test_)

# For production payments, use live keys
# For testing, create a separate environment with test keys
```

---

## Security Best Practices

✅ **DO:**
- Store all secrets in Railway environment variables
- Use live API keys for production environment
- Rotate JWT_SECRET regularly
- Enable 2FA on all provider accounts
- Monitor API usage and spending

❌ **DON'T:**
- Commit API keys to git
- Share secrets in Slack/email
- Use test keys in production
- Reuse the same key across environments
- Hardcode values in code

---

## Next Steps

1. **Now:** Set all variables listed above
2. **Verify:** Run health check and test email
3. **After:** Run verify-production-ready.sh
4. **Then:** Exercise critical user flows (register → verify → post)
5. **Finally:** QA sign-off before launch

---

## Support

If you have questions about getting specific API keys:
- **SendGrid:** https://docs.sendgrid.com/ui/account-and-settings/api-keys
- **Stripe:** https://stripe.com/docs/keys
- **Twilio:** https://www.twilio.com/docs/usage/tutorials/how-to-use-your-twilio-account-sid-and-auth-token
- **Cloudinary:** https://cloudinary.com/documentation/account_management
- **Google:** https://cloud.google.com/docs/authentication/api-keys

---

**Configuration Status:** ⏳ Waiting for Railway setup  
**Next Action:** `railway variables list` → add missing vars → `railway up --redeploy`

