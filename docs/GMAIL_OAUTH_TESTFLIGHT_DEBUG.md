# 🔴 CRITICAL: Gmail/Google OAuth TestFlight Debug Guide

## Problem Statement
Gmail login fails in TestFlight builds but works in development. This is a common iOS OAuth configuration issue.

## Root Causes (Check These First)

### 1. iOS Bundle ID Mismatch
**Current Bundle ID:** `com.xsantcastx.varsityhub` (from app.json)

**Action Required:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services → Credentials
3. Find your OAuth 2.0 Client ID for iOS
4. **VERIFY** the Bundle ID is EXACTLY: `com.xsantcastx.varsityhub`
5. Case-sensitive! Must match exactly.

**Common Mistakes:**
- ❌ Wrong bundle: `com.xsantcastx.VarsityHub` (capital V)
- ❌ Wrong bundle: `com.example.varsityhub`
- ❌ Missing iOS client ID entirely
- ✅ Correct: `com.xsantcastx.varsityhub`

---

### 2. OAuth Client IDs Configuration

**Current Environment Variables Needed:**
```bash
# .env file (server)
GOOGLE_OAUTH_CLIENT_IDS=<comma-separated-list>

# app.json or EAS build config
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<your-ios-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<your-android-client-id>.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<your-web-client-id>.apps.googleusercontent.com
```

**Check Current Setup:**
```typescript
// File: hooks/useGoogleAuth.ts (lines 19-20)
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
```

**Verification Steps:**
1. Check that iOS client ID exists in Google Console
2. Copy the FULL client ID (ends with `.apps.googleusercontent.com`)
3. Add to EAS build secrets OR app.json `extra` config
4. Rebuild the app

---

### 3. Redirect URI Configuration

**Required Redirect URIs for iOS:**
```
varsityhubmobile://
com.xsantcastx.varsityhub://
```

**Where to Add:**
1. Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs
2. Add BOTH schemes above
3. Save changes

**TestFlight Specific:**
- TestFlight uses the same bundle ID as production
- Redirect URIs must match the app scheme in `app.json`
- Current scheme: `varsityhubmobile` (from app.json line 7)

---

### 4. Backend Token Validation

**Current Implementation:** `server/src/routes/auth.ts`

```typescript
// Lines 13-16
const GOOGLE_ALLOWED_AUDIENCES = (process.env.GOOGLE_OAUTH_CLIENT_IDS || process.env.GOOGLE_OAUTH_AUDIENCE || '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);
```

**Action Required:**
1. Ensure `GOOGLE_OAUTH_CLIENT_IDS` in server `.env` includes:
   - iOS client ID
   - Android client ID  
   - Web client ID (if used)
2. Format: `id1.apps.googleusercontent.com,id2.apps.googleusercontent.com`
3. NO spaces, comma-separated

**Test Backend Validation:**
```bash
# In server directory
echo $GOOGLE_OAUTH_CLIENT_IDS
# Should show all client IDs
```

---

## 5. TestFlight-Specific Checks

### Info.plist Configuration
**File:** `ios/VarsityHub/Info.plist` (auto-generated)

**Required Keys:**
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>varsityhubmobile</string>
      <string>com.xsantcastx.varsityhub</string>
    </array>
  </dict>
</array>
```

**How to Verify:**
1. After EAS build, download the `.ipa`
2. Unzip and check `Info.plist`
3. Ensure URL schemes are present

---

## Step-by-Step Fix Process

### Step 1: Verify Google Console Setup
```bash
# Checklist:
☐ iOS OAuth client exists
☐ Bundle ID: com.xsanc tcastx.varsityhub (EXACT)
☐ Client ID copied correctly
☐ Redirect URIs added:
  - varsityhubmobile://
  - com.xsantcastx.varsityhub://
```

### Step 2: Update Environment Variables
```bash
# Server .env
GOOGLE_OAUTH_CLIENT_IDS=<ios-id>,<android-id>,<web-id>

