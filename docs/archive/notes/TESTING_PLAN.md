# Onboarding Authentication Fix - Testing Plan

## 🧪 Critical Test Scenarios

### Test 1: Unauthenticated User Cannot Access Onboarding

**Objective**: Verify that users without authentication cannot reach onboarding

**Prerequisites**:

- Metro bundler running
- App builds successfully
- Simulator running

**Steps**:

1. **Fresh Start**: Clear app data from simulator
   - Simulator → Settings → General → iPhone Storage → VarsityHub → Delete
2. **Launch App**: Tap app icon
3. **Verify**: Should show sign-in screen (NOT onboarding)
4. **Try Deep Link**: If you can open deep link, try `varsityhub://onboarding/step-1-role`
5. **Result**: Should redirect to sign-in or show loading then sign-in

**Expected Behavior**:

- ✅ App shows sign-in screen
- ✅ Cannot access onboarding without signing in
- ✅ Deep link attempts redirect to sign-in
- ✅ Console logs: `[OnboardingLayout] Unauthenticated user detected`

---

### Test 2: Authenticated User Can Access Onboarding

**Objective**: After signing in, user should be able to access onboarding if incomplete

**Prerequisites**:

- Test 1 passed
- Have valid test credentials ready

**Steps**:

1. **Sign In**: From sign-in screen, use Google/Apple/Email to sign in
2. **Server Check**: Backend returns `onboarding_completed: false`
3. **Auto-Navigation**: App should automatically navigate to `/onboarding/step-1-role`
4. **Render**: Step 1 screen displays correctly
5. **Complete Onboarding**: Go through full flow to completion
6. **Server Save**: Complete button hits `/onboarding/complete` endpoint
7. **Validation**: App validates server response before navigating to feed
8. **Feed Access**: Lands on home feed

**Expected Behavior**:

- ✅ Signed-in users can access onboarding
- ✅ App automatically shows onboarding if incomplete
- ✅ Each step loads without errors
- ✅ Completion endpoint called
- ✅ Server validation passes
- ✅ App navigates to feed

---

### Test 3: Completed Onboarding Persistence

**Objective**: After completing onboarding, don't loop users back to it

**Prerequisites**:

- Test 2 completed successfully
- User is now on feed screen
- User has completed onboarding on server

**Steps**:

1. **Force Quit**: Kill the app completely
2. **Relaunch**: Open app again
3. **Observe**: What screen appears?
4. **Result**: Should go directly to feed, NOT onboarding

**Expected Behavior**:

- ✅ App skips onboarding
- ✅ Goes straight to feed
- ✅ No onboarding loop

---

### Test 4: Signed Out User Blocked from Onboarding

**Objective**: If user session expires/signs out, cannot continue onboarding

**Prerequisites**:

- On onboarding screen
- Have access to console/dev tools

**Steps**:

1. **Clear Auth**: Manually clear auth token from localStorage/AsyncStorage
2. **Try to Continue**: Attempt to complete a step
3. **Observe**: What happens?

**Expected Behavior**:

- ✅ Step fails to save (401 Unauthorized from server)
- ✅ OR user is redirected to sign-in
- ✅ Cannot proceed without re-authenticating

---

### Test 5: Returning to Onboarding After Completion

**Objective**: If completed user tries to navigate back to onboarding, are they blocked?

**Prerequisites**:

- Completed onboarding
- On feed screen
- Simulator or web dev tools

**Steps**:

1. **Deep Link**: Try to navigate to `/onboarding/step-1-role`
2. **Expected**: What happens?

**Expected Behavior**:

- ✅ Redirected to feed
- ✅ AuthProvider routing logic kicks in
- ✅ Cannot re-enter onboarding if complete

---

## 🐛 Edge Cases to Test

### Edge Case 1: Network Failure During Onboarding

**Scenario**: Internet disconnects mid-onboarding

1. Complete steps 1-8
2. Disconnect internet
3. Tap "Complete Setup" on step 10
4. **Expected**: Error shown with Retry button
5. Reconnect internet
6. Tap Retry
7. **Expected**: Success

---

### Edge Case 2: Backend Returns Stale Data

**Scenario**: Server doesn't immediately reflect completion

1. Complete all steps
2. App calls `User.me()` to validate
3. Server still returns `onboarding_completed: false`
4. **Expected**: Error shown, Retry button available
5. Retry should eventually succeed

---

## ✅ Validation Checklist

- [ ] App builds without errors
- [ ] No console errors or warnings
- [ ] Unauthenticated users cannot access onboarding
- [ ] Authenticated users CAN access onboarding
- [ ] Onboarding steps work correctly
- [ ] Completion endpoint called successfully
- [ ] Server validation passes
- [ ] User navigates to feed after completion
- [ ] Completed onboarding not re-shown
- [ ] Network failures handled gracefully
- [ ] Retry logic works

---

## 🚨 What to Watch For

1. **Unexpected Redirects**: Users should NOT see flashing between sign-in and onboarding
2. **Silent Failures**: Check console for auth errors
3. **State Leakage**: Ensure incomplete onboarding state doesn't persist improperly
4. **Race Conditions**: Rapid navigation shouldn't break auth checks

---

## 📝 Log Messages to Confirm Fix

When testing, you should see these console logs:

**For unauthenticated access attempts**:

```
[OnboardingLayout] Unauthenticated user detected - redirecting to sign-in
[Onboarding] Unauthenticated user trying to access onboarding - redirecting to sign-in
[Step1Role] Unauthenticated user - redirecting to sign-in
```

**For authenticated access**:

```
[AuthProvider] Routing check - segment: onboarding user: true
[OnboardingLayout] User authenticated, rendering onboarding
```
