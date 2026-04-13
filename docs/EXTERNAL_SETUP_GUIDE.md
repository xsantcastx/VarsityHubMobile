# VarsityHub External Setup & Configuration Guide

This guide covers all external services, environment variables, and platform configuration needed for VarsityHub to run in production. Use it as a checklist when deploying or troubleshooting.

---

## Quick Reference: Railway Environment Variables

Set these in **Railway Dashboard → Your Project → Variables** (or via `railway variables set KEY=value`).

| Category | Required | Variables |
|----------|----------|-----------|
| **Core** | ✅ | `DATABASE_URL`, `JWT_SECRET` (≥32 chars), `ALLOWED_ORIGINS` |
| **Email** | ✅ | `SENDGRID_API_KEY`, `FROM_EMAIL`, `SENDGRID_VERIFICATION_TEMPLATE_ID` |
| **Uploads** | ✅ | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **IAP (iOS)** | ✅ | `APPLE_IAP_SHARED_SECRET` |
| **Google** | ✅ | `GOOGLE_OAUTH_CLIENT_IDS`, `GOOGLE_MAPS_API_KEY` |
| **Stripe** | ✅ | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| **Twilio** | Optional | `TWILIO_*` (SMS; email verification is fallback) |
| **Redis** | Optional | `REDIS_URL` (job queues) |
| **Sentry** | Optional | `SENTRY_DSN` |

---

## 1. In-App Purchases (IAP)

### Overview

VarsityHub uses **Apple IAP** (iOS) and **Google Play Billing** (Android) for subscription tiers: `veteran_vhub` ($0.99/mo per additional team) and `Legend_vhub` ($29.99/yr). The server validates receipts via Apple/Google APIs.

### Requirements

- **EAS build** — IAP does **not** work in Expo Go. Use `eas build --profile preview` or `production`.
- **Server:** `APPLE_IAP_SHARED_SECRET` on Railway (for iOS receipt validation).
- **iOS:** Products in App Store Connect; Sandbox Apple ID for testing.
- **Android:** Products in Google Play Console; internal testing track.

### iOS Setup (App Store Connect)

1. **App Store Connect** → Your App → **In-App Purchases**
2. Create **Auto-Renewable Subscriptions**:
   - Product ID: `veteran_vhub` — $0.99/month per additional team
   - Product ID: `Legend_vhub` — $29.99/year
3. Ensure products are **Ready to Submit** (linked to a subscription group).
4. **App Store Connect** → App Information → **App-Specific Shared Secret** → Generate/Copy → set as `APPLE_IAP_SHARED_SECRET` on Railway.

### Android Setup (Google Play Console)

1. **Google Play Console** → Your App → **Monetize** → **Subscriptions**
2. Create products with IDs: `veteran_vhub`, `Legend_vhub`
3. Use **Internal testing** track for development.

### Testing

- **iOS:** Sign out of App Store on device → use Sandbox Apple ID when prompted.
- **Android:** Add testers in Play Console → Internal testing.
- **Diagnostics:** In dev builds, check console for `[useVHubIAP]` logs:
  - `IAP disabled in Expo Go` → use EAS build
  - `Store not connected yet` → wait or check Sandbox/network
  - `fetchProducts failed` → product IDs or store config mismatch

---

## 2. Email (SendGrid)

### Overview

SendGrid sends verification, password reset, invites, and other transactional emails. The server uses dynamic templates.

### Setup

1. **SendGrid** → https://sendgrid.com/ → Create account
2. **Settings** → **API Keys** → Create API Key (full access or restricted to Mail Send)
3. **Dynamic Templates** → Create templates per `docs/SENDGRID_TEMPLATES.md`
4. Set on Railway:
   - `SENDGRID_API_KEY` (starts with `SG.`)
   - `FROM_EMAIL` (e.g. `noreply@varsityhub.app`)
   - `SENDGRID_VERIFICATION_TEMPLATE_ID` (required for sign-up)
   - Other template IDs as needed (see `.env.example`)

### Verification Flow

- `POST /auth/verify/request` — sends verification email with code/link
- `POST /auth/verify/confirm` — confirms code, marks user verified

### Domain & Deliverability

- Verify your sending domain in SendGrid
- Add SPF/DKIM records for `FROM_EMAIL` domain
- Use `EMAIL_OVERRIDE_TO` in non-production to redirect all emails for testing

---

## 3. Cloudinary (Image/Video Uploads)

### Overview

Cloudinary stores user-uploaded images and videos. The server signs upload requests; the client uploads directly to Cloudinary.

### Setup

1. **Cloudinary** → https://cloudinary.com/ → Sign up (free tier)
2. **Dashboard** → Cloud name, API Key, API Secret
3. Set on Railway:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

### Behavior

- **Production:** Server exits if Cloudinary is not configured (`isCloudinaryConfigured()`).
- **Client:** Uses `POST /uploads/cloudinary-signature` to get signed params, then uploads to Cloudinary.
- **Folder:** `varsityhub/{development|production}`

