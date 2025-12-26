# Production Environment Setup Guide

**Last Updated**: December 25, 2025  
**Status**: Required for App Store Launch

---

## 🎯 Critical Environment Variables

### Required for Production Launch

Set these in Railway's dashboard (https://railway.app/) under your production service:

#### 1. SendGrid Email Configuration

```bash
# SendGrid API Key (Get from: https://app.sendgrid.com/settings/api_keys)
SENDGRID_API_KEY=SG.your-actual-sendgrid-api-key-here

# Email Sender Address (Must be verified domain in SendGrid)
EMAIL_FROM=noreply@varsityhub.app
FROM_EMAIL=noreply@varsityhub.app

# Verification Template ID (Required for email verification flow)
SENDGRID_VERIFICATION_TEMPLATE_ID=d-your-verification-template-id-here
```

**Template Variables Required**:
- `verification_code` (6-digit code)
- `verification_link` (deep link URL)
- `user_name` (display name)

**How to Get Template ID**:
1. Go to https://mc.sendgrid.com/dynamic-templates
2. Create/locate "Email Verification" template
3. Copy template ID (starts with `d-`)
4. Ensure template has the 3 variables above

#### 2. Application URLs

```bash
# Production API Base URL (Railway auto-deploys to this)
APP_BASE_URL=https://api-production-8ac3.up.railway.app

# Mobile App Scheme (For deep links)
APP_SCHEME=varsityhubmobile
```

#### 3. Admin Configuration

```bash
# Comma-separated admin emails (bypass rate limits, dev mode access)
ADMIN_EMAILS=emancero@varsityhub.app,xsancastrillonx@hotmail.com
```

#### 4. Stripe Live Keys (When Ready for Billing)

**Current Status**: Using test keys  
**Action Required**: Replace with live keys before processing real payments

```bash
# Get live keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_your-stripe-live-secret-key-here

# Webhook signing secret (from: https://dashboard.stripe.com/webhooks)
STRIPE_WEBHOOK_SECRET=whsec_your-live-webhook-secret-here

# Price IDs (Create in Stripe Dashboard → Products)
STRIPE_PRICE_VETERAN=price_live_veteran_150_monthly
STRIPE_PRICE_LEGEND=price_live_legend_1999_onetime
```

**Note**: Legend plan uses mode='payment' (one-time $19.99), not subscription

---

## ✅ Current Environment Status

### Already Configured (No Action Needed)

```bash
# Database
DATABASE_URL=postgresql://... (Railway auto-provision)

# Security
JWT_SECRET=... (Railway auto-generated)

# CORS
ALLOWED_ORIGINS=* (Mobile app requires wildcard)

# Server
PORT=4000
NODE_ENV=production
```

---

## 📧 SendGrid Template Setup

### 1. Email Verification Template

**Template ID**: `SENDGRID_VERIFICATION_TEMPLATE_ID`

**Subject**: `Verify your VarsityHub account`

**Template Variables**:
```json
{
  "verification_code": "123456",
  "verification_link": "https://varsityhub.app/verify?code=123456",
  "user_name": "John Doe"
}
```

**Template Body** (HTML):
```html
<h1>Welcome to VarsityHub, {{user_name}}!</h1>
<p>Your verification code is:</p>
<h2 style="font-size: 32px; letter-spacing: 8px;">{{verification_code}}</h2>
<p>Or click this link to verify automatically:</p>
<a href="{{verification_link}}" style="background: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Verify Email</a>
<p><small>Code expires in 30 minutes</small></p>
```

### 2. Optional: Coach Welcome Template

**Template ID**: `SENDGRID_COACH_WELCOME_TEMPLATE_ID` (Non-blocking)

**Variables**: `user_name`, `plan`, `team_limit`, `authorized_user_limit`

### 3. Optional: Fan Welcome Template

**Template ID**: `SENDGRID_FAN_WELCOME_TEMPLATE_ID` (Non-blocking)

**Variables**: `user_name`, `explore_url`

---

## 🧪 Testing Email Delivery

### Step 1: Set Environment Variables in Railway

1. Go to Railway dashboard → Your project → Settings → Variables
2. Add the 4 critical variables:
   - `SENDGRID_API_KEY`
   - `SENDGRID_VERIFICATION_TEMPLATE_ID`
   - `EMAIL_FROM`
   - `ADMIN_EMAILS`

### Step 2: Restart Railway Service

Railway auto-restarts on variable changes. Verify restart in Deployments tab.

### Step 3: Test Email Send

