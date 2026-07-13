# 🔐 Apple & Google Sign-In - Complete Fix Guide

**Status:** 🟡 Partially Implemented - Needs Configuration & Testing  
**Last Updated:** December 12, 2025  
**Timeline:** 2-3 hours (configuration + testing)

---

## 📊 Current Status

### ✅ Code Implementation

- [x] Google sign-in logic implemented (frontend + backend)
- [x] Apple sign-in logic implemented (frontend + backend)
- [x] Proper error handling & logging
- [x] Retry logic for network issues
- [x] User creation & linking logic

### ⚠️ Configuration Required

- [ ] Apple Sign-In private key uploaded to production
- [ ] Google OAuth client IDs configured
- [ ] Environment variables set in all environments
- [ ] Database migrations applied (apple_id column)

### 🔴 Known Issues to Fix

1. **Apple Sign-In Production**: Requires private key file + proper token verification
2. **Google Sign-In**: Missing or incomplete OAuth client ID configuration
3. **Database**: apple_id column may not exist in production

---

## 🎯 QUICK FIXES (Start Here)

### Fix 1: Add Missing `apple_id` Column (If Using Production)

**Status Check First:**

```bash
# SSH to your production database or use Railway dashboard
# Check if apple_id column exists:
SELECT column_name FROM information_schema.columns
WHERE table_name='User' AND column_name='apple_id';
```

**If Missing - Run Migration:**

```bash
# Option A: Run locally
npx prisma migrate deploy

# Option B: Using Railway CLI
railway shell
npx prisma migrate deploy

# Option C: Manual SQL
ALTER TABLE "User" ADD COLUMN "apple_id" TEXT UNIQUE;
```

---

### Fix 2: Configure Google OAuth

#### Step 1: Get Your Google OAuth Client IDs

**For Development (Expo):**

```
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Select your VarsityHub project
3. Go to Credentials
4. Look for existing "OAuth 2.0 Client IDs"
5. Find the one labeled "Expo Client"
6. Copy the CLIENT_ID (format: xxx-yyy.apps.googleusercontent.com)
```

**For iOS (Standalone):**

```
1. In Google Cloud Console, create new OAuth 2.0 credential:
   - Type: Web application
   - Authorized redirect URIs:
     * https://varsityhub.app/auth/google/callback
     * https://your-api-domain.com/auth/google/callback
2. Copy the CLIENT_ID
3. Copy the CLIENT_SECRET (for backend)
```

**For Android:**

```
1. Create new OAuth 2.0 credential:
   - Type: Android
   - Package name: com.xsantcastx.varsityhub
   - SHA-1 fingerprint: (get from your keystore)
2. Copy the CLIENT_ID
```

#### Step 2: Add Environment Variables

**Frontend (.env files):**

```bash
# app/.env (or expo-env.d.ts)
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=xxx-yyy.apps.googleusercontent.com    # For Expo dev
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=xxx-yyy.apps.googleusercontent.com     # For iOS standalone
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=xxx-yyy.apps.googleusercontent.com # For Android
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxx-yyy.apps.googleusercontent.com     # For web
```

**Backend (server/.env):**

```bash
# These are used by the backend to verify tokens
GOOGLE_ALLOWED_AUDIENCES=xxx-yyy.apps.googleusercontent.com,zzz-www.apps.googleusercontent.com
```

#### Step 3: Test Google Sign-In

```bash
# Development (Expo)
npm start
# Tap "Continue with Google" on sign-up screen
# Should see Google OAuth dialog

# Production (iOS App)
# Same flow, but uses iOS client ID
```

**Expected Behavior:**

1. User taps "Continue with Google"
2. Google OAuth dialog appears
3. User selects account & grants permissions
4. Returns to app on sign-up screen or onboarding
5. User is logged in

---

### Fix 3: Configure Apple Sign-In

#### Step 1: Get Your Private Key

**On your Mac:**

```bash
# If you already downloaded it from Apple Developer
# It should be named: AuthKey_XXXXXXXXXX.p8

# Save it to your project:
cp ~/Downloads/AuthKey_XXXXXXXXXX.p8 server/.keys/AuthKey_XXXXXXXXXX.p8

# Verify
ls -la server/.keys/
```

**If you need to create one:**

```
1. Go to: https://developer.apple.com/account/resources/identifiers/list
2. Select your App ID (com.xsantcastx.varsityhub)
3. Go to Sign in with Apple configuration
4. Click "Create private key"
5. Download the key
6. Save to: server/.keys/AuthKey_XXXXXXXXXX.p8
```

