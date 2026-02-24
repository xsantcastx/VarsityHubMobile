# ✅ Production Verification Checklist

**Date**: February 3, 2026  
**Purpose**: Verify 3 critical production flows are working correctly

---

## 📋 Test 1: Email Verification Loop (Coach Account)

### ✅ **Code Analysis - VERIFIED**

**Flow**:
1. Coach signs in with role + username but hasn't completed onboarding
2. Goes to Verify screen (`app/verify.tsx`)
3. Completes email verification
4. **EXPECTED**: Redirects to `/onboarding/step-3-plan` (or step-2 if username missing)
5. **NOT EXPECTED**: Should NOT redirect to step-1

### **Implementation Details**

**Verification Logic** (lines 65-98 in `app/verify.tsx`):
```typescript
const refreshed: any = await User.me();
const resolvedRole = refreshed?.preferences?.role || refreshed?.role;
const isFan = !resolvedRole || resolvedRole === 'fan';
const onboardingCompleted = refreshed?.preferences?.onboarding_completed;

if (onboardingCompleted) {
  destination = '/(tabs)/feed';  // Already completed
} else if (!isFan) {
  // Coach/org user - check progress
  const hasRole = !!resolvedRole && resolvedRole !== 'fan';
  const hasUsername = !!refreshed?.username;

  if (hasRole && hasUsername) {
    destination = '/onboarding/step-3-plan';  // ✅ CORRECT: Resume from step 3
  } else if (hasRole) {
    destination = '/onboarding/step-2-basic';  // ✅ CORRECT: Resume from step 2
  } else {
    destination = '/onboarding/step-1-role';  // Only if NO role yet
  }
} else {
  // Fan user
  await markOnboardingCompleteLocally();
}
```

### **Test Steps**

```bash
# Prerequisite: Have a coach account that:
# - Has role = 'coach' or 'org'
# - Has username set
# - email_verified = false
# - onboarding_completed = false

# Step 1: Sign in with this coach account
1. Open sign-in screen
2. Enter coach email/password
3. You'll be redirected to /verify (email verification screen)

# Step 2: Complete email verification
4. Check email for verification code (or use dev code if in dev mode)
5. Enter 6-digit code
6. Click "Verify Email"

# Step 3: Observe redirect
7. EXPECTED: Redirected to /onboarding/step-3-plan
8. EXPECTED: NOT redirected to step-1-role
9. EXPECTED: NOT redirected to step-2-basic (unless username missing)
```

### **Expected Behavior**

| Scenario | Expected Redirect | Status |
|----------|-------------------|--------|
| Coach with role + username | `/onboarding/step-3-plan` | ✅ Coded |
| Coach with role only | `/onboarding/step-2-basic` | ✅ Coded |
| Coach with no role | `/onboarding/step-1-role` | ✅ Coded |
| Fan user | `/(tabs)/feed` | ✅ Coded |
| Already completed onboarding | `/(tabs)/feed` | ✅ Coded |

### **Verification Status**

- ✅ **Code Review**: PASSED
- ⏳ **Manual Testing**: PENDING (Run steps above)
- ✅ **Security**: No sensitive data exposed

---

## 📋 Test 2: Dev Verification Code Exposure

### ✅ **Code Analysis - VERIFIED**

**Security Requirement**:
- In **PRODUCTION BUILDS** (`__DEV__ = false`): No dev code button, no dev code shown
- In **DEV BUILDS** (`__DEV__ = true`): Dev code button allowed, code shown

### **Implementation Details**

**Dev Code Gate** (line 30 in `app/verify.tsx`):
```typescript
// Only allow dev verification in development mode - NEVER in production
const devVerificationEnabled = useMemo(() => {
  return __DEV__;  // ✅ CORRECT: Only enabled when __DEV__ is true
}, []);
```

