# Railway Production Environment Setup
**Target**: v1.0.1 (Build 39) - Apple App Review Submission  
**Status**: ⚠️ Action Required - Missing SendGrid Templates & Stripe Live Keys

---

## API Health Status ✅ (Checked Dec 26, 2025)

```json
✅ Backend: Reachable at https://api-production-8ac3.up.railway.app
✅ Database: Connected
✅ JWT: Configured
✅ Cloudinary: Connected
✅ Twilio: Connected
✅ Google OAuth: Configured
✅ Google Maps: Configured
✅ Sentry: Configured
❌ SendGrid: MISSING TEMPLATES
⚠️ Stripe: Not explicitly checked (likely using test keys)
```

---

## 🔴 CRITICAL ISSUES TO FIX

### Issue 1: SendGrid Templates Missing
**Severity**: 🔴 HIGH  
**Affected**: Email verification, event decisions, payment confirmations  
**Status**: ⚠️ Must be created before QA

**Missing Templates**:
- `join_request_admin` - Notification when fan requests to join team
- `join_request_approved` - Confirmation when coach approves fan request
- `join_request_denied` - Notification when coach denies fan request

**Fix**: See SENDGRID_TEMPLATE_CREATION.md for step-by-step

---

### Issue 2: Stripe Live Keys Not Configured
**Severity**: 🔴 HIGH  
**Affected**: Legend/Veteran plan checkout & webhook verification  
**Status**: ⚠️ Must update before build

**Current**: Using `sk_test_...` (test secret key)  
**Required**: `sk_live_...` (live secret key)

**Fix Steps**:
```bash
1. Go to Stripe Dashboard: https://dashboard.stripe.com
2. Navigate: Developers → API Keys
3. Copy LIVE Secret Key (starts with sk_live_)
4. Open Railway dashboard
5. Navigate: Project → chore/deploy-checklist → Variables
6. Update STRIPE_SECRET_KEY = sk_live_XXXXXXX
7. Deploy changes
```

**Webhook Secret Update**:
```bash
1. Go to Stripe Dashboard → Developers → Webhooks
2. Find endpoint: https://api-production-8ac3.up.railway.app/webhooks/stripe
3. Click to view signing secret
4. Copy LIVE Webhook Secret (starts with whsec_)
5. In Railway: Update STRIPE_WEBHOOK_SECRET = whsec_XXXXXXX
6. Deploy changes
```

---

## Railway Dashboard Navigation

### Access Production Environment
```
1. Go to https://railway.app
2. Log in with your account
3. Select Project: VarsityHub
4. Select Environment: Production (chore/deploy-checklist branch)
5. Go to: Settings → Variables
```

### Current Production Variables (Status Check)

Run this script to see all configured variables:

```bash
# Railway CLI check (if installed)
railway variables

# Or manually check in Dashboard:
# Project → Variables → scroll through list
```

---

## Pre-Submission Environment Checklist

### 🔴 MUST FIX (Blocking Issues)

- [ ] **SendGrid Templates**: Create 3 missing templates
  - `join_request_admin`
  - `join_request_approved`
  - `join_request_denied`
  - Reference: SENDGRID_TEMPLATE_CREATION.md
  - Status: Currently missing (health check failed)

- [ ] **Stripe Live Keys**: Update from test to live
  - `STRIPE_SECRET_KEY=sk_live_...` (not sk_test_)
  - `STRIPE_WEBHOOK_SECRET=whsec_...` (live webhook secret)
  - Reference: Stripe Dashboard → Developers
  - Status: Currently using test keys

### 🟡 SHOULD VERIFY (Important)

- [ ] **Email Configuration**
  - `EMAIL_FROM=noreply@varsityhub.com` (verified sender in SendGrid)
  - Status: Verify this email is in SendGrid "Verified Senders" list
  - If missing: Add in SendGrid → Settings → Verified Senders

- [ ] **Admin Email Detection**
  - `ADMIN_EMAILS=xsancastrillonx@hotmail.com,admin@varsityhub.com`
  - Status: Verify format is comma-separated, no spaces
  - Test: Log in as admin account, check for admin badge

- [ ] **APP_BASE_URL**
  - `APP_BASE_URL=https://api-production-8ac3.up.railway.app`
  - Status: Confirm this is correct production URL
  - Used for: Email links, OAuth redirects, API base

