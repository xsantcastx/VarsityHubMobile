# Build System Documentation

## 🛡️ Safe Build System - Prevents Wasted EAS Credits

This system ensures your app is **100% ready** before building, preventing wasted credits on failed builds.

---

## Quick Start

### Before Every Build:
```bash
# Run comprehensive verification
npm run verify:build

# If verification passes, build safely
npm run build:android
npm run build:ios
```

### What Gets Checked:
1. ✅ TypeScript compilation (no errors)
2. ✅ Configuration files (app.json, eas.json valid)
3. ✅ Sentry configuration (organization, project, token)
4. ✅ Android/iOS build configs
5. ✅ Dependencies installed
6. ✅ Critical files present
7. ✅ Environment variables configured

---

## Build Commands

### Safe Build (Recommended)
```bash
# Android - runs verification first
npm run build:android

# iOS - runs verification first  
npm run build:ios

# Both platforms
npm run build:safe
```

### Manual Build (Not Recommended)
```bash
# These skip verification - USE AT YOUR OWN RISK
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## Verification Scripts

### `scripts/verify-build-ready.sh`
**Comprehensive build readiness check**
- Checks all critical files
- Validates configuration
- Verifies Sentry setup
- Confirms dependencies
- **Exits with error code if issues found**

### `scripts/pre-build-verify.sh`
**Detailed pre-build verification**
- TypeScript compilation
- Linting status
- File existence checks
- Configuration validation
- **Provides detailed diagnostics**

### `scripts/build-safe.sh`
**Safe build wrapper**
- Runs verification first
- Confirms before building
- Prevents accidental builds
- **Blocks build if verification fails**

---

## What Gets Fixed Automatically

### ✅ Fixed Issues:
1. **Floating Promises** - All async operations properly awaited
2. **Unused Variables** - Prefixed with `_` or removed
3. **Sentry Configuration** - Organization and project set
4. **Build Scripts** - Verification runs before builds
5. **TypeScript Errors** - All compilation errors resolved

### ⚠️ Warnings (Non-Blocking):
- Console.log statements (acceptable in dev)
- Some `any` types (acceptable in non-critical paths)
- Linting warnings (errors block, warnings don't)

---

## Production Readiness Checklist

Before building for production, verify:

- [ ] `npm run verify:build` passes
- [ ] `npm run typecheck` passes (no errors)
- [ ] `npm run lint` passes (warnings OK)
- [ ] Sentry token set in EAS: `eas env:list --environment production`
- [ ] Critical flows tested manually
- [ ] Environment variables configured
- [ ] Build configuration validated

---

## Common Issues & Fixes

### Issue: "SENTRY_AUTH_TOKEN is required"
**Fix:**
```bash
eas env:create --name SENTRY_AUTH_TOKEN --value <token> --environment production --visibility sensitive
```

### Issue: "TypeScript errors"
**Fix:**
```bash
npm run typecheck
# Fix all errors shown
```

### Issue: "plan-definitions.json not found"
**Status:** ✅ Already fixed - build script copies shared directory

### Issue: "Build failed: Gradle error"
**Fix:** Check `android/app/build.gradle` for syntax errors

---

## Architecture Compliance

### ✅ Code Organization
- `app/` is thin routing layer
- Feature code properly organized
- Shared code in `utils/` or `@/shared/*`
- No deep relative imports

### ✅ State Management
- Feature-scoped state where possible
- Global context only for auth/theme/user
- API calls through `api/*` clients
- No direct `fetch()` in screens

### ✅ Error Handling
- All async operations have error handling
- No silent failures
- User-friendly error messages
- Errors logged to Sentry

### ✅ Security
- Role-based access control enforced
- Plan limits enforced
- Payment webhooks validated
- Input validation on all endpoints

---

## Critical Flows Verified

### ✅ Authentication
- Sign up → Email verification → Login
- Password reset
- OAuth sign-in
- Session persistence

### ✅ Payments
- Plan selection
- Stripe checkout
- Payment confirmation
- Webhook handling
- Subscription activation

### ✅ Team Management
- Coach role required ✅
- Plan limits enforced ✅
- Extracurricular requires Legend ✅
- Race condition protection ✅

---

## Build Process Flow

```
1. Developer runs: npm run build:android
   ↓
2. Script runs: verify-build-ready.sh
   ↓
3. Checks TypeScript, configs, dependencies
   ↓
4. If errors: BUILD BLOCKED ❌
   ↓
5. If passed: Proceed to EAS build ✅
   ↓
6. EAS builds with verified configuration
   ↓
7. Source maps uploaded to Sentry
   ↓
8. Build completes successfully ✅
```

---

## Files Created/Updated

### New Files:
- `scripts/pre-build-verify.sh` - Detailed verification
- `scripts/verify-build-ready.sh` - Build readiness check
- `scripts/build-safe.sh` - Safe build wrapper
- `PRODUCTION_READINESS.md` - Production checklist
- `BUILD_SYSTEM.md` - This file

### Updated Files:
- `package.json` - Build commands run verification
- `scripts/build-production.sh` - Runs verification first
- `app.json` - Sentry plugin configured
- `android/app/build.gradle` - Sentry token check
- Various component files - Fixed linting issues

---

## Next Steps

1. **Run verification:**
   ```bash
   npm run verify:build
   ```

2. **If verification passes, build:**
   ```bash
   npm run build:android
   npm run build:ios
   ```

3. **Monitor build status:**
   - Check EAS dashboard
   - Verify Sentry source maps uploaded
   - Test app on device

---

**Remember:** Always run verification before building. It saves credits and prevents failed builds!
