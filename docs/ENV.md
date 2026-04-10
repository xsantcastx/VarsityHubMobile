# Environment Guide

## Files

- Root app + local full-stack development: `.env`
- Server-only local overrides: `server/.env`
- Safe examples:
  - `.env.example`
  - `server/.env.example`

## App Variables

- `EXPO_PUBLIC_API_URL`
  - Base URL the Expo app uses for API calls.
- `EXPO_PUBLIC_APP_SCHEME`
  - Deep-link scheme for local and production app links.
- `EXPO_PUBLIC_NODE_ENV`
  - Frontend environment hint.
- `EXPO_PUBLIC_USE_LOCAL_API`
  - Enables local API usage during development.
- `EXPO_PUBLIC_SENTRY_DSN`
  - Client-side Sentry DSN.
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
  - Mobile maps key.
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
  - Google sign-in client IDs.
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - Stripe publishable key.

## Server Variables

- `NODE_ENV`, `PORT`, `HOST`
  - Server runtime settings.
- `DATABASE_URL`
  - PostgreSQL connection string.
- `JWT_SECRET`
  - Required 32+ character signing secret.
- `ALLOWED_ORIGINS`
  - Comma-separated CORS allowlist.
- `APP_BASE_URL`
  - Canonical browser URL used in emails and links.
- `FRONTEND_URL`
  - Local frontend URL used in some flows.
- `APP_SCHEME`
  - App deep-link scheme.
- `ADMIN_EMAILS`
  - Comma-separated admin list.
- `SENTRY_DSN`
  - Server-side Sentry DSN.
- `GOOGLE_OAUTH_CLIENT_IDS`
  - Allowed Google OAuth audiences.
- `GOOGLE_MAPS_API_KEY`
  - Server maps key.
- `CLOUDINARY_*`
  - Media upload config.
- `REDIS_URL`
  - Queue and worker backend.
- `STRIPE_*`
  - Billing and webhook configuration.

## Email Variables

See [EMAIL_ENV.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_ENV.md).

## Secret Handling

- No API keys or secrets should be committed to Git.
- The audited workspace contained a local `server/.env` file, but it is ignored and not tracked.
- If a secret was ever committed previously, rotate it in the provider console and update your deployment environment immediately.
