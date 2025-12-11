# Manual QA Test Guide
**December 11, 2025 - Real-Time Log Monitoring**

---

## 📋 SETUP FOR MANUAL TESTING

### Dev Server Status
✅ **Metro is running on port 8081**
- Process: `node /Users/varsityhub/Desktop/CODE/VarsityHubMobile/node_modules/.bin/expo start --ios`
- Ready to load in simulator/Expo Go

### What the Agent Will Do
1. Watch the backend logs for verification codes and errors
2. Capture any Sentry telemetry being sent
3. Document your pass/fail for each flow
4. Collate results into a QA report

### What You Need to Do Manually
1. Open simulator/Expo Go with the running dev server
2. Walk through each test flow as detailed below
3. Report back: ✅ PASS or ❌ FAIL for each step, plus any error messages you see

---

## 🧪 TEST FLOW 1: COACH SIGNUP → VERIFICATION → PLAN SELECTION → ONBOARDING

**Objective:** Verify coach role, plan gating, and 10-step onboarding flow

### Step 1.1: Sign Up
- [ ] Open app, tap "Don't have an account? Sign up"
- [ ] Email: `test-coach-1@varsityhub.app`
- [ ] Name: `Coach Test User`
- [ ] Tap "Create Account"
- **Expected:** Navigate to `/verify-email` screen

### Step 1.2: Email Verification
- [ ] Screen should display verification code (dev mode shows on-screen)
- [ ] Copy code from screen or console log
- [ ] Enter code into input field
- [ ] Tap "Verify Code"
- **Expected:** 
  - ✅ Show "✅ Email verified successfully!"
  - ✅ Auto-navigate to `/onboarding/step-1-role` within 2 seconds
  - **Agent will check logs for:** `[verify/confirm] ✅ Code verified in Xms`

### Step 1.3: Role Selection (Step 1)
- [ ] See two radio buttons: "Coach/Organizer" and "Fan"
- [ ] Select "Coach/Organizer"
- [ ] Tap "Continue"
- **Expected:** Progress to Step 2

### Step 1.4: Plan Selection (NEW - Coach Gating)
- [ ] See three plan cards: **Rookie** | Veteran | Legend
- [ ] **CRITICAL CHECK:** No "6-month trial" copy visible anywhere
- [ ] Select "Rookie" (smallest plan)
- [ ] Tap "Get Started"
- **Expected:** Progress to Step 3, no validation errors
- **Agent will check backend logs for:** Team creation limit enforcement (max 2)

### Step 1.5: Basic Info (Step 3)
- [ ] See form: Organization Name, Coach Name, Phone
- [ ] Fill in test values
- [ ] Tap "Continue"
- **Expected:** Progress to Step 4

### Step 1.6: Organization (Step 4)
- [ ] See organization creation screen
- [ ] Fill in test organization name
- [ ] Tap "Continue"
- **Expected:** Progress to Step 6 (note: Step 5 is skipped)

### Step 1.7: Authorized Users (Step 6)
- [ ] See form to add authorized users
- [ ] **CRITICAL CHECK:** Since Rookie plan = 1 authorized user max, UI should only allow 1
- [ ] Tap "Continue"
- **Expected:** Progress to Step 7

### Step 1.8: Continue Through Remaining Steps (7, 8, 9, 10)
- [ ] Step 7: Social media links (skip or fill)
- [ ] Step 8: Avatar (skip or select)
- [ ] Step 9: **CRITICAL CHECK** - Features confirmation
  - [ ] Should show 4+ checkboxes (team features)
  - [ ] **NO "Invalid payload" error should appear**
  - [ ] Tap all checkboxes or just "Continue"