**Option A**: Use signup flow in iOS app
```bash
1. Open app in TestFlight
2. Sign up with real email
3. Check email for verification code
4. Enter code to verify
```

**Option B**: Direct API test with curl
```bash
curl -X POST https://api-production-8ac3.up.railway.app/auth/send-verification \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Results

✅ **Success**:
- Email arrives within 10 seconds
- Template renders with correct variables
- Code is 6 digits
- Link works when clicked

❌ **Failure Indicators**:
- 500 error with "SENDGRID_API_KEY not set"
- Email not received after 1 minute
- Template variables showing as `{{variable_name}}`

---

## 🔐 Stripe Live Mode Checklist

**Do NOT enable until ready for real payments**

### Current State
- ✅ Test mode enabled
- ✅ Legend one-time payment ($19.99) implemented
- ✅ Veteran recurring payment ($1.50/team/month) implemented
- ✅ Webhook handlers configured

### Before Going Live

1. **Activate Stripe Account**
   - Complete identity verification
   - Add bank account for payouts
   - Enable live mode in dashboard

2. **Create Live Price IDs**
   ```
   Product: Veteran Plan
   Price: $1.50 monthly recurring
   
   Product: Legend Plan  
   Price: $19.99 one-time payment (mode: payment, not subscription)
   ```

3. **Update Environment Variables**
   ```bash
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_live_...
   STRIPE_PRICE_VETERAN=price_live_...
   STRIPE_PRICE_LEGEND=price_live_...
   ```

4. **Test Payments**
   - Use live test card: 4242 4242 4242 4242
   - Verify checkout flow
   - Confirm webhook delivery
   - Check user.plan updates correctly

---

## 🚨 Critical Paths to Verify

After setting environment variables, test these flows:

### 1. Email Verification (REQUIRED)
- [ ] Signup sends email within 10s
- [ ] Code entry works
- [ ] Rate limiting enforced (1/30s, 5/hour)
- [ ] Code expires after 30 minutes

### 2. Plan Limits (REQUIRED)
- [ ] Rookie: Max 2 teams
- [ ] Veteran: Calculated by subscription
- [ ] Legend: Unlimited
- [ ] Paywall link navigates correctly

### 3. Payment Flow (REQUIRED)
- [ ] Stripe checkout opens
- [ ] Payment succeeds
- [ ] Webhook processes within 5s
- [ ] User.plan updates
- [ ] Receipt email sent

### 4. Onboarding Completion (REQUIRED)
- [ ] All steps accessible
- [ ] Optional steps skippable
- [ ] Finish button works
- [ ] Redirects to correct destination (coach → team, fan → feed)

---

## 📝 Deployment Commands

### Update Backend Environment
```bash
# Railway auto-deploys on push to main
git push origin main

# Or manually trigger deploy
railway up
```

### Verify Backend Running
```bash
curl https://api-production-8ac3.up.railway.app/health
# Expected: {"status":"ok","timestamp":"2025-12-25T..."}
```

### Check Logs for Errors
```bash
railway logs --tail 100
```

Look for:
- `⚠️ SENDGRID_API_KEY not set` → Add SendGrid key
- `✓ SendGrid configured` → Good to go
- `Cannot GET /geocoding/autocomplete` → Expected (client-side fallback implemented)

---

## 📊 Environment Variables Checklist

### ✅ Must Set Before Launch

- [ ] `SENDGRID_API_KEY`
- [ ] `SENDGRID_VERIFICATION_TEMPLATE_ID`
- [ ] `EMAIL_FROM`
- [ ] `ADMIN_EMAILS`

### ⏳ Set Before Billing Goes Live

- [ ] `STRIPE_SECRET_KEY` (live mode)
- [ ] `STRIPE_WEBHOOK_SECRET` (live mode)
- [ ] `STRIPE_PRICE_VETERAN`
- [ ] `STRIPE_PRICE_LEGEND`

### ℹ️ Optional (Non-Blocking)

- [ ] `SENDGRID_COACH_WELCOME_TEMPLATE_ID`
- [ ] `SENDGRID_FAN_WELCOME_TEMPLATE_ID`
- [ ] `GOOGLE_MAPS_API_KEY` (client-side fallback implemented)

---

## 🎯 Next Steps

1. **Immediate**: Set SendGrid variables in Railway
2. **Test**: Send test verification email
3. **QA**: Run PRE_SUBMISSION_CHECKS.sh
4. **Submit**: `eas submit --platform ios --latest`
5. **Monitor**: Watch Sentry for errors during App Review