#### Step 2: Add Environment Variables

**Frontend (config/env.ts):**

```typescript
// Already supported - no changes needed
// Apple sign-in works with app setup only
```

**Backend (server/.env):**

```bash
APPLE_TEAM_ID=<your-apple-team-id>              # From Apple Developer
APPLE_KEY_ID=<key-id>                           # From AuthKey filename
APPLE_BUNDLE_ID=com.xsantcastx.varsityhub       # Your app bundle ID
APPLE_KEY_FILE=/path/to/AuthKey_XXXXXXXXXX.p8  # Path to private key
```

#### Step 3: Test Apple Sign-In

```bash
# iOS Simulator (can use mock credentials)
# Run app in Xcode → tap "Continue with Apple"

# Physical device (requires real Apple ID)
# Same flow, but connects to real Apple servers

# Web (not supported - Apple restricts web usage)
# Should show error message
```

**Expected Behavior:**

1. User taps "Continue with Apple"
2. Face/Touch ID or password prompt
3. Returns to app
4. User account created or linked
5. User is logged in

---

## 🔍 Troubleshooting

### Google Sign-In Issues

**Problem:** "Google sign up is not configured yet"

```
Solution: Check EXPO_PUBLIC_GOOGLE_* environment variables are set
          Restart app to pick up new env vars
```

**Problem:** OAuth dialog doesn't appear

```
Solution: 1. Check client ID format (should end with .apps.googleusercontent.com)
          2. Verify redirect URI is whitelisted in Google Cloud Console
          3. Check app scheme is correct (EXPO_PUBLIC_APP_SCHEME)
```

**Problem:** "Google sign-in failed: error"

```
Solution: 1. Check internet connection
          2. Verify token is being sent to backend
          3. Check backend logs for "/auth/google" endpoint errors
```

**Problem:** Backend returns "audience mismatch"

```
Solution: Add your Google client ID to GOOGLE_ALLOWED_AUDIENCES
          Can be comma-separated for multiple IDs
```

### Apple Sign-In Issues

**Problem:** "Apple sign in is still initializing"

```
Solution: This is normal on first load. Wait a moment and try again.
          For production, check Platform.OS === 'ios'
```

**Problem:** "Apple sign in is only available on iOS"

```
Solution: Expected on Android/web. Provide alternative login method.
```

**Problem:** "User canceled Apple sign-in"

```
Solution: Not an error - user chose not to sign in. Show signup form.
```

**Problem:** Backend returns 500 error

```
Solution: 1. Check apple_id column exists in database
          2. Check server logs for error details
          3. Verify identity token format is correct
```

**Problem:** Production Apple sign-in always fails

