# Environment Configuration

Complete guide to API keys, environment variables, and external service configuration for VarsityHub.

---

## Table of Contents

1. [Overview](#overview)
2. [Frontend Environment (.env)](#frontend-environment-env)
3. [Backend Environment (server/.env)](#backend-environment-serverenv)
4. [Google OAuth Setup](#google-oauth-setup)
5. [Google Maps API](#google-maps-api)
6. [Stripe Configuration](#stripe-configuration)
7. [Cloudinary Setup](#cloudinary-setup)
8. [Email Configuration](#email-configuration)
9. [Security Best Practices](#security-best-practices)
10. [Environment Checklist](#environment-checklist)

---

## Overview

VarsityHub requires multiple external services to function:

| Service | Purpose | Required For |
|---------|---------|--------------|
| Google OAuth | User authentication | Login/Register |
| Google Maps API | Location & maps | Event locations, discovery |
| Stripe | Payment processing | Subscriptions |
| Cloudinary | Media storage | Photos, videos |
| Gmail SMTP | Email notifications | Password reset, notifications |
| PostgreSQL | Database | All data storage |

### Environment Files

```
VarsityHubMobile/
├── .env                 # Frontend environment (Expo app)
└── server/.env          # Backend environment (Express server)
```

⚠️ **Never commit these files to Git!** They're in `.gitignore`.

---

## Frontend Environment (.env)

Location: **Root directory** (`VarsityHubMobile/.env`)

### Template

Create this file in the project root:

```properties
# API Configuration
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app

# Google OAuth (Android)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com

# Google OAuth (iOS)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com

# Google OAuth (Web/Backend)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

### Variable Descriptions

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `https://api-production-8ac3.up.railway.app` |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android client ID | `123456-abc.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS client ID | `789012-def.apps.googleusercontent.com` |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth web client ID | `345678-ghi.apps.googleusercontent.com` |

### Development vs Production

**Development (Local):**
```properties
EXPO_PUBLIC_API_URL=http://localhost:4000
```

**Development (Android Emulator):**
```properties
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

**Production:**
```properties
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
```

---

## Backend Environment (server/.env)

Location: **server directory** (`VarsityHubMobile/server/.env`)

### Complete Template

```properties
# Database
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Server Configuration
PORT=4000
APP_BASE_URL=https://api-production-8ac3.up.railway.app
APP_SCHEME=varsityhubmobile
ALLOWED_ORIGINS=http://localhost:9500,http://localhost:5173,https://postgres-production-c079.up.railway.app

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
FROM_EMAIL=your-email@gmail.com
ADMIN_EMAILS=admin@example.com

# Stripe (Test Keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_VETERAN=price_...
STRIPE_PRICE_LEGEND=price_...

# Google Maps
GOOGLE_MAPS_API_KEY=AIzaSy...
GOOGLE_MAPS_DEFAULT_COUNTRY=US

# Cloudinary (Optional - if using)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-api-secret

# AWS S3 (Optional - if using)
S3_REGION=us-east-1
S3_BUCKET=varsityhub-uploads
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
```

### Variable Descriptions

#### Database

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway dashboard → Database → Connect |

Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

#### Authentication

| Variable | Description | Recommendation |
|----------|-------------|----------------|
| `JWT_SECRET` | Secret key for JWT tokens | Generate with: `openssl rand -base64 32` |

#### Server

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `4000` |
| `APP_BASE_URL` | Public API URL | `https://api-production-8ac3.up.railway.app` |
| `APP_SCHEME` | App deep link scheme | `varsityhubmobile` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:9500,https://app.example.com` |

#### Email

| Variable | Description | Setup Guide |
|----------|-------------|-------------|
| `SMTP_HOST` | Email server host | `smtp.gmail.com` for Gmail |
| `SMTP_PORT` | Email server port | `587` for TLS, `465` for SSL |
| `SMTP_SECURE` | Use SSL? | `false` for port 587, `true` for 465 |
| `SMTP_USER` | Email account | Your Gmail address |
| `SMTP_PASS` | Email password | [App-specific password](#email-configuration) |
| `FROM_EMAIL` | Sender email | Same as `SMTP_USER` |
| `ADMIN_EMAILS` | Admin email list | Comma-separated emails |

#### Stripe

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Stripe Dashboard → Developers → API Keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Stripe Dashboard → Developers → Webhooks |
| `STRIPE_PRICE_VETERAN` | Veteran tier price ID | Stripe Dashboard → Products → Veteran → Pricing |
| `STRIPE_PRICE_LEGEND` | Legend tier price ID | Stripe Dashboard → Products → Legend → Pricing |

#### Google Maps

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | [Google Maps Setup](#google-maps-api) |
| `GOOGLE_MAPS_DEFAULT_COUNTRY` | Default country code | `US`, `CA`, `UK`, etc. |

---

## Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project: **"VarsityHub"**
3. Enable **Google+ API** and **OAuth Consent Screen**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** (for public app) or **Internal** (for organization only)
3. Fill in required fields:
   - **App name**: VarsityHub
   - **User support email**: your-email@example.com
   - **Developer contact**: your-email@example.com
4. Add scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
5. Save and continue

### Step 3: Create OAuth Credentials

#### For Android

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Choose **Android**
4. Fill in:
   - **Name**: VarsityHub Android
   - **Package name**: `com.varsityhub.mobile` (from `app.json`)
   - **SHA-1 certificate fingerprint**: Get from:

**Development SHA-1:**
```bash
# On Windows (PowerShell)
cd $env:USERPROFILE\.android
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android

# On Mac/Linux
cd ~/.android
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Production SHA-1:**
```bash
keytool -list -v -keystore your-release-key.jks -alias your-key-alias
```

5. Copy the **Client ID** → Add to frontend `.env` as `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

#### For iOS

1. Click **Create Credentials** → **OAuth 2.0 Client ID**
2. Choose **iOS**
3. Fill in:
   - **Name**: VarsityHub iOS
   - **Bundle ID**: `com.varsityhub.mobile` (from `app.json`)
4. Copy the **Client ID** → Add to frontend `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

#### For Web/Backend

1. Click **Create Credentials** → **OAuth 2.0 Client ID**
2. Choose **Web application**
3. Fill in:
   - **Name**: VarsityHub Backend
   - **Authorized redirect URIs**: `https://api-production-8ac3.up.railway.app/auth/google/callback`
4. Copy the **Client ID** → Add to frontend `.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

### Step 4: Update Environment Files

**Frontend `.env`:**
```properties
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789012-abc123.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789012-def456.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789012-ghi789.apps.googleusercontent.com
```

### Step 5: Test OAuth

1. Restart Expo: `npm start`
2. Open app and click **Sign in with Google**
3. Should see Google sign-in page
4. After sign-in, should redirect back to app

**Troubleshooting:** See [Google OAuth Issues](#google-oauth-issues)

---

## Google Maps API

### Step 1: Enable APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Go to **APIs & Services** → **Library**
4. Enable these APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Geocoding API**
   - **Places API**
   - **Geolocation API**

### Step 2: Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **API Key**
3. Copy the key → Add to `server/.env` as `GOOGLE_MAPS_API_KEY`

### Step 3: Restrict API Key (Production)

⚠️ **Important for security and cost control!**

1. Click on your API key
2. Under **Application restrictions**, choose:
   - **Android apps**: Add package name and SHA-1 fingerprint
   - **iOS apps**: Add bundle identifier
   - **HTTP referrers**: Add your website domains
   - **IP addresses**: Add your server IP
3. Under **API restrictions**, choose:
   - **Restrict key**
   - Select only the APIs you enabled above
4. Save

### Step 4: Configure Expo

Add to `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_MAPS_KEY"
        }
      }
    },
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_MAPS_KEY"
      }
    }
  }
}
```

**Note:** You can use the same key for both if not restricted, or create separate keys for better security.

### Step 5: Update Backend

**server/.env:**
```properties
GOOGLE_MAPS_API_KEY=AIzaSyD41NuiCoah1ed8P1HVlucciSlBaNMyKBY
GOOGLE_MAPS_DEFAULT_COUNTRY=US
```

---

## Stripe Configuration

### Step 1: Create Stripe Account

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account (if you don't have one)
3. Complete business verification (required for live payments)

### Step 2: Get API Keys

#### Test Mode (Development)

1. Toggle **Test mode** ON (top-right)
2. Go to **Developers** → **API Keys**
3. Copy:
   - **Publishable key**: `pk_test_...` (not needed for backend-only)
   - **Secret key**: `sk_test_...` → Add to `server/.env`

#### Live Mode (Production)

1. Toggle **Test mode** OFF
2. Go to **Developers** → **API Keys**
3. Copy:
   - **Secret key**: `sk_live_...` → Add to Railway environment variables

**server/.env (Development):**
```properties
STRIPE_SECRET_KEY=sk_test_51S5t0W2O6zyPvnQXG5RfQuafxC2kwQ1wVQG9smMbcBVSaDnMT10CKE7sUMsQwqNvAVqXSu6ij4VHXZsl34mikiuk00eMEk2X3q
```

**Railway (Production):**
```properties
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_SECRET_KEY
```

### Step 3: Create Products

1. Go to **Products** in Stripe Dashboard
2. Click **Add Product**

**Veteran Tier:**
- Name: `Veteran Membership`
- Description: `Access to advanced features`
- Pricing: `$9.99/month` recurring
- Copy **Price ID**: `price_...` → `STRIPE_PRICE_VETERAN`

**Legend Tier:**
- Name: `Legend Membership`
- Description: `Access to all premium features`
- Pricing: `$19.99/month` recurring
- Copy **Price ID**: `price_...` → `STRIPE_PRICE_LEGEND`

### Step 4: Configure Webhooks

Webhooks notify your backend when payments succeed/fail.

#### Development (Local Testing)

1. Install Stripe CLI:
```bash
# Windows (PowerShell as Admin)
scoop install stripe

# Mac
brew install stripe/stripe-cli/stripe
```

2. Login:
```bash
stripe login
```

3. Forward events to local server:
```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

4. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET` in `server/.env`

#### Production (Railway)

1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Endpoint URL: `https://api-production-8ac3.up.railway.app/api/webhooks/stripe`
4. Events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy **Signing secret** → Add to Railway environment variables as `STRIPE_WEBHOOK_SECRET`

### Step 5: Test Payments

**Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`
- Expiry: Any future date (e.g., `12/34`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

---

## Cloudinary Setup

Cloudinary stores user-uploaded photos and videos.

### Step 1: Create Account

1. Go to [Cloudinary](https://cloudinary.com/)
2. Sign up for free account
3. Go to **Dashboard**

### Step 2: Get Credentials

Copy from dashboard:
- **Cloud Name**: `your-cloud-name`
- **API Key**: `123456789012345`
- **API Secret**: `abcdefghijklmnopqrstuvwxyz`

### Step 3: Configure Backend

**server/.env:**
```properties
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

### Step 4: Set Upload Presets

1. Go to **Settings** → **Upload**
2. Scroll to **Upload presets**
3. Click **Add upload preset**
4. Settings:
   - **Preset name**: `varsityhub_uploads`
   - **Signing mode**: `Unsigned` (for frontend uploads)
   - **Folder**: `varsityhub/`
   - **Resource type**: `Auto`
   - **Allowed formats**: `jpg,png,gif,mp4,mov`
   - **Max file size**: `10485760` (10MB)
   - **Transformation**: Optional (e.g., quality auto, format auto)
5. Save

### Step 5: Configure Frontend

Update upload service to use Cloudinary:

```typescript
// utils/uploadService.ts
const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/upload';
const CLOUDINARY_UPLOAD_PRESET = 'varsityhub_uploads';

export async function uploadImage(uri: string) {
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: 'image/jpeg',
    name: 'upload.jpg',
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  return data.secure_url;
}
```

---

## Email Configuration

### Using Gmail SMTP

#### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

#### Step 2: Create App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail**
3. Select device: **Other (Custom name)**
4. Enter name: **VarsityHub**
5. Click **Generate**
6. Copy the 16-character password (spaces removed)

#### Step 3: Configure Backend

**server/.env:**
```properties
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # 16-char app password
FROM_EMAIL=your-email@gmail.com
ADMIN_EMAILS=admin@example.com
```

#### Step 4: Test Email

Run test script:
```bash
cd server
npm run test:email
```

Or manually test:
```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

await transporter.sendMail({
  from: process.env.FROM_EMAIL,
  to: 'test@example.com',
  subject: 'Test Email',
  text: 'This is a test email from VarsityHub!',
});
```

---

## Security Best Practices

### 1. Never Commit Secrets

✅ **Do:**
- Use `.env` files (they're in `.gitignore`)
- Use environment variables in production
- Use `.env.example` as template (without actual values)

❌ **Don't:**
- Commit `.env` files to Git
- Hardcode API keys in code
- Share secrets in chat/email (use secure password managers)

### 2. Use Different Keys for Development vs Production

| Environment | Stripe | Google OAuth | Database |
|-------------|--------|--------------|----------|
| Development | `sk_test_...` | Dev credentials | Local PostgreSQL |
| Production | `sk_live_...` | Prod credentials | Railway PostgreSQL |

### 3. Restrict API Keys

- **Google Maps**: Restrict by package name/bundle ID
- **Stripe**: Use webhook signing to verify events
- **Cloudinary**: Use signed uploads for production

### 4. Rotate Secrets Regularly

- Change `JWT_SECRET` every 6 months
- Rotate database passwords annually
- Update API keys if compromised

### 5. Use Environment Variables in Production

**Railway Dashboard:**
1. Go to your project → **Variables**
2. Add all production secrets
3. Never use `.env` file in production

---

## Environment Checklist

Use this checklist before launching:

### Development Setup

- [ ] Created frontend `.env` file
- [ ] Created backend `server/.env` file
- [ ] Database connection works
- [ ] Google OAuth works (test login)
- [ ] Google Maps displays correctly
- [ ] Stripe test payments work
- [ ] Email sending works
- [ ] Image uploads work (Cloudinary)

### Production Setup

- [ ] Updated `EXPO_PUBLIC_API_URL` to production URL
- [ ] Switched Stripe to live keys (`sk_live_...`)
- [ ] Updated `STRIPE_WEBHOOK_SECRET` with production secret
- [ ] Configured Google OAuth redirect URIs for production
- [ ] Restricted Google Maps API keys
- [ ] Set up Cloudinary production folder
- [ ] Updated Railway environment variables
- [ ] Tested all integrations in production

### Security

- [ ] All secrets in environment variables (not hardcoded)
- [ ] `.env` files in `.gitignore`
- [ ] API keys restricted by domain/package
- [ ] Strong `JWT_SECRET` (32+ characters)
- [ ] Database password is strong
- [ ] Webhook secrets configured

---

## Troubleshooting

### Google OAuth Issues

**Error: "Sign in with Google failed"**
- Check client IDs match platform (Android/iOS)
- Verify package name/bundle ID matches `app.json`
- Ensure OAuth consent screen is published
- Check SHA-1 fingerprint for Android

**Error: "redirect_uri_mismatch"**
- Add redirect URI to Google Cloud Console
- Format: `https://your-domain.com/auth/google/callback`

### Stripe Issues

**Error: "No such price"**
- Price ID doesn't exist in Stripe
- Check you're using correct mode (test vs live)
- Verify `STRIPE_PRICE_VETERAN` and `STRIPE_PRICE_LEGEND`

**Webhook not receiving events**
- Check endpoint URL is correct
- Verify webhook signing secret
- Ensure server is publicly accessible
- Check Stripe Dashboard → Webhooks → Logs

### Email Issues

**Error: "Invalid login"**
- Use app-specific password, not regular Gmail password
- Enable 2FA on Google account first
- Check `SMTP_USER` and `SMTP_PASS` are correct

**Emails not sending**
- Check spam folder
- Verify `FROM_EMAIL` is valid
- Test with `npm run test:email`
- Check server logs for errors

### Maps Issues

**Maps not displaying**
- Enable required APIs in Google Cloud Console
- Check `GOOGLE_MAPS_API_KEY` is correct
- Verify API key restrictions (if any)
- Check quota limits in Google Cloud Console

---

## Next Steps

- **[Development Guide](./04-DEVELOPMENT.md)** - Start building
- **[API Reference](./06-API.md)** - Explore backend endpoints
- **[Production Deployment](./07-PRODUCTION.md)** - Launch the app

---

**Questions?** See [Troubleshooting](./11-TROUBLESHOOTING.md) or contact the dev team.