- [ ] Step 10: "Finish" button
- **Expected:** Navigate to `/` (tabs)/feed` without errors
- **Agent will check backend logs for:** No 400 errors on step-9 payload

### Step 1.9: Feed Screen
- [ ] Should see feed with games/events
- [ ] Should see FIFA games from worldwide (no location filter)
- [ ] ✅ **PASS COACH FLOW**

---

## 🧪 TEST FLOW 2: FAN SIGNUP → VERIFICATION → DIRECT TO FEED

**Objective:** Verify fan role skips onboarding and lands directly on feed

### Step 2.1: Sign Up
- [ ] Tap "Sign up" again or switch account in Expo Go
- [ ] Email: `test-fan-1@varsityhub.app`
- [ ] Name: `Fan Test User`
- [ ] Tap "Create Account"
- **Expected:** Navigate to `/verify-email`

### Step 2.2: Email Verification
- [ ] Enter verification code from screen
- [ ] Tap "Verify Code"
- **Expected:**
  - ✅ "✅ Email verified successfully!"
  - ✅ Auto-navigate **directly to** `/` (tabs)/feed (NO onboarding)
  - **Agent will check logs for:** `[verify/confirm] ✅ Code verified in Xms`

### Step 2.3: Feed Screen
- [ ] Should land directly on feed
- [ ] Should see games/events
- [ ] ✅ **PASS FAN FLOW**

---

## 🧪 TEST FLOW 3: LOGIN → FEED → POST CREATION

**Objective:** Verify authenticated user flow and post creation

### Step 3.1: Sign In
- [ ] Sign out (or reinstall Expo Go)
- [ ] Sign in with existing test user email
- [ ] **Expected:** Direct login to feed (no onboarding loop)

### Step 3.2: Feed Navigation
- [ ] Should see events/games in feed
- [ ] Scroll and verify cards load
- [ ] **Expected:** No crashes, cards display correctly

### Step 3.3: Create Post
- [ ] Tap "+" or compose button
- [ ] Add text: "Test post from QA"
- [ ] If adding media: Verify preview respects portrait/landscape
- [ ] Tap "Post"
- **Expected:** Post appears in feed

### Step 3.4: Organization Page
- [ ] Navigate to an organization
- [ ] Verify new hero/"glass" cards display correctly
- **Expected:** No layout crashes

### Step 3.5: Event Map
- [ ] Open event map view
- [ ] Check for icon fix (if applicable from prior work)
- **Expected:** Map loads, icons display

### Step 3.6: Notifications & Messages
- [ ] Tap Notifications tab
- [ ] Tap Messages tab
- **Expected:** No errors, tabs load smoothly
- ✅ **PASS LOGIN/FEED FLOW**

---

## 🧪 TEST FLOW 4: REGRESSION CHECKS

### Test 4.1: Resend Rate Limiting
- [ ] Open `/verify-email` again (or force re-verification)
- [ ] Tap "Resend Code" button
- [ ] Immediately tap again (within 5 seconds)
- **Expected:** Second tap is disabled OR shows "Please wait..." error
- [ ] Wait 30+ seconds and tap again
- **Expected:** Should succeed and send new code
- **Agent will check logs for:** `[verify/request] Rate limit hit for...`

### Test 4.2: Invalid Code Entry
- [ ] In verification screen, enter wrong code: `000000`
- [ ] Tap "Verify Code"
- **Expected:** 
  - ❌ Show error: "Invalid verification code"
  - ❌ Toast/alert appears
  - ❌ Sentry logs the error
  - Dev code still visible on screen (if dev mode)
- **Agent will check logs for:** `[verify/confirm] Invalid code attempt`

### Test 4.3: Coach Plan Enforcement (Rookie → 2 Teams Max)
- [ ] Sign in as the coach user created in Flow 1
- [ ] Try to create 3 teams
- **Expected:**
  - ✅ Teams 1 & 2 create successfully
  - ❌ Team 3 creation fails with error: "You've reached the team limit for your plan. Upgrade to Veteran plan."
  - ✅ Error message is clear and actionable

### Test 4.4: No Onboarding Loop for Completed Users
- [ ] Sign in as coach user from Flow 1 (who completed onboarding)
- **Expected:** Direct to feed, NOT sent back to `/onboarding/step-1-role`
- ✅ **PASS REGRESSION CHECKS**

---

## 📊 LOG MONITORING CHECKLIST

**As you test, the agent will watch for:**

### Verification Logs
```
[verify/request] ✅ Email sent to test-coach-1@varsityhub.app in 245ms
[verify/confirm] ✅ Code verified in 45ms
```

### Rate Limit Logs
```
[verify/request] Rate limit hit for test-coach-1@varsityhub.app (30s cooldown)
```

### Error Logs (if failures occur)
```
[verify/confirm] Invalid code attempt
[teams] Rookie plan: team limit exceeded (max 2)
```

### Sentry Events (if telemetry fires)
```
context: verify-email-success, tags: duration_ms: 245
context: verify-email-refresh, error detected
```

---

## 📝 RESULTS TEMPLATE

**Once you've completed all flows, provide:**

```
FLOW 1 (Coach): [✅ PASS / ❌ FAIL]
  - 1.1 Sign Up: [✅ PASS / ❌ FAIL]
  - 1.2 Verification: [✅ PASS / ❌ FAIL]
  - 1.3 Role Selection: [✅ PASS / ❌ FAIL]
  - 1.4 Plan Selection: [✅ PASS / ❌ FAIL] | Notes: ___
  - 1.5-1.8 Onboarding: [✅ PASS / ❌ FAIL] | Notes: ___
  - 1.9 Feed: [✅ PASS / ❌ FAIL]

FLOW 2 (Fan): [✅ PASS / ❌ FAIL]
  - 2.1 Sign Up: [✅ PASS / ❌ FAIL]
  - 2.2 Verification + Direct Feed: [✅ PASS / ❌ FAIL]
  - 2.3 Feed: [✅ PASS / ❌ FAIL]

FLOW 3 (Login/Feed): [✅ PASS / ❌ FAIL]
  - 3.1 Sign In: [✅ PASS / ❌ FAIL]
  - 3.2-3.6 Navigation: [✅ PASS / ❌ FAIL]

FLOW 4 (Regression): [✅ PASS / ❌ FAIL]
  - 4.1 Rate Limiting: [✅ PASS / ❌ FAIL]
  - 4.2 Invalid Code: [✅ PASS / ❌ FAIL]
  - 4.3 Coach Plan Gating: [✅ PASS / ❌ FAIL]
  - 4.4 No Onboarding Loop: [✅ PASS / ❌ FAIL]

ERRORS ENCOUNTERED:
- [List any error messages, stack traces, or unexpected behaviors]

NOTES:
- [Any additional observations]
```

---

## ⏭️ NEXT STEPS AFTER QA

**If all flows PASS:**
```bash
eas build --platform ios --profile production
# (wait ~15-20 min for build)
eas submit --platform ios --latest
# (submit to App Store, 3-5 days for review)
```

**If any flows FAIL:**
- Report findings to agent
- Agent will identify fix needed
- Deploy OTA update or prepare new build
- Retest affected flow
- Then proceed to build/submit

---

## 🚀 You're Ready!

Dev server is live. Walk through the flows above and report results. Agent will monitor backend logs and collate findings into final QA report.
