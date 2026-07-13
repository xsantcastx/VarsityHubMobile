# Onboarding Loop Fix - Test Plan

## Overview

Test that the AsyncStorage persistence fix prevents users from being forced back into onboarding after app restart.

## Test Environment

- **Device:** iOS Simulator (iPhone 17 Pro)
- **Build:** Expo dev build from commit `4c002df`
- **Metro Server:** Port 8082 (or current active port)

## Test Steps

### Step 1: Start Fresh (Logout)

1. Open VarsityHub app on running simulator
2. Go to Settings tab → Account → Logout
3. Verify you're on the sign-in screen

### Step 2: Complete Onboarding Flow

1. Sign in with test account (email: `emilmancero@gmail.com` or create new)
2. Complete all 9 onboarding steps:
   - Step 1: Select role (Fan or Coach)
   - Step 2: Enter birthday & zip code
   - Step 3: Select team
   - Step 4: Select organization
   - Step 5: Select features
   - Step 6-9: Additional preferences
   - Step 10: Confirmation screen → tap "Get Started" or "Continue"
3. **Expected Result:** App navigates to main feed (Discover tab)
4. **Verify in Console:** Look for log message like `[Auth] onboarding completed, flag stored`

### Step 3: App Restart (Cold Kill)

1. In Xcode Simulator: Cmd+Q or Cmd+W to force-close the app
2. Re-tap VarsityHub icon to reopen

### Step 4: Verify Fix

**❌ BROKEN (Before Fix):**

- User forced back to onboarding Step 1
- Has to click through all 9 steps again

**✅ FIXED (After This Commit):**

- App loads main feed directly
- User NOT redirected to onboarding
- Console should show: `[Auth] AsyncStorage flag onboardingCompletedOnce is true, skipping onboarding`

### Step 5: Network Latency Test (Optional)

1. In Safari DevTools or Charles Proxy, throttle network to "Slow 3G"
2. Kill app and reopen while network is slow
3. Even with slow backend `/me` call, app should proceed to feed (not onboarding)
4. Once `/me` responds, routing confirms and proceeds

---

## Success Criteria

- ✅ User completes onboarding once
- ✅ On app restart, user goes straight to feed
- ✅ No redirect to onboarding steps
- ✅ Console shows AsyncStorage flag being loaded and used
- ✅ Works even if network is slow (AsyncStorage loads before backend response)

---

## Debugging

### Check AsyncStorage Flag

Open Xcode console and search for:

```
[Auth] AsyncStorage flag
[Auth] onboarding completed
ONBOARDING_COMPLETE_KEY
```

### Check Backend Response

Search for:

```
[http] GET /me
onboarding_completed: true
```

### Clear AsyncStorage (if needed)

In simulator, go to: **Simulator → Erase All Content and Settings**

Or manually in app settings: **Settings → Storage → Clear App Data** (if available)

---

## Rollback Plan

If test fails:

1. Check backend is returning `onboarding_completed: true` after completion
2. Check AsyncStorage.setItem is being called (verify import exists)
3. Check routing condition includes BOTH `user.preferences?.onboarding_completed === false && !onboardingCompletedOnce`
4. If AsyncStorage not persisting: check permissions in app.json and eas.json
5. If needed: revert commit `4c002df` and re-diagnose

---

**Test Date:** December 10, 2025  
**Tester:** [Your Name]  
**Result:** [ ] PASS [ ] FAIL  
**Notes:**
