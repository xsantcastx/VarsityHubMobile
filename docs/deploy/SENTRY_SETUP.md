# Sentry Setup Guide

This guide ensures Sentry is properly configured for both mobile app builds and server deployments.

## Required Environment Variables

### For Mobile App Builds (EAS)

**SENTRY_AUTH_TOKEN** - Required for uploading source maps during builds

This token is used by `sentry-cli` to upload source maps to Sentry during the Android/iOS build process. Without it, builds will fail with a clear error message.

#### Setting up SENTRY_AUTH_TOKEN in EAS

1. **Get your Sentry Auth Token:**
   - Go to https://sentry.io/settings/account/api/auth-tokens/
   - Click "Create New Token"
   - Select scopes: `project:read`, `project:releases`, `project:write`
   - Copy the token (you won't see it again!)

2. **Set in EAS Secrets (Project-wide):**
   ```bash
   eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token> --scope project --type string
   ```

3. **Set for specific environments (if needed):**
   ```bash
   # Production
   eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token> --scope project --environment production --type string
   
   # Preview
   eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token> --scope project --environment preview --type string
   
   # Development
   eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token> --scope project --environment development --type string
   ```

4. **Verify it's set:**
   ```bash
   eas secret:list
   ```

### For Server (Railway/Docker)

**SENTRY_DSN** - Required for error tracking at runtime

The server only needs the DSN (not the auth token) since it doesn't upload source maps.

Set in Railway:
- Go to Railway dashboard → Your API service → Variables
- Add `SENTRY_DSN` with your Sentry DSN URL
- Add `SENTRY_ENVIRONMENT` with value `production`

### For Mobile App Runtime

**EXPO_PUBLIC_SENTRY_DSN** - Required for error tracking in the app

Set in EAS Secrets:
```bash
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn-url> --scope project --type string
```

Or set in `eas.json` env section (less secure, but works):
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SENTRY_DSN": "https://..."
      }
    }
  }
}
```

## Current Configuration

### Mobile App
- **Sentry Package**: `@sentry/react-native@~7.2.0` ✅
- **Initialization**: `utils/sentry.ts` ✅
- **Error Boundary**: `components/ErrorBoundary.tsx` ✅
- **Build Integration**: `android/app/build.gradle` ✅
- **Sentry Properties**: `android/sentry.properties` & `ios/sentry.properties` ✅

### Server
- **Sentry Package**: `@sentry/node@^7.91.0` ✅
- **Initialization**: `server/src/lib/sentry.ts` ✅
- **Error Handling**: Integrated in Express app ✅

## Build Behavior

### Android Builds
- **With SENTRY_AUTH_TOKEN**: Source maps uploaded automatically ✅
- **Without SENTRY_AUTH_TOKEN**: Build fails with clear error message ❌
- **With SENTRY_DISABLE_AUTO_UPLOAD=true**: Uploads skipped, build succeeds ⚠️

### iOS Builds
- Same behavior as Android (handled by Sentry Gradle/Xcode plugin)

## Verification

### Check if Sentry is working:

1. **Mobile App:**
   - Trigger an error in production build
   - Check Sentry dashboard: https://sentry.io/organizations/varsity-hub/projects/varsity-hub-mobile/

2. **Server:**
   - Check server logs for: `✅ Sentry initialized for production environment`
   - Trigger an error endpoint
   - Check Sentry dashboard

### Test Build:
```bash
# This will fail if SENTRY_AUTH_TOKEN is missing
eas build --platform android --profile production

# This will skip Sentry uploads (for testing)
SENTRY_DISABLE_AUTO_UPLOAD=true eas build --platform android --profile production
```

## Troubleshooting

### Build fails: "SENTRY_AUTH_TOKEN is required"
- **Solution**: Set the token in EAS secrets (see above)

### Source maps not uploading
- Check token has correct scopes: `project:read`, `project:releases`, `project:write`
- Verify token in EAS: `eas secret:list`
- Check build logs for Sentry upload errors

### Errors not appearing in Sentry
- Verify `EXPO_PUBLIC_SENTRY_DSN` is set correctly
- Check `SENTRY_ENVIRONMENT` matches your environment
- Ensure app is not in `__DEV__` mode (Sentry disabled in dev)

## Organization & Project

- **Organization**: `varsity-hub`
- **Project**: `varsity-hub-mobile`
- **DSN**: Set via `EXPO_PUBLIC_SENTRY_DSN` environment variable