**Dev Button Rendering** (line 288-298):
```typescript
{devVerificationEnabled && (  // ✅ Only shows if __DEV__ = true
  <Pressable
    style={[styles.devButton, devCodeLoading && styles.devButtonDisabled]}
    onPress={handleUseDevCode}
    disabled={devCodeLoading}
  >
    <Ionicons name="bug-outline" size={16} color="#065F46" />
    <Text style={styles.devButtonText}>
      {devCodeLoading ? 'Fetching dev code...' : 'Use dev code (testing only)'}
    </Text>
  </Pressable>
)}
```

**Dev Code Container** (line 282-287):
```typescript
{devCode ? (  // Only shows if devCode is set
  <View style={styles.devCodeContainer}>
    <Ionicons name="bug-outline" size={16} color="#059669" />
    <Text style={styles.devCodeText}>Dev Code: {devCode}</Text>
  </View>
) : null}
```

### **Test Steps**

#### **Test 2a: Development Build** (with `__DEV__ = true`)
```bash
# Step 1: Build in development mode
npm run dev
# or
expo start

# Step 2: Navigate to /verify screen
# Step 3: Look for "Use dev code (testing only)" button
✅ EXPECTED: Button appears
✅ EXPECTED: Dev code shown if fetched

# Step 4: Click "Use dev code (testing only)"
✅ EXPECTED: Dev code auto-fills and verification completes
```

#### **Test 2b: Production Build** (with `__DEV__ = false`)
```bash
# Step 1: Build in production mode
npm run build:web
# or
eas build --platform ios --profile production
# or manually: Set __DEV__ = false in metro.config.js

# Step 2: Navigate to /verify screen
# Step 3: Look for "Use dev code (testing only)" button
❌ EXPECTED: Button NOT visible
❌ EXPECTED: Dev code NOT shown

# Step 4: Verify code input only accepts manual codes
✅ EXPECTED: Only manual code entry allowed
```

### **Expected Behavior**

| Build Type | Dev Button | Dev Code Display | Status |
|------------|-----------|-----------------|--------|
| Development (`__DEV__=true`) | ✅ Visible | ✅ Shown if fetched | ✅ Coded |
| Production (`__DEV__=false`) | ❌ Hidden | ❌ Hidden | ✅ Coded |
| Production (Release APK) | ❌ Hidden | ❌ Hidden | ✅ Coded |
| Production (EAS Build) | ❌ Hidden | ❌ Hidden | ✅ Coded |

### **Verification Status**

- ✅ **Code Review**: PASSED
- ⏳ **Dev Build Testing**: PENDING (Run test 2a above)
- ⏳ **Production Build Testing**: PENDING (Run test 2b above)
- ✅ **Security**: Properly gated by `__DEV__` flag

---

## 📋 Test 3: Google Sign-In Platform Checks

### ✅ **Code Analysis - VERIFIED**

**Requirement**:
- Google button **ENABLED** only when platform-specific client ID is present
- Google button **DISABLED with "unavailable"** message when client ID missing
- Shows helpful message: "Add Google OAuth client IDs to enable this option."

### **Implementation Details**

**Platform Check** (`hooks/useGoogleAuth.ts` lines 86-99):
```typescript
const isConfigured = useMemo(() => {
  if (Platform.OS === 'android') {
    return Boolean(clients.androidClientId);  // ✅ Only Android client ID
  }
  if (Platform.OS === 'ios') {
    // For iOS, we need either iOS client ID or Expo client ID (for Expo Go)
    return Boolean(clients.iosClientId || clients.expoClientId);  // ✅ iOS-specific
  }
  if (Platform.OS === 'web') {
    return Boolean(clients.webClientId);  // ✅ Web-specific
  }
  // Fallback: any client ID configured
  return Boolean(clients.androidClientId || clients.iosClientId || clients.webClientId || clients.expoClientId);
}, [clients]);
```

**Button Rendering in Sign-In** (`app/sign-in.tsx` lines 272-294):
```typescript
{googleReady ? (
  <Pressable
    style={[styles.googleButton, googleLoading && styles.buttonDisabled, ...]}
    onPress={handleGoogleLogin}
    disabled={googleLoading}
  >
    <Text style={[styles.googleButtonText, ...]}>Continue with Google</Text>
  </Pressable>
) : (
  <Pressable
    style={[styles.googleButton, styles.disabledGoogleButton, ...]}
    disabled
  >
    <Text style={[styles.googleButtonText, ...]}>Google sign in unavailable</Text>
    <Text style={[styles.googleButtonSubtext, ...]}>
      Add Google OAuth client IDs to enable this option.
    </Text>
  </Pressable>
)}
```

