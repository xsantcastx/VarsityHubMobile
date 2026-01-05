# VarsityHub iOS - Final QA Checklist
**December 11, 2025**

> ⚠️ **Status:** Not executed inside this CLI environment (simulator/TestFlight access required). Use the steps below to run the flows on your device, then mark each checkbox accordingly.

---

## 🚀 CRITICAL PATH TEST (5-10 minutes)

This checklist covers the three user flows that are blockers to launch:

### **Flow 1: Email Verification → Fan Role → Feed**

**Prerequisites:**
- Simulator running (or TestFlight build)
- Dev mode email verification enabled: `EXPO_PUBLIC_ENABLE_DEV_VERIFY=true` (shows code on screen)

**Steps:**
1. [ ] **Sign Up**
   - Open app
   - Tap "Don't have an account? Sign up"
   - Enter test email (e.g., `test@varsityhub.app`)
   - Enter name: "QA Test Fan"
   - Tap "Create Account"

2. [ ] **Verify Email (Dev Mode)**
   - Screen should show verify-email.tsx
   - Should display dev verification code on screen (6 digits)
   - Copy code and paste into input field
   - Tap "Verify Code"
   - ⏱️ **Telemetry Check**: DevTools → Network → POST `/auth/verify/confirm` should complete in <500ms
   - Screen should show "✅ Email verified successfully!"

3. [ ] **Role Selection**
   - After verification, should navigate to role selection screen
   - Select "Fan" role
   - Tap "Continue"
   - ⏱️ **Timing**: Should navigate within 1-2 seconds

4. [ ] **Onboarding Flow**
   - Step 1: Team creation (skip or create test team)
   - Step 2: Interests/sports selection
   - Step 3: Follow suggestions
   - Step 4: Notifications
   - Step 6: Invite friends
   - Step 7: Social media
   - Step 8: Avatar
   - Step 9: Features (should see 4 checkboxes, no validation errors)
   - Step 10: Finish
   - ⏱️ **Timing**: Entire onboarding should take <2 minutes without errors

5. [ ] **Final Screen**
   - Should land on **(tabs)/feed**
   - Feed should load within 3 seconds
   - Should see "Games Near You" section with FIFA games
   - Should see event cards with team names, dates, locations
   - ✅ **PASS**: App fully navigates to main content screen

---

### **Flow 2: Email Verification → Coach Role → Onboarding**

**Steps:**
1. [ ] **Sign Up & Verify** (repeat Flow 1, steps 1-2)
   - Use different email: `test-coach@varsityhub.app`

2. [ ] **Role Selection**
   - Select "Coach/Organizer" role
   - Tap "Continue"

3. [ ] **Plan Selection** (NEW - Coach Role Gating)
   - Should see plan options: **Rookie**, Veteran, Legend
   - Select "Rookie" plan
   - Tap "Get Started"
   - ⚠️ **Gating Check**: Backend should enforce Rookie limits (2 teams max, 1 authorized user per team)

4. [ ] **Onboarding Flow**
   - Complete all 9 steps (same as Flow 1)
   - Step 9 should show team management features (specific to coach role)
   - ✅ **PASS**: No "Invalid payload" errors on step 9

5. [ ] **Final Screen**
   - Should land on **(tabs)/feed** or coach-specific dashboard
   - ✅ **PASS**: Coach onboarding completes without errors

---

### **Flow 3: Error Handling & Edge Cases**

1. [ ] **Invalid Code Entry**
   - Start verification flow again
   - Enter wrong code (e.g., "123456" if correct is different)
   - Should see error: "Invalid verification code"
   - Dev code should still display (if dev mode enabled)
   - ✅ **PASS**: Error handling works

2. [ ] **Code Expiration** (if manual timing test)
   - Request verification code
   - Wait >30 minutes (or artificially expire in backend)
   - Try to verify
   - Should see: "Code has expired, please request a new one"
   - ✅ **PASS**: Expiration validation works

3. [ ] **Rate Limiting** (if manual testing)
   - Request verification code
   - Immediately request again (within 30 seconds)
   - Should see: "Please wait before requesting another code"
   - ✅ **PASS**: Rate limiting enforced

---

## 📊 TELEMETRY VERIFICATION

### **Frontend Telemetry (Sentry)**

Open Sentry dashboard → VarsityHub project:

1. [ ] **Successful Verification Event**
   - Should see events tagged: `context: "verify-email-success"`
   - Should have `extra.email` populated
   - Should have `tags.duration_ms` with verify time in milliseconds
   - Example: `verify_duration_ms: 245`

2. [ ] **Error Events**
   - If any errors during flow, should see them in Sentry
   - Tags should identify step: `context: "verify-email-verify"`, `"verify-email-refresh"`, etc.
   - All errors should be recoverable (not crash)

### **Backend Telemetry (Logs)**

Check server logs (Railway console or `eas logs`):

1. [ ] **Email Send**
   - Should see: `[verify/request] ✅ Email sent to test@varsityhub.app in Xms`
   - X should be <1000ms (typically 200-500ms)

2. [ ] **Verification Success**
   - Should see: `[verify/confirm] ✅ Code verified in Yms`
   - Y should be <100ms

3. [ ] **Rate Limiting** (if testing)
   - Should see: `[verify/request] Rate limit hit for test@varsityhub.app (30s cooldown)`
   - Only for requests within 30 seconds of last request

---

## ✅ FINAL SIGN-OFF

**Pass Criteria:**
- [ ] Flow 1 (Fan): Email verify → select role → onboard → feed ✅
- [ ] Flow 2 (Coach): Email verify → select role → select plan → onboard ✅
- [ ] Flow 3 (Errors): Invalid code, rate limiting, expiration handled gracefully ✅
- [ ] No crashes or unhandled exceptions
- [ ] Telemetry present in Sentry/logs
- [ ] Onboarding step-9 does not throw "Invalid payload" errors
- [ ] Coach plan gating visible (Rookie/Veteran/Legend options)

**Status After QA:**
- [ ] **PASS**: Ready for App Store submission
- [ ] **FAIL**: Issues found (list below)

---

## 🔴 ISSUES FOUND (if any)

| Step | Issue | Severity | Fix |
|------|-------|----------|-----|
| (example) | Error on step-6 | High | Revert to step-5 fix |

---

## 📝 NOTES

- This checklist covers the **3 critical user paths** that are blockers to launch
- Development/test server: `https://api-production-8ac3.up.railway.app`
- If using dev mode: Set `EXPO_PUBLIC_ENABLE_DEV_VERIFY=true` to see verification codes on screen
- Timing targets are conservative; actual performance should be faster
- Email delivery in dev mode falls back to screen display if SendGrid not configured

---

## 🚀 NEXT: SUBMISSION

**Once QA passes all checkboxes:**

```bash
eas build --platform ios --profile production
# Wait for build to complete (ID will be printed)
# Then:
eas submit --platform ios --latest
```

The build will auto-increment build number (38 → 39) due to `autoIncrement: true` in eas.json.

Expected submission time: <5 minutes after build completes.
Expected App Store review time: 3-5 days.
