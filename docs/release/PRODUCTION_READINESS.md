# Production Readiness Checklist

**Last Updated:** January 26, 2026  
**Status:** Pre-Build Verification Required

This document ensures your app is ready for real-world production use before building.

## 🚨 CRITICAL: Run This Before Every Build

```bash
# Run comprehensive verification
bash scripts/verify-build-ready.sh

# If verification passes, then build
npm run build:android
npm run build:ios
```

**DO NOT BUILD** if verification fails - you will waste EAS credits!

---

## ✅ Pre-Build Verification (Automated)

### 1. TypeScript Compilation
- ✅ No TypeScript errors
- ✅ All types properly defined
- ✅ No `any` types in critical paths

### 2. Configuration Files
- ✅ `app.json` - Valid JSON, required fields present
- ✅ `eas.json` - Valid JSON, all profiles configured
- ✅ `tsconfig.json` - Properly configured
- ✅ `package.json` - Dependencies installed

### 3. Build Configuration
- ✅ Android: `build.gradle` configured correctly
- ✅ iOS: `Podfile` and Xcode project present
- ✅ Sentry: Organization and project configured
- ✅ EAS: All build profiles valid

### 4. Critical Dependencies
- ✅ `@sentry/react-native` installed
- ✅ `@sentry/node` installed (server)
- ✅ Expo SDK compatible versions
- ✅ All native modules properly linked

### 5. Environment Variables
- ✅ `EXPO_PUBLIC_SENTRY_DSN` configured
- ✅ `SENTRY_ORG` and `SENTRY_PROJECT` in eas.json
- ✅ `SENTRY_AUTH_TOKEN` set in EAS secrets (for builds)

### 6. API Domain Verification (Required)
- ✅ `EXPO_PUBLIC_API_URL` is set to a live API domain in build env
- ✅ `EXPO_PUBLIC_API_URL` is **not** the retired Railway hostname
- ✅ Health checks do not return `X-Railway-Fallback: true`
- ✅ Health checks do not return `Application not found`

Run these before every release:

```bash
API_URL=https://<live-api-domain> ./scripts/verify-railway-env.sh
BASE_URL=https://<live-api-domain> npm --prefix server run verify:production-health
```

---

## 🔒 Security & Validation Checks

### Authentication & Authorization
- ✅ JWT tokens properly validated
- ✅ Role-based access control enforced
- ✅ Coach-only features protected
- ✅ Admin features properly gated

### Data Validation
- ✅ Frontend validation matches backend
- ✅ Input sanitization on all user inputs
- ✅ SQL injection prevention (Prisma)
- ✅ XSS prevention in error messages

### Payment Security
- ✅ Stripe keys properly configured
- ✅ Webhook signature validation
- ✅ Payment callbacks verified
- ✅ No payment data in logs

---

## 🏗️ Architecture Compliance

### Code Organization
- ✅ `app/` directory is thin routing layer
- ✅ Feature code in appropriate locations
- ✅ Shared code in `@/shared/*` or `utils/`
- ✅ No deep relative imports

### State Management
- ✅ Feature-scoped state where possible
- ✅ Global context only for auth/theme/user
- ✅ API calls through `api/*` clients
- ✅ No direct `fetch()` calls in screens

### Error Handling
- ✅ All async operations have error handling
- ✅ No silent failures
- ✅ User-friendly error messages
- ✅ Errors logged to Sentry

### Loading States
- ✅ Loading states for all async operations
- ✅ Error states displayed to users
- ✅ Empty states for lists
- ✅ Success feedback for actions

---

## 💳 Critical User Flows

### Authentication Flow
- ✅ Sign up → Email verification → Login
- ✅ Password reset flow
- ✅ OAuth sign-in (Google/Apple)
- ✅ Session persistence
- ✅ Token refresh handling

### Onboarding Flow
- ✅ Role selection (Fan/Coach)
- ✅ Profile setup
- ✅ Plan selection
- ✅ Payment integration (for paid plans)
- ✅ Team/organization setup (coaches)

### Payment Flow
- ✅ Plan selection
- ✅ Stripe checkout
- ✅ Payment confirmation
- ✅ Subscription activation
- ✅ Webhook handling