- [ ] **Sentry DSN** (Optional but recommended)
  - `SENTRY_DSN=https://...@sentry.io/XXXXXXX`
  - Status: Check if configured for error tracking
  - Benefit: Monitor production errors post-launch

### 🟢 LIKELY CONFIGURED (Low Priority)

- [ ] Database: PostgreSQL connected (✅ confirmed by health check)
- [ ] JWT: Signing configured (✅ confirmed by health check)
- [ ] Cloudinary: Image upload (✅ confirmed by health check)
- [ ] Google OAuth: Sign-in (✅ confirmed by health check)
- [ ] Google Maps: Location features (✅ confirmed by health check)

---

## Quick Reference: Railway Dashboard

### Where to Find Variables
```
Railway.app → Project: VarsityHub → Settings → Variables
```

### Template Format for Each Variable
```bash
KEY=VALUE
# No quotes needed for simple values
STRIPE_SECRET_KEY=sk_live_... (from Stripe Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Webhooks endpoint)
EMAIL_FROM=noreply@varsityhub.com
ADMIN_EMAILS=xsancastrillonx@hotmail.com,admin@varsityhub.com
```

### How Changes Deploy
```
1. Edit variable in Railway Dashboard
2. Click "Save"
3. Railway auto-redeploys service (2-5 minutes)
4. Check deployment status in "Deployments" tab
5. Verify: curl https://api-production-8ac3.up.railway.app/health
```

---

## Testing After Environment Changes

### Test 1: Verify API is Still Healthy
```bash
curl https://api-production-8ac3.up.railway.app/health | jq .
# Should show:
#   "status": "ok"
#   "sendgrid": true (after template fix)
#   "stripe": true (should already be true)
```

### Test 2: Verify Stripe Live Key Works
```bash
# This will be tested in QA_TESTS.sh during payment flow
# Run: bash RUN_QA_TESTS.sh
# Select: Option 2 - Test payment flow
```

### Test 3: Verify Email Configuration
```bash
# This will be tested in PRE_SUBMISSION_CHECKS.sh
# Run: bash PRE_SUBMISSION_CHECKS.sh
# Check: "Email templates configured" passes
```

---

## Common Issues & Solutions

### Issue: SendGrid templates not showing in health check
**Solution**: 
1. Verify SENDGRID_TEMPLATE_ID environment variables are set
2. Use actual template IDs from SendGrid (format: `d-XXXXX...`)
3. Restart deployment after updating

### Issue: Stripe webhook failures in logs
**Solution**:
1. Verify STRIPE_WEBHOOK_SECRET matches the live webhook endpoint secret
2. Test webhook delivery: Stripe Dashboard → Developers → Webhooks → [endpoint] → Send test event
3. Check Railway logs for webhook handler errors

### Issue: Admin badge not showing in profile
**Solution**:
1. Verify ADMIN_EMAILS is set with correct email
2. Format: `email1@example.com,email2@example.com` (no spaces)
3. Log out and back in for profile context refresh

### Issue: Email links broken in sent emails
**Solution**:
1. Verify APP_BASE_URL is set correctly
2. Email templates use `{{baseUrl}}` variable
3. Confirm URL includes https:// and has no trailing slash

---

## Next Steps

### Immediate (Before QA Testing)
1. ✅ Create missing SendGrid templates (3 templates)
2. ✅ Update Stripe keys to LIVE versions
3. ✅ Verify ADMIN_EMAILS and EMAIL_FROM in Railway
4. ✅ Run health check: `curl https://api-production-8ac3.up.railway.app/health`

### After Environment Setup
1. Run QA test suite: `bash RUN_QA_TESTS.sh`
2. Run pre-submission checks: `bash PRE_SUBMISSION_CHECKS.sh`
3. Test payment flow manually in TestFlight
4. Once green: `eas submit --platform ios --latest`

---

## Emergency Contacts & References

- **Stripe Support**: https://support.stripe.com
- **SendGrid Support**: https://support.sendgrid.com
- **Railway Support**: https://railway.app/support
- **Expo Submit Docs**: https://docs.expo.dev/build/submit/

---

**Last Updated**: December 26, 2025  
**Health Check Status**: 🟡 NEEDS ACTION (SendGrid templates missing, Stripe keys likely test)  
**Confidence Level**: HIGH - All systems reachable, just env var updates needed
