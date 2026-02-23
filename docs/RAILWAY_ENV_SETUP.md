# Railway Environment Variables Checklist

> **Last Updated:** November 30, 2025 @ 09:30 UTC  
> **Status Check:** `curl https://api-production-8ac3.up.railway.app/health | jq .integrations`

## ⚠️ New: Strict Environment Validation

The server now **exits immediately** if required env vars are missing or invalid:
- `DATABASE_URL` - Required
- `JWT_SECRET` - Required, **must be ≥32 characters**
- `ALLOWED_ORIGINS` - Recommended (set to avoid wildcard CORS warning)

See `server/src/lib/env.ts` for the full Zod schema.

---

## 🚨 Current Production Status

| Variable | Status | Impact |
| -------- | ------ | ------ |
| DATABASE_URL | ✅ Set | Prisma connected, 44 migrations applied |
| JWT_SECRET | ✅ Set | Auth tokens work |
| SMTP_HOST/USER/PASS | ✅ Set | Email verification & password reset work |
| SENTRY_DSN | ✅ Set | Server error tracking active |
| **STRIPE_SECRET_KEY** | ✅ Set | `sk_test_51S5t0k...` configured |
| **STRIPE_WEBHOOK_SECRET** | ✅ Set | `whsec_8f60823f...` configured |
| **STRIPE_PRICE_VETERAN** | ✅ Set | `price_1SCd6HRuB2a0vFjp1QlboTEv` |
| **STRIPE_PRICE_LEGEND** | ✅ Set | `price_1SCd6IRuB2a0vFjpQOSdctN4` |
| **CLOUDINARY_CLOUD_NAME** | ✅ Set | `varsityhub` |
| **CLOUDINARY_API_KEY** | ✅ Set | `324968783148443` |
| **CLOUDINARY_API_SECRET** | ✅ Set | Configured |
| **GOOGLE_OAUTH_CLIENT_IDS** | ✅ Set | All 3 client IDs configured |
| **GOOGLE_MAPS_API_KEY** | ✅ Set | iOS + Android keys in app.json |
| TWILIO_* | ⚠️ Optional | SMS disabled; email verification is fallback |
| REDIS_URL | ⚠️ Optional | Job queues (BullMQ) disabled until added |
| ALLOWED_ORIGINS | ⚠️ Recommended | Set to lock down CORS (e.g., `https://varsityhub.com`) |

### Why Stripe Payments Fail

The `/payments/checkout` route instantiates Stripe with `process.env.STRIPE_SECRET_KEY`. Without it:
1. SDK is created with empty string
2. Any checkout call throws **"No API key provided"**
3. Webhook handler can't verify signatures without `STRIPE_WEBHOOK_SECRET`

This is NOT a 2FA or Stripe account issue—just missing env vars.

---

## Required Variables to Add in Railway Dashboard

### 1. Stripe (Payments & Subscriptions) — CRITICAL
Get from: https://dashboard.stripe.com/apikeys

```bash
STRIPE_SECRET_KEY=sk_live_...      # or sk_test_... for testing
STRIPE_WEBHOOK_SECRET=whsec_...    # from webhook setup (step below)
STRIPE_PRICE_VETERAN=price_...     # Veteran tier: $2.50/month per additional team
STRIPE_PRICE_LEGEND=price_...      # Legend tier: $19.99/year unlimited
```

**Ad Pricing (Hardcoded in server/src/routes/payments.ts):**
- Weekday slots (Mon-Thu): $8.00 per week
- Weekend slots (Fri-Sun): $10.00 per week
- No env vars needed for ad pricing—it's calculated in `calculatePriceCents()`

**Create Stripe Products:**
1. Go to Stripe Dashboard → Products
2. Create "Veteran" product:
   - Price: $2.50/month recurring (per-unit billing)
   - Copy `price_...` ID → `STRIPE_PRICE_VETERAN`
3. Create "Legend" product:
   - Price: $19.99/year recurring
   - Copy `price_...` ID → `STRIPE_PRICE_LEGEND`

### 2. Cloudinary (Image/Video Uploads)
Sign up at: https://cloudinary.com/users/register/free

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 3. Google OAuth (Google Sign-In)
Get from: https://console.cloud.google.com/apis/credentials

```bash
GOOGLE_OAUTH_CLIENT_IDS=ios-client.apps.googleusercontent.com,web-client.apps.googleusercontent.com
```

### 4. Google Maps (Maps Features)
Get from: https://console.cloud.google.com/google/maps-apis/overview

```bash
GOOGLE_MAPS_API_KEY=AIza...
```

### 5. Redis (Job Queues — Optional but Recommended)
For background job processing (notifications, emails, cleanup tasks).
Sign up at: https://upstash.com (free tier available)

```bash
REDIS_URL=redis://default:xxx@xxx.upstash.io:6379
```

**What it enables:**
- Background push notification delivery
- Email queue processing
- Scheduled cleanup jobs
- Game reminder notifications

---

## Setting Up Stripe Webhook

After adding `STRIPE_SECRET_KEY`, configure the webhook:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api-production-8ac3.up.railway.app/payments/webhook`
3. Select events:
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the **Signing secret** (`whsec_...`) to `STRIPE_WEBHOOK_SECRET`
5. Redeploy Railway

### Test Webhook Locally
```bash
stripe listen --forward-to http://localhost:4000/payments/webhook
stripe trigger checkout.session.completed
```

---

## Verification After Adding Variables

```bash
# 1. Check all integrations
curl https://api-production-8ac3.up.railway.app/health | jq .integrations

# Expected (all critical ones true):
{
  "database": true,
  "jwt": true,
  "cloudinary": true,
  "twilio": false,      # optional
  "stripe": true,
  "smtp": true,
  "googleOAuth": true,
  "googleMaps": true,
  "sentry": true
}

# 2. Test Stripe specifically
curl https://api-production-8ac3.up.railway.app/payments/config-status
# Expected: { "stripe_configured": true, "has_webhook_secret": true }
```

---

## Optional Variables

### Twilio (SMS Verification)
If you want SMS verification instead of email:
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

### Admin Configuration
```bash
ADMIN_EMAILS=admin@varsityhub.com,owner@varsityhub.com
```

### App URLs
```bash
APP_BASE_URL=https://api-production-8ac3.up.railway.app
APP_SCHEME=varsityhubmobile
ALLOWED_ORIGINS=*
```

---

## Mobile App Environment Variables

These go in your `.env` file or `eas.json` for builds:

### Sentry (Mobile Error Tracking)
```bash
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1   # optional, default 0.1
```

**How it works:**
- `utils/sentry.ts` calls `initSentry()` on app load
- Without DSN → logs warning, Sentry disabled
- With DSN → captures JS errors, unhandled promises, performance traces
- `ErrorBoundary` component sends caught React errors to Sentry

### Google Sign-In (Mobile)
```bash
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxx.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxx.apps.googleusercontent.com
```

### API Configuration
```bash
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
```

---

## Quick Troubleshooting

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| "No API key provided" on checkout | `STRIPE_SECRET_KEY` missing | Add key in Railway |
| Image uploads fail silently | `CLOUDINARY_*` vars missing | Add Cloudinary credentials |
| Google sign-in 401 | `GOOGLE_OAUTH_CLIENT_IDS` missing | Add OAuth client IDs |
| No errors in Sentry | `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` missing | Add DSN for server/client |
| Webhook not processing | `STRIPE_WEBHOOK_SECRET` missing or wrong endpoint | Verify webhook URL: `/payments/webhook` |
ALLOWED_ORIGINS=*
```