**Client ID Configuration** (`config/env.ts`):
```typescript
// From environment variables:
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
```

### **Test Steps**

#### **Test 3a: iOS Platform (with client ID)**
```bash
# Prerequisite: Set environment variables
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="your-ios-client-id.apps.googleusercontent.com"

# Step 1: Build for iOS
eas build --platform ios
# or run in Expo Go on iOS device

# Step 2: Navigate to sign-in screen
# Step 3: Look for Google button
✅ EXPECTED: "Continue with Google" button is ENABLED (blue/active)

# Step 4: Click Google button
✅ EXPECTED: Google OAuth flow starts
```

#### **Test 3b: iOS Platform (without client ID)**
```bash
# Prerequisite: Client ID NOT set
unset EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID

# Step 1: Build for iOS
eas build --platform ios
# or run in Expo Go on iOS device

# Step 2: Navigate to sign-in screen
# Step 3: Look for Google button
❌ EXPECTED: "Google sign in unavailable" (grayed out)
✅ EXPECTED: Helpful message: "Add Google OAuth client IDs to enable this option."

# Step 4: Click button
❌ EXPECTED: Nothing happens (button disabled)
```

#### **Test 3c: Android Platform (with client ID)**
```bash
# Prerequisite: Set environment variable
export EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID="your-android-client-id.apps.googleusercontent.com"

# Step 1: Build for Android
eas build --platform android
# or run on Android device/emulator

# Step 2: Navigate to sign-in screen
# Step 3: Look for Google button
✅ EXPECTED: "Continue with Google" button is ENABLED

# Step 4: Click Google button
✅ EXPECTED: Google OAuth flow starts
```

#### **Test 3d: Android Platform (without client ID)**
```bash
# Prerequisite: Client ID NOT set
unset EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

# Step 1: Build for Android
eas build --platform android
# or run on Android device/emulator

# Step 2: Navigate to sign-in screen
# Step 3: Look for Google button
❌ EXPECTED: "Google sign in unavailable" (grayed out)
✅ EXPECTED: Helpful message shown

# Step 4: Click button
❌ EXPECTED: Nothing happens (button disabled)
```

#### **Test 3e: Web Platform (with client ID)**
```bash
# Prerequisite: Set environment variable
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="your-web-client-id.apps.googleusercontent.com"

# Step 1: Run web build
npm run web
# or
expo web

# Step 2: Navigate to sign-in screen
# Step 3: Look for Google button
✅ EXPECTED: "Continue with Google" button is ENABLED

# Step 4: Click Google button
✅ EXPECTED: Google OAuth flow starts (popup or redirect)
```

#### **Test 3f: Expo Go (with Expo client ID)**
```bash
# Prerequisite: Set Expo client ID
export EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID="expo-client-id.apps.googleusercontent.com"

# Step 1: Start in Expo Go
expo start

# Step 2: Open in Expo Go on iOS
# Step 3: Navigate to sign-in screen
# Step 4: Look for Google button
✅ EXPECTED: "Continue with Google" button is ENABLED

# Step 5: Click Google button
✅ EXPECTED: Google OAuth flow starts
```

### **Expected Behavior Matrix**

| Platform | Client ID Present | Button State | Status |
|----------|------------------|--------------|--------|
| iOS | ✅ Present | ✅ Enabled | ✅ Coded |
| iOS | ❌ Missing | ❌ Disabled | ✅ Coded |
| Android | ✅ Present | ✅ Enabled | ✅ Coded |
| Android | ❌ Missing | ❌ Disabled | ✅ Coded |
| Web | ✅ Present | ✅ Enabled | ✅ Coded |
| Web | ❌ Missing | ❌ Disabled | ✅ Coded |
| Expo Go (iOS) | ✅ Present | ✅ Enabled | ✅ Coded |
| Expo Go (iOS) | ❌ Missing | ❌ Disabled | ✅ Coded |