### Team Management
- ✅ Team creation (coach only)
- ✅ Team member invites
- ✅ Role assignments
- ✅ Plan limit enforcement

---

## 📱 Platform-Specific Checks

### Android
- ✅ `build.gradle` configured
- ✅ `AndroidManifest.xml` permissions set
- ✅ Package name: `com.varsithub.varsityhub`
- ✅ Signing configuration
- ✅ ProGuard rules (if minification enabled)

### iOS
- ✅ `Podfile` configured
- ✅ Bundle identifier: `com.varsithub.varsityhub`
- ✅ Apple Team ID configured
- ✅ Info.plist permissions
- ✅ Signing certificates

---

## 🧪 Testing Requirements

### Before Production Build
- ✅ TypeScript compiles without errors
- ✅ Linting passes (warnings OK, errors block)
- ✅ Critical flows tested manually
- ✅ No console errors in production mode
- ✅ Sentry error tracking working

### Critical Flows to Test
1. **Registration & Email Verification**
   - User can sign up
   - Verification email arrives
   - Code verification works
   - User can log in after verification

2. **Onboarding & Payment**
   - Coach onboarding completes
   - Payment checkout opens
   - Payment succeeds
   - Subscription activates

3. **Team Creation**
   - Coach can create team
   - Plan limits enforced
   - Team appears in list
   - Members can be invited

4. **Post Creation**
   - User can create post
   - Media uploads work
   - Post appears in feed
   - No crashes on feed load

---

## 🚀 Build Process

### Pre-Build Steps (REQUIRED)
```bash
# 1. Run verification
bash scripts/verify-build-ready.sh

# 2. Fix any errors found

# 3. Run TypeScript check
npm run typecheck

# 4. Run linting (fix errors, warnings OK)
npm run lint

# 5. Verify Sentry token is set
eas env:list --environment production | grep SENTRY_AUTH_TOKEN
```

### Build Commands
```bash
# Android (runs verification first)
npm run build:android

# iOS (runs verification first)
npm run build:ios

# Both platforms
npm run build:production
```

### Post-Build Verification
- ✅ Build completes successfully
- ✅ App installs on device
- ✅ App launches without crashes
- ✅ Critical flows work
- ✅ Sentry source maps uploaded

---

## ⚠️ Common Build Failures & Fixes

### "SENTRY_AUTH_TOKEN is required"
**Fix:** Set token in EAS secrets
```bash
eas env:create --name SENTRY_AUTH_TOKEN --value <token> --environment production --visibility sensitive
```

### "TypeScript errors"
**Fix:** Run `npm run typecheck` and fix all errors

### "plan-definitions.json not found"
**Fix:** Already fixed - build script copies shared directory

### "Build failed: Gradle error"
**Fix:** Check `android/app/build.gradle` for syntax errors

### "iOS build failed: Pod install error"
**Fix:** Run `cd ios && pod install` locally first

---

## 📊 Production Readiness Score

Run this to get your readiness score:
```bash
bash scripts/verify-build-ready.sh
```

**Scoring:**
- 0 errors, 0 warnings = ✅ **READY FOR PRODUCTION**
- 0 errors, <10 warnings = ✅ **READY (warnings acceptable)**
- >0 errors = ❌ **NOT READY - Fix errors first**

---

## 🎯 Final Checklist Before Building

- [ ] Verification script passes
- [ ] TypeScript compiles without errors
- [ ] No critical linting errors
- [ ] Sentry token configured in EAS
- [ ] All critical flows tested
- [ ] Environment variables set
- [ ] Build configuration validated
- [ ] Ready to waste credits? **NO - Only build if verification passes!**

---

## 📚 Related Documentation

- `SENTRY_SETUP.md` - Sentry configuration guide
- `SENTRY_VERIFICATION.md` - Sentry verification report
- `EXPO_DOCTOR_FIXES.md` - Expo Doctor fixes
- `scripts/pre-build-verify.sh` - Detailed verification script
- `scripts/verify-build-ready.sh` - Build readiness check

---

**Remember:** Building without verification = Wasted credits. Always run verification first!
