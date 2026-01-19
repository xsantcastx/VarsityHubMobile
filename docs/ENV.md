# Environment Variables Guide

This document explains all environment variables used in the VarsityHub Mobile application.

---

## Quick Start

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your values (see sections below)

3. Restart your development server:
   ```bash
   npm run start
   ```

---

## Frontend Environment Variables

All frontend variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the app.

### API Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL | `https://api-production-8ac3.up.railway.app` | ✅ Yes |
| `EXPO_PUBLIC_FORCE_REMOTE_API` | Force remote API (1 = yes, 0 = no) | `1` | No |

**Development URLs:**
- Local: `http://localhost:4000`
- Android Emulator: `http://10.0.2.2:4000`
- iOS Simulator: `http://localhost:4000`

### App Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `EXPO_PUBLIC_NODE_ENV` | Environment mode | `development` or `production` | No |
| `EXPO_PUBLIC_APP_SCHEME` | Deep linking scheme | `varsityhubmobile` | No |
| `EXPO_PUBLIC_WEB_BASE_URL` | Web app base URL | `https://varsityhub.app` | No |
| `EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME` | Expo project identifier | `@varsityhub/varsityhub` | No |

### Google OAuth

Required for Google Sign-In functionality.

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client ID | ✅ Yes (Android) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client ID | ✅ Yes (iOS) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web/Backend OAuth client ID | ✅ Yes |
| `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` | Expo OAuth client ID | No (dev only) |
| `EXPO_PUBLIC_GOOGLE_FORCE_PROXY` | Force proxy (0 = no, 1 = yes) | No |

**How to get OAuth Client IDs:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials for each platform (Android, iOS, Web)
5. Copy the Client IDs to your `.env` file

### Google Maps

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key | ✅ Yes (for maps) |

**How to get Maps API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable Maps SDK for Android/iOS
3. Create API key
4. Restrict key to your app's bundle ID (recommended)

### Stripe (Payments)

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | ✅ Yes (for payments) |

**How to get Stripe keys:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Developers → API keys
3. Copy "Publishable key" (starts with `pk_test_` or `pk_live_`)
4. Use test keys for development, live keys for production

### Sentry (Error Tracking)

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking | No |

**How to get Sentry DSN:**
1. Go to [Sentry Dashboard](https://sentry.io)
2. Create a project
3. Copy the DSN from project settings

### Admin Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `EXPO_PUBLIC_ADMIN_EMAILS` | Comma-separated admin emails | No |

### Feature Flags

| Variable | Description | Default |
|----------|-------------|---------|
| `EXPO_PUBLIC_FORCE_SAMPLE_FEED` | Force sample feed for demos | `false` |
| `EXPO_PUBLIC_E2E` | Enable E2E testing mode | `0` |

---

## Backend Environment Variables

Backend variables are in `server/.env`. See `server/README.md` for details.

### Key Backend Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ Yes |
| `JWT_SECRET` | Secret for JWT token signing | ✅ Yes |
| `PORT` | Server port | No (default: 4000) |
| `STRIPE_SECRET_KEY` | Stripe secret key | ✅ Yes (for payments) |
| `SMTP_HOST` | Email SMTP host | ✅ Yes (for emails) |
| `SMTP_USER` | Email SMTP user | ✅ Yes |
| `SMTP_PASS` | Email SMTP password | ✅ Yes |

---

## Environment-Specific Configurations

### Development

```properties
EXPO_PUBLIC_API_URL=http://localhost:4000
EXPO_PUBLIC_NODE_ENV=development
EXPO_PUBLIC_FORCE_REMOTE_API=0
```

### Production

```properties
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
EXPO_PUBLIC_NODE_ENV=production
EXPO_PUBLIC_FORCE_REMOTE_API=1
```

---

## Security Notes

⚠️ **Never commit `.env` files to version control!**

- `.env` is already in `.gitignore`
- Use `.env.example` as a template
- Rotate secrets regularly
- Use different keys for development and production
- Restrict API keys in Google Cloud Console

---

## Troubleshooting

### Variables not loading?

1. **Restart Metro bundler**: Stop and restart `npm run start`
2. **Clear cache**: `npx expo start --clear`
3. **Check prefix**: All frontend vars must start with `EXPO_PUBLIC_`
4. **Check file location**: `.env` must be in project root

### OAuth not working?

1. Verify Client IDs are correct
2. Check bundle IDs match in Google Cloud Console
3. Ensure OAuth consent screen is configured
4. Check redirect URIs are correct

### Maps not loading?

1. Verify API key is correct
2. Enable Maps SDK in Google Cloud Console
3. Check API key restrictions
4. Verify billing is enabled (Maps requires billing)

---

## Additional Resources

- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
- [Google OAuth Setup](./GOOGLE_OAUTH_SETUP.md)
- [Backend Environment Setup](../server/README.md)