### **Verification Status**

- ✅ **Code Review**: PASSED
- ⏳ **iOS Testing**: PENDING (Run tests 3a & 3b)
- ⏳ **Android Testing**: PENDING (Run tests 3c & 3d)
- ⏳ **Web Testing**: PENDING (Run test 3e)
- ⏳ **Expo Go Testing**: PENDING (Run test 3f)
- ✅ **Security**: Properly gated by environment variables

---

## 🎯 Summary of Tests

### Code Quality

| Test | Code Review | Issue Found | Status |
|------|-------------|------------|--------|
| Email verification loop | ✅ PASSED | None | ✅ VERIFIED |
| Dev code exposure | ✅ PASSED | None | ✅ VERIFIED |
| Google sign-in checks | ✅ PASSED | None | ✅ VERIFIED |

### Manual Testing Status

| Test | Status | Priority |
|------|--------|----------|
| Test 1 (Email verification) | ⏳ PENDING | HIGH |
| Test 2a (Dev build dev code) | ⏳ PENDING | HIGH |
| Test 2b (Production build no dev code) | ⏳ PENDING | HIGH |
| Test 3a-f (Google sign-in platforms) | ⏳ PENDING | HIGH |

---

## 📝 How to Run Tests

### Quick Start
```bash
# Test 1: Email verification (dev environment)
1. Sign in with coach account (role + username, not verified)
2. Complete email verification
3. Check redirect is to /onboarding/step-3-plan (NOT step-1)

# Test 2: Dev code exposure (dev mode)
npm run dev
# Navigate to /verify, look for "Use dev code" button
# Should be visible in dev, NOT visible in production

# Test 3: Google sign-in (all platforms)
# iOS: Ensure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID is set
# Android: Ensure EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID is set
# Web: Ensure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set
# Then check button state on each platform
```

---

## ✅ Verification Checklist

- [ ] **Test 1 Passed**: Email verification redirects to correct step
- [ ] **Test 2a Passed**: Dev build shows dev code button
- [ ] **Test 2b Passed**: Production build hides dev code button
- [ ] **Test 3a Passed**: iOS with client ID enables button
- [ ] **Test 3b Passed**: iOS without client ID disables button
- [ ] **Test 3c Passed**: Android with client ID enables button
- [ ] **Test 3d Passed**: Android without client ID disables button
- [ ] **Test 3e Passed**: Web with client ID enables button
- [ ] **Test 3f Passed**: Expo Go with client ID enables button

---

## 🔍 Troubleshooting

### Test 1: Email verification redirects to wrong step
**Check**:
- User has `role` set (coach/org, not fan)
- User has `username` set
- User has `email_verified = false`
- User has `onboarding_completed = false`

**If redirects to step-1**: User might not have role set. Check `User.me().preferences.role`.

**If redirects to feed**: User might already have `onboarding_completed = true`. Check server status.

### Test 2: Dev code button visible in production
**Check**:
- Build is release mode: `npm run build:web` or `eas build --profile production`
- `__DEV__` is actually false (not just in config, but at runtime)
- App was properly rebuilt (clear cache if needed)

### Test 3: Google button disabled when it should be enabled
**Check**:
- Environment variable is set: `echo $EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
- Variable is in `.env` file or CI/CD secrets
- App was rebuilt after setting environment variable
- On correct platform (iOS vs Android)

### Test 3: Google button enabled when it should be disabled
**Check**:
- Environment variable is NOT set
- No client ID in `config/env.ts` fallbacks
- App was rebuilt after unsetting environment variable

---

## 📞 Questions?

If any test fails, please:
1. Share which test failed (1, 2a, 2b, 3a-f)
2. Share the actual vs expected behavior
3. Share platform (iOS/Android/Web/Expo Go)
4. Share any error messages or console logs

I'll help troubleshoot!
