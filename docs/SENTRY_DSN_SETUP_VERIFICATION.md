# Sentry DSN Setup Verification

## ✅ Current Status

**Sentry DSN is configured in `.env`** - This works for local development, but for **production EAS builds**, you need to set it in EAS secrets.

---

## Why This Matters

- **Local Development**: Uses `.env` file ✅ (Currently working)
- **EAS Production Builds**: Uses EAS secrets ❌ (Needs to be set)

During EAS builds, the `.env` file is **not available**. The DSN must be set in EAS secrets to work in production builds.

---

## How to Set Sentry DSN in EAS Secrets

### Step 1: Get Your Sentry DSN

1. Go to https://sentry.io/organizations/lime-productions/projects/varsityhub/
2. Navigate to **Settings** → **Client Keys (DSN)**
3. Copy your DSN (format: `https://xxx@xxx.ingest.sentry.io/xxx`)

### Step 2: Set in EAS Secrets

```bash
# Set for all environments (recommended)
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn-url> --scope project --type string

# Or set for specific environments
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn-url> --scope project --environment production --type string
eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn-url> --scope project --environment preview --type string
```

### Step 3: Verify It's Set

```bash
eas secret:list
```

You should see `EXPO_PUBLIC_SENTRY_DSN` in the list.

---

## Verification Checklist

- [x] Sentry package installed (`@sentry/react-native`)
- [x] Sentry initialization code present (`utils/sentry.ts`)
- [x] Sentry DSN configured in `.env` (for local dev)
- [ ] **Sentry DSN set in EAS secrets** (for production builds) ⚠️ **ACTION REQUIRED**

---

## How Sentry Works

### Code Flow:

1. `app/_layout.tsx` calls `initSentry()`
2. `utils/sentry.ts` checks for `EXPO_PUBLIC_SENTRY_DSN`:
   - First: `process.env.EXPO_PUBLIC_SENTRY_DSN` (from EAS secrets during builds)
   - Fallback: `appConfig.sentryDsn` (from `app.json` or `.env` in dev)
3. If valid DSN found and not in `__DEV__`, Sentry initializes
4. Errors are captured and sent to Sentry dashboard

### Production Build Behavior:

- ✅ **With EAS Secret**: Sentry works, errors tracked
- ❌ **Without EAS Secret**: Sentry disabled, no error tracking

---

## Testing Sentry

### 1. Local Development (with `.env`):

```bash
# .env has EXPO_PUBLIC_SENTRY_DSN set
npm run dev
# Sentry will be disabled in __DEV__ mode (by design)
```

### 2. Production Build (with EAS Secret):

```bash
# Build with EAS secret set
eas build --platform ios --profile production

# Install on device
# Trigger an error
# Check Sentry dashboard for the error
```

---

## Current Configuration

- **Organization**: `varsity-hub`
- **Project**: `varsityhub`
- **Package**: `@sentry/react-native@~7.2.0`
- **Initialization**: `utils/sentry.ts` ✅
- **Error Boundary**: `components/ErrorBoundary.tsx` ✅

---

## Next Steps

1. **Set Sentry DSN in EAS secrets** (if not already done):

   ```bash
   eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn> --scope project
   ```

2. **Verify in next build**:
   - Build a production version
   - Check build logs for Sentry initialization
   - Trigger a test error
   - Verify it appears in Sentry dashboard

3. **Monitor Sentry Dashboard**:
   - https://sentry.io/organizations/lime-productions/projects/varsityhub/
   - Check for errors after production release

---

## Troubleshooting

### "Sentry DSN not configured" warning

- **Cause**: DSN not set in EAS secrets
- **Fix**: Run `eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <dsn> --scope project`

### Errors not appearing in Sentry

- **Check**: DSN format is correct (`https://xxx@xxx.ingest.sentry.io/xxx`)
- **Check**: App is not in `__DEV__` mode (Sentry disabled in dev)
- **Check**: EAS secret is set for the correct environment

### Build fails with Sentry error

- **Check**: `SENTRY_AUTH_TOKEN` is set (for source map uploads)
- **Note**: `SENTRY_ALLOW_FAILURE=true` in `eas.json` allows builds to continue even if Sentry fails

---

**Last Updated**: January 27, 2026  
**Status**: ✅ Sentry configured in `.env`, ⚠️ Needs EAS secret for production builds