# EAS Build Secrets (or app.json extra config)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-client-id>
```

### Step 3: Rebuild with EAS
```bash
# Clear old build
eas build:cancel

# New build with updated config
eas build --platform ios --profile production

# Or for TestFlight preview
eas build --platform ios --profile preview
```

### Step 4: Test in TestFlight
1. Install new build
2. Attempt Google sign-in
3. Check error logs:
   ```typescript
   // In sign-in.tsx, handleGoogleLogin catch block
   console.error('Google sign in failed:', e);
   ```

---

## Common Error Messages & Fixes

### Error: "Google authentication failed"
**Cause:** Backend rejected the token (audience mismatch)
**Fix:** Add iOS client ID to `GOOGLE_OAUTH_CLIENT_IDS` in server .env

### Error: "Invalid Google credential"
**Cause:** Token missing `sub` or `email` fields
**Fix:** Check Google Console → OAuth consent screen → Scopes include:
- `email`
- `profile`
- `openid`

### Error: "Google sign-in cancelled"
**Cause:** User canceled or redirect failed
**Fix:** Verify redirect URIs in Google Console

### Error: "Google sign in is not configured"
**Cause:** Client IDs not loaded in app
**Fix:** Check `useGoogleAuth.ts` - ensure `isConfigured` returns true

---

## Debugging Tools

### 1. Check Current Config in App
Add temporary debug screen:
```typescript
// In app/env-debug.tsx (already exists)
console.log('iOS Client ID:', process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
console.log('Android Client ID:', process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID);
```

### 2. Server-Side Token Validation Logs
```typescript
// In server/src/routes/auth.ts (line 91+)
console.log('[auth/google] Token audience:', payload.aud);
console.log('[auth/google] Allowed audiences:', GOOGLE_ALLOWED_AUDIENCES);
```

### 3. Expo Auth Session Debugging
```typescript
// In hooks/useGoogleAuth.ts
console.log('Auth request config:', requestConfig);
console.log('Redirect URI:', redirectUri);
```

---

## Quick Reference

| Component | File | Key Lines |
|-----------|------|-----------|
| Google OAuth Hook | `hooks/useGoogleAuth.ts` | 19-25 (client config) |
| Sign-in Screen | `app/sign-in.tsx` | 76-95 (Google login) |
| Backend Validation | `server/src/routes/auth.ts` | 13-16, 86-140 |
| Bundle Config | `app.json` | Line 29 (iOS bundleIdentifier) |
| Redirect Scheme | `app.json` | Line 7 (scheme) |

---

## Expected Working Flow

1. **User taps "Continue with Google"** → `sign-in.tsx` calls `signInWithGoogle()`
2. **OAuth prompt opens** → Expo AuthSession with `iosClientId`
3. **User approves** → Google returns `idToken`
4. **App sends token to backend** → `auth.loginWithGoogle(idToken)`
5. **Backend validates token** → Checks `aud` against `GOOGLE_OAUTH_CLIENT_IDS`
6. **Backend creates/updates user** → Returns `access_token`
7. **User logged in** → Redirects to feed

---

## Production Deployment Checklist

Before submitting to App Store:
- [ ] All Google client IDs added to environment
- [ ] Bundle ID matches Google Console exactly
- [ ] Redirect URIs configured
- [ ] TestFlight build tested successfully
- [ ] Server environment has all client IDs
- [ ] OAuth consent screen approved (if using restricted scopes)

---

## Support Resources

- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [Google OAuth iOS Setup](https://developers.google.com/identity/sign-in/ios/start)
- [EAS Build Environment Variables](https://docs.expo.dev/build-reference/variables/)

---

## Last Updated
**Date:** {{ current_date }}
**Status:** 🔴 CRITICAL - Blocking TestFlight users
**Priority:** URGENT - Fix before public beta