---

## 4. Google OAuth & Maps

### Overview

- **OAuth:** Google Sign-In (iOS, Android, Web client IDs)
- **Maps:** Map display, location picker, nearby events

### Setup

1. **Google Cloud Console** → https://console.cloud.google.com/
2. Create OAuth 2.0 credentials (iOS, Android, Web)
3. Enable Maps SDK for iOS/Android
4. Set on Railway:
   - `GOOGLE_OAUTH_CLIENT_IDS` — comma-separated: `ios-id.apps.googleusercontent.com,web-id.apps.googleusercontent.com`
   - `GOOGLE_MAPS_API_KEY`

### App Config

- `app.json` / `app.config.js` already has `googleMapsApiKey` for iOS/Android
- Ensure bundle ID / package name match OAuth credentials

---

## 5. Stripe (Web Payments & Ads)

### Overview

Stripe is used for:
- Web checkout (fallback when IAP unavailable)
- Ad hosting payments (weekday/weekend slots)
- Subscription webhooks

### Setup

1. **Stripe Dashboard** → https://dashboard.stripe.com/apikeys
2. Create products/prices for Veteran, Legend, Ad slots
3. **Webhooks** → Add endpoint → `https://your-api.railway.app/payments/webhook` → Copy signing secret
4. Set on Railway:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_VETERAN`, `STRIPE_PRICE_LEGEND`
   - `STRIPE_PRICE_AD_WEEKDAY`, `STRIPE_PRICE_AD_WEEKEND` (if used)

### EAS Build

- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set in `eas.json` for preview/production builds.

---

## 6. Twilio (SMS — Optional)

### Overview

Twilio Verify can send SMS verification codes. If not configured, the app falls back to email verification.

### Setup

1. **Twilio** → https://www.twilio.com/ → Create account
2. Create Verify Service
3. Set on Railway:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`
   - `TWILIO_FROM_PHONE` (for non-Verify SMS if used)

---

## 7. Apple Sign-In & Bundle Config

### Overview

- **Apple Sign-In** requires `APPLE_CLIENT_ID` (Services ID) and matching bundle ID
- **Bundle ID:** `com.varsithub.varsityhub-ios` (from `app.json`)

### Setup

1. **Apple Developer** → Identifiers → App ID with Sign In with Apple
2. **Services ID** for web callback (if used)
3. Set `APPLE_CLIENT_ID` on Railway if server handles Apple token validation
4. Ensure `app.json` → `ios.bundleIdentifier` matches App Store Connect

---

## 8. Verification Checklist

### Server Health

```bash
curl https://your-api.railway.app/health | jq .integrations
```

Check that critical integrations report as configured.

### Codebase Verification

| Component | Location | Status |
|-----------|----------|--------|
| Onboarding completion | `server/src/routes/auth.ts` (GET /me) | `onboarding_completed` defaults to `false` |
| IAP product IDs | `hooks/useIAP.ts` | `veteran_vhub`, `Legend_vhub` |
| IAP receipt validation | `server/src/routes/payments.ts` | Apple/Google verify endpoints |
| Email verification | `server/src/routes/auth.ts` | `POST /auth/verify/request`, `POST /auth/verify/confirm` |
| SendGrid templates | `server/src/lib/email.ts` | Template IDs from env |
| Cloudinary | `server/src/lib/cloudinary.ts` | `isCloudinaryConfigured()` |
| Client uploads | `api/upload.ts` | Uses `/uploads/cloudinary-signature` |

### Pre-Release Checklist

- [ ] All Railway env vars set (see Quick Reference)
- [ ] SendGrid domain verified, templates created
- [ ] Cloudinary configured
- [ ] `APPLE_IAP_SHARED_SECRET` set for iOS IAP
- [ ] App Store Connect products `veteran_vhub`, `Legend_vhub` Ready to Submit
- [ ] EAS build (not Expo Go) for IAP testing
- [ ] Sandbox Apple ID for iOS IAP testing
- [ ] Stripe webhook URL correct and secret set

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| IAP "Store Unavailable" | Expo Go, or store not connected | Use EAS build; check Sandbox/network |
| IAP products empty | Product IDs mismatch, not Ready to Submit | Match `veteran_vhub`, `Legend_vhub` in App Store Connect |
| Verification email not sent | SendGrid key/template missing | Set `SENDGRID_API_KEY`, `SENDGRID_VERIFICATION_TEMPLATE_ID` |
| Upload fails | Cloudinary not configured | Set all 3 Cloudinary env vars |
| Google Sign-In fails | Client ID / bundle mismatch | Verify OAuth credentials match app.json |

---

## Related Docs

- `server/.env.example` — Full env var list
- `docs/RAILWAY_ENV_SETUP.md` — Railway-specific checklist
- `docs/SENDGRID_TEMPLATES.md` — SendGrid template schemas
