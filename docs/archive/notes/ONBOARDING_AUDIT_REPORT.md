# Onboarding Flow Audit - December 12, 2025

## 🔍 Issues Found

### 1. ⚠️ **CRITICAL: Race Condition in Auth Routing**

**Location:** `context/AuthProvider.tsx` lines 370-378

**Problem:**
The routing logic depends on `user.preferences?.onboarding_completed` being accurate from the server, but there's a race condition:

- On app startup, `checkAuth()` fetches `/me` endpoint
- If server is slow or returns cached data, the flag might be stale
- User gets redirected to onboarding even if they completed it

**Current Code:**

```tsx
const serverSaysIncomplete = user.preferences?.onboarding_completed === false;
const needsOnboarding = serverSaysIncomplete;

if (needsOnboarding && firstSegment !== 'onboarding') {
  router.replace('/onboarding/step-1-role');
  return;
}
```

**Issue:** No fallback to AsyncStorage or double-check mechanism

---

### 2. ⚠️ **Potential Data Loss: Missing Error Handling**

**Location:** `app/onboarding/step-10-confirmation.tsx` lines 207-248

**Problem:**
If `User.completeOnboarding()` fails or returns incomplete data, the app still navigates away from onboarding:

```tsx
try {
  await User.completeOnboarding(completionPayload);
  // ... validation happens here
  await markOnboardingCompleteLocally();
  clearOnboarding();
  router.replace('/(tabs)');
} catch (e: any) {
  // Alert shown but onboarding data may be cleared
  Alert.alert('Setup Failed', ...);
} finally {
  setCompleting(false);
}
```

**Issue:** If backend fails, local onboarding state is still cleared

---

### 3. ⚠️ **Inconsistent State Management**

**Location:** Multiple files

**Problem:**
Onboarding completion state is tracked in 3 places:

1. **Server:** `user.preferences.onboarding_completed`
2. **AsyncStorage:** `ONBOARDING_COMPLETE_KEY`
3. **OnboardingContext:** Local state

These can get out of sync, causing:

- User sees onboarding again after completing
- User bypasses onboarding when they shouldn't
- Confusion about source of truth

---

### 4. 🟡 **Performance: Unnecessary Re-renders**

**Location:** `context/AuthProvider.tsx` lines 334-362

**Problem:**
Routing logic runs on every navigation change and auth state change:

```tsx
useEffect(() => {
  if (initializing) return;
  // Complex routing logic runs repeatedly
}, [initializing, user, pendingVerificationEmail, healthOk, router, segmentsRef.current]);
```

**Issue:** Could cause UI flicker or stuttering

---

### 5. 🟡 **Fan vs Coach Flow Divergence**

**Location:** `app/onboarding/step-9-features.tsx` lines 130-160

**Problem:**
Fans complete onboarding at step 9, coaches at step 10:

```tsx
if (ob.role === 'fan') {
  await User.completeOnboarding(payload);
  router.replace('/(tabs)/feed');
  return;
}
// Coaches go to step 10
setProgress(7);
router.push('/onboarding/step-10-confirmation');
```

**Issue:** Two different completion paths increase complexity and bug surface area

---

### 6. 🔴 **CRITICAL: Google/Apple Sign-In Blocks Onboarding**

**Location:** OAuth flow + onboarding

**Problem:**
The "Unauthorized" error you're seeing happens before onboarding can even start. If OAuth fails:

- User is stuck on sign-in screen
- No onboarding progress
- Cannot access app

**Root Cause:** Missing redirect URI in Google Cloud Console

---

## 📊 Flow Diagram

```
New User Signs In
  ↓
OAuth Success?
  ├─ NO → Show error, stuck ❌
  └─ YES → Continue
       ↓
   Check /me endpoint
       ↓
   onboarding_completed?
       ├─ true → Go to feed ✅
       └─ false → Start onboarding
            ↓
       Step 1-8 (all users)
            ↓
       Step 9 (features)
            ├─ Fan → Complete here, go to feed
            └─ Coach → Continue to step 10
                 ↓
            Step 10 (confirmation)
                 ↓
            Complete onboarding
                 ↓
            Refresh /me
                 ↓
            onboarding_completed = true?
                 ├─ YES → Go to feed ✅
                 └─ NO → Show error, user stuck ❌
```

---

## 🔧 Recommended Fixes

### Priority 1: Fix OAuth (Blocks Everything)

1. Add redirect URI to Google Cloud Console:
   - `https://auth.expo.io/@lime_prod/varsityhub`
2. Test Google Sign-In works
3. Then proceed with onboarding testing

### Priority 2: Add Server Validation

```tsx
// In step-10-confirmation.tsx
const completeResult = await User.completeOnboarding(completionPayload);

// Force refresh to get latest server state
const updatedUser = await checkAuth();

// VALIDATE before proceeding
if (updatedUser?.preferences?.onboarding_completed !== true) {
  throw new Error('Server did not confirm onboarding completion');
}

// Only then clear local state
clearOnboarding();
router.replace('/(tabs)');
```

### Priority 3: Unify Completion Logic

- Move fan completion to step-10 (same as coaches)
- Single completion endpoint
- Consistent state management

### Priority 4: Add Retry Logic

```tsx
// If completion fails, allow retry
catch (e: any) {
  Alert.alert(
    'Setup Failed',
    e?.message || 'Try again',
    [
      { text: 'Retry', onPress: () => handleComplete() },
      { text: 'Cancel', style: 'cancel' }
    ]
  );
  // DO NOT clear onboarding state or navigate away
}
```

---

## 🧪 Test Plan

### Test 1: Fresh User Flow

1. Clear app data
2. Sign in with NEW Google account
3. Verify redirected to onboarding step 1
4. Complete all steps
5. Verify lands on feed
6. **Force quit app and reopen**
7. Verify stays on feed (does NOT restart onboarding)

### Test 2: Interrupted Flow

1. Start onboarding
2. Complete step 5
3. Force quit app
4. Reopen
5. Verify resumes at step 6 (not step 1)

### Test 3: Server Failure

1. Start onboarding
2. At step 10, simulate server error
3. Verify error shown
4. Verify onboarding state preserved
5. Retry
6. Verify completion works

### Test 4: Admin Bypass

1. Sign in as admin (`emilmancero@gmail.com`)
2. Verify goes straight to feed
3. Verify never sees onboarding

---

## 📈 Success Metrics

- ✅ 100% of users complete onboarding without loops
- ✅ 0% of users stuck in onboarding
- ✅ OAuth works for all providers
- ✅ Server is source of truth (no AsyncStorage conflicts)
- ✅ Graceful error handling with retry

---

## 🚨 Current Status

**OAuth:** ❌ BLOCKED (Google redirect URI missing)
**Onboarding Loop:** ⚠️ RISKY (race conditions exist)
**Data Loss:** ⚠️ POSSIBLE (incomplete error handling)
**User Experience:** 🟡 NEEDS WORK (two completion paths)

**Next Step:** Fix OAuth redirect URI first, then test full onboarding flow.