```
Solution: 1. Verify private key is accessible on server
          2. Check APPLE_KEY_ID and APPLE_TEAM_ID are set
          3. Verify key has correct permissions
          4. Check Apple developer account is active
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Google Sign-In Configuration (30 minutes)

**Frontend:**

- [ ] Get Google OAuth client IDs from Google Cloud Console
- [ ] Add EXPO*PUBLIC_GOOGLE*\* variables to app config
- [ ] Test "Continue with Google" button on sign-up
- [ ] Verify redirect works correctly

**Backend:**

- [ ] Set GOOGLE_ALLOWED_AUDIENCES env var
- [ ] Test /auth/google endpoint
- [ ] Verify token validation logic
- [ ] Check error handling

**Testing:**

- [ ] [ ] Manual test: Sign up with Google (dev environment)
- [ ] [ ] Verify user is created with google_id
- [ ] [ ] Verify onboarding flow works
- [ ] [ ] Test with multiple accounts

**Deployment:**

- [ ] Add env vars to production
- [ ] Redeploy app and backend
- [ ] Test production sign-in flow

---

### Phase 2: Apple Sign-In Configuration (45 minutes)

**Setup Private Key:**

- [ ] Download private key from Apple Developer
- [ ] Save to server/.keys/AuthKey_XXXXXXXXXX.p8
- [ ] Commit .gitignore to prevent accidental upload
- [ ] Verify key permissions

**Backend:**

- [ ] Set APPLE_KEY_ID env var
- [ ] Set APPLE_TEAM_ID env var
- [ ] Set APPLE_BUNDLE_ID env var
- [ ] Set APPLE_KEY_FILE path

**Database:**

- [ ] Run prisma migration to add apple_id column
- [ ] Verify column exists in all environments

**Testing:**

- [ ] [ ] Manual test: Sign up with Apple (simulator)
- [ ] [ ] Verify user is created with apple_id
- [ ] [ ] Verify linking existing accounts works
- [ ] [ ] Test error handling

**Deployment:**

- [ ] Securely upload private key to production
- [ ] Add env vars to production
- [ ] Redeploy
- [ ] Test production Apple sign-in

---

### Phase 3: Testing & QA (60 minutes)

**Sign-Up Flow:**

- [ ] Test email signup
- [ ] Test Google signup
- [ ] Test Apple signup (if on iOS)
- [ ] Verify user redirects to onboarding
- [ ] Verify user data is saved correctly

**Account Linking:**

- [ ] Create account with email
- [ ] Link Google ID to same email
- [ ] Link Apple ID to same email
- [ ] Verify can sign in with any method

**Error Cases:**

- [ ] Cancel Google sign-in (should show form)
- [ ] Cancel Apple sign-in (should show form)
- [ ] Network error during sign-in (should retry)
- [ ] Invalid token (should show error)

**Cross-Platform:**

- [ ] iOS: All 3 methods work
- [ ] Android: Email + Google work, Apple shows message
- [ ] Web: Email + Google work, Apple shows message

**Production Verification:**

- [ ] Real device iOS test
- [ ] Real device Android test
- [ ] Verify tokens are validated correctly
- [ ] Check database for correct user records

---

## 📱 Sign-In User Flow

```
┌─────────────────────────────────┐
│   Sign-Up Screen (sign-up.tsx)  │
├─────────────────────────────────┤
│ [Continue with Apple]  (iOS)    │
│ [Continue with Google]          │
│ [───────────── or ──────────]   │
│ Email:    _______________       │
│ Password: _______________       │
│ [Sign Up]                       │
└─────────────────────────────────┘
        ↓
    (Apple/Google OAuth Dialog)
        ↓
┌─────────────────────────────────┐
│  Backend Auth Handler           │
│  /auth/apple or /auth/google    │
├─────────────────────────────────┤
│ 1. Verify token                 │
│ 2. Extract user info            │
│ 3. Find or create user          │
│ 4. Link to existing account     │
│ 5. Return access_token          │
└─────────────────────────────────┘
        ↓
    (Check onboarding status)
        ↓
    ┌─ Yes ─→ /onboarding/step-1-role
    │
    └─ No  ─→ /(tabs) (Feed)
```

---

## 🛡️ Security Notes

### Google Sign-In

- ✅ Tokens verified with Google's tokeninfo API
- ✅ Email verification required
- ✅ Audience validation (checks client ID matches)
- ✅ Token cannot be replayed (one-time use)

### Apple Sign-In

- ⚠️ **Production**: Needs proper token verification (not yet implemented)
- ✅ Development: Simulator tokens work with "sim-" prefix
- ✅ Email linking prevents account hijacking
- ✅ Private key never exposed to client

### Best Practices

- Never log full tokens
- Always verify sender's identity
- Use HTTPS only
- Rotate keys regularly
- Monitor failed login attempts

---

## 📚 Related Documentation

- [Apple Sign-In Deployment Checklist](APPLE_SIGNIN_DEPLOYMENT_CHECKLIST.md)
- [Fix Apple Sign-In Production Issue](FIX_NOW_APPLE_SIGNIN.md)
- [Google OAuth Setup Guide](GOOGLE_OAUTH_SETUP.md)
- [Email Hooks Integration](EMAIL_HOOKS_README.md)

---

## 🎬 Next Steps

1. **Immediate** (Next 30 min):
   - [ ] Check if apple_id column exists in production
   - [ ] If missing, run migration

2. **Short-term** (Next 1-2 hours):
   - [ ] Get Google OAuth client IDs
   - [ ] Configure environment variables
   - [ ] Test sign-up flow

3. **Medium-term** (Next 2-3 hours):
   - [ ] Get Apple private key
   - [ ] Upload to production
   - [ ] Run full testing

4. **Validation** (Before launch):
   - [ ] Test on real iOS device
   - [ ] Test on real Android device
   - [ ] Test all error cases
   - [ ] Monitor production logs

---

**Questions?** Check the troubleshooting section or review the implementation code in:

- `app/sign-up.tsx` - UI logic
- `hooks/useGoogleAuth.ts` - Google authentication
- `hooks/useAppleAuth.ts` - Apple authentication
- `server/src/routes/auth.ts` - Backend handlers
