# Production Environment Variables Verification Checklist

## Overview
Before submitting build 39 (v1.0.1) to App Review, verify that Railway (or your deployment platform) has all production environment variables correctly configured.

## Critical Variables for v1.0.1

### Email (SendGrid - REQUIRED for verification flow)
- [ ] **SENDGRID_API_KEY** 
  - Value: `SG.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
  - Status: ✓ Obtain from SendGrid dashboard → Settings → API Keys
  - Scope: Full access required
  
- [ ] **SENDGRID_VERIFICATION_TEMPLATE_ID** 
  - Value: `d-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
  - Status: ? Create template in SendGrid (see SENDGRID_TEMPLATE_SAMPLES.md)
  - Current: Need to upload & get ID
  
- [ ] **EMAIL_FROM** 
  - Value: `noreply@varsityhub.com` or `varsityhub@example.com`
  - Status: ? Should be verified sender in SendGrid
  - Current: Check SendGrid verified senders list
  
- [ ] **ADMIN_EMAILS** 
  - Value: `xsancastrillonx@hotmail.com,admin@varsityhub.com`
  - Status: ✓ List of comma-separated admin email addresses
  - Purpose: Admin notifications, alert recipients

### App Configuration
- [ ] **APP_BASE_URL**
  - Value: `https://varsityhub-backend-[env].railway.app` (or your deployed URL)
  - Status: ? Must match Railway deployment URL
  - Purpose: Email links, OAuth redirects, API base URL
  
- [ ] **NODE_ENV**
  - Value: `production`
  - Status: ✓ Must be production (not test/staging)
  - Purpose: Disables debug logging, enables optimizations

### Payment (Stripe - Required for Legend plan)
- [ ] **STRIPE_SECRET_KEY**
  - Current: `sk_test_...` (TEST KEY - ⚠️ MUST CHANGE)
  - Production: `sk_live_...`
  - Status: ❌ USING TEST KEY - MUST UPGRADE BEFORE SUBMISSION
  - How: Stripe Dashboard → Settings → API Keys → Copy Live Key
  
- [ ] **STRIPE_WEBHOOK_SECRET**
  - Current: `whsec_...` (TEST SECRET)
  - Production: Get from Webhooks endpoint
  - Status: ❌ MUST UPDATE with live webhook secret
  - How: Stripe Dashboard → Developers → Webhooks → [select endpoint] → Signing Secret
  
- [ ] **STRIPE_PRICE_VETERAN**
  - Value: `price_...` (live price ID)
  - Status: ? Verify in Stripe live products
  - Current Setup: ✓ Configured in .env.production.template
  
- [ ] **STRIPE_PRICE_LEGEND**
  - Value: `price_...` (live price ID)
  - Status: ? Verify in Stripe live products
  - Current Setup: ✓ Configured in .env.production.template

### Monitoring & Debugging (Optional but recommended)
- [ ] **SENTRY_DSN**
  - Value: `https://...@sentry.io/XXXXXXX`
  - Status: ? Create Sentry project if using crash reporting
  - Purpose: Error tracking & monitoring
  
- [ ] **LOG_LEVEL**
  - Value: `info` (production) or `error`
  - Status: ✓ Set to minimal logging level
  - Purpose: Reduce log noise in production

### API Configuration
- [ ] **CORS_ORIGINS**
  - Value: `https://your-domain.com,https://www.your-domain.com`
  - Status: ✓ Should restrict to known domains
  - Current: `*` (too permissive for production)

### Database
- [ ] **DATABASE_URL**
  - Value: `postgresql://user:pass@host:port/dbname?sslmode=require`
  - Status: ✓ Must use production database
  - Verify: Connection string is correct and SSL is enabled

### Google Services (Optional)
- [ ] **GOOGLE_MAPS_API_KEY**
  - Status: ? Only needed if location features are enabled
  - If used: Must be production key with restrictions

---

## Pre-Submission Checklist

### ✅ Step 1: Access Railway Dashboard
```
URL: https://railway.app
Project: VarsityHub
Environment: Production
```

### ✅ Step 2: Verify Each Variable
For each critical variable above:
1. Check if it's set in Railway dashboard
2. Verify value is PRODUCTION (not test/staging)
3. Confirm it matches expected format
4. Test by accessing logs/metrics

### ✅ Step 3: Update Stripe Keys to LIVE
```
STRIPE_SECRET_KEY: sk_test_... → sk_live_...
STRIPE_WEBHOOK_SECRET: [get live secret from webhooks]
```

### ✅ Step 4: Verify SendGrid
```
1. Create verification email template
2. Note template ID: d-XXXXXXXXX
3. Add to SENDGRID_VERIFICATION_TEMPLATE_ID
4. Send test email to verify delivery
```

### ✅ Step 5: Test Email Flow
```
1. Trigger user signup
2. Check if verification email arrives
3. Verify email links point to correct APP_BASE_URL
4. Confirm email is from EMAIL_FROM address
```

### ✅ Step 6: Test Payment Flow (Optional)
```
1. Use Stripe test card: 4242 4242 4242 4242
2. Attempt upgrade to Legend plan
3. Verify transaction in Stripe dashboard
4. Check user role updates correctly
```

---

## Risk Assessment

| Variable | Risk | If Missing |
|----------|------|-----------|
| SENDGRID_API_KEY | 🔴 CRITICAL | Email verification fails, users can't sign in |
| SENDGRID_VERIFICATION_TEMPLATE_ID | 🔴 CRITICAL | Emails not sent properly, wrong formatting |
| EMAIL_FROM | 🔴 CRITICAL | Emails marked as spam or rejected |
| APP_BASE_URL | 🔴 CRITICAL | Email links broken, OAuth redirects fail |
| STRIPE_SECRET_KEY (live) | 🔴 CRITICAL | Payments won't process, users can't upgrade |
| STRIPE_WEBHOOK_SECRET (live) | 🟠 HIGH | Payment webhooks fail, role updates delayed |
| ADMIN_EMAILS | 🟠 HIGH | Admins don't receive alerts |
| SENTRY_DSN | 🟡 MEDIUM | Errors not tracked, harder to debug issues |

---

## Deployment Workflow

```mermaid
1. Verify env vars in Railway ✅
   ↓
2. Update Stripe to LIVE keys ✅
   ↓
3. Setup SendGrid templates ✅
   ↓
4. Test email & payment flows ✅
   ↓
5. Run PRE_SUBMISSION_CHECKS.sh ✅
   ↓
6. Submit to App Review ✅
   ↓
7. Monitor Sentry/logs during review ✅
```

---

## Railway Environment Variable Format

In Railway dashboard, add variables as:
```
SENDGRID_API_KEY=SG.XXXXXXX
SENDGRID_VERIFICATION_TEMPLATE_ID=d-XXXXXXX
EMAIL_FROM=noreply@varsityhub.com
ADMIN_EMAILS=xsancastrillonx@hotmail.com
APP_BASE_URL=https://varsityhub-prod.railway.app
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_XXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXX
...
```

---

## Support Resources

- SendGrid: https://sendgrid.com/docs/
- Stripe Live Keys: https://dashboard.stripe.com/account/apikeys
- Railway Docs: https://docs.railway.app/develop/variables
- Sentry Setup: https://docs.sentry.io/product/integrations/

---

**Status**: Ready for v1.0.1 submission pending env var verification
**Last Updated**: 2024-12-25
**Action Items**: 
1. ✅ Commit pending changes
2. ⏳ Verify all env vars in Railway (THIS STEP)
3. ⏳ Setup SendGrid templates
4. ⏳ Run QA tests
5. ⏳ Submit to App Review
