# QA Testing Checklist - Onboarding Loop Fix

**Release**: v1.0.0 (Commit 01035bd)  
**Date**: December 10, 2025  
**Tester**: **\*\*\*\***\_**\*\*\*\***  
**Signed Off**: \***\*\_\_\_\*\***

---

## Pre-Test Setup

- [ ] Backend health check: `curl https://api-production-8ac3.up.railway.app/health | jq '.ready'`
  - Expected: `true` (or non-blocking if `false`)
- [ ] App deployed and running on test device/simulator
- [ ] Network connectivity verified

---

## Test 1: Admin Account - Skip Onboarding ✅

**Objective**: Admin should land on feed, NOT onboarding  
**Admin Email**: `emilmancero@gmail.com`

| Step | Action                   | Expected                            | Pass | Fail |
| ---- | ------------------------ | ----------------------------------- | ---- | ---- |
| 1    | Sign in with admin email | Authenticating...                   | [ ]  | [ ]  |
| 2    | Wait for `/me` response  | Feed loads (not "Step 1/9")         | [ ]  | [ ]  |
| 3    | Verify tabs visible      | Home, Updates, Settings tabs appear | [ ]  | [ ]  |

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Test 2: New User - Complete Onboarding ✅

**Objective**: New user should see 9-step onboarding flow  
**Test Email**: Create new test account (e.g., `qa-test-<timestamp>@varsityhub.app`)

| Step | Action                 | Expected                             | Pass | Fail |
| ---- | ---------------------- | ------------------------------------ | ---- | ---- |
| 1    | Sign up with new email | Onboarding "Step 1/9" appears        | [ ]  | [ ]  |
| 2    | Complete all 9 steps   | Each step progresses correctly       | [ ]  | [ ]  |
| 3    | Final step → complete  | Redirects to feed                    | [ ]  | [ ]  |
| 4    | Verify feed displayed  | Home, Updates, Settings tabs visible | [ ]  | [ ]  |

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Test 3: Cold Restart - AsyncStorage Caching ✅

**Objective**: App should load feed instantly on restart (no onboarding)  
**User Account**: Use account from Test 2 (newly completed onboarding)

| Step | Action               | Expected                          | Pass | Fail |
| ---- | -------------------- | --------------------------------- | ---- | ---- |
| 1    | Force quit app       | App fully closed                  | [ ]  | [ ]  |
| 2    | Reopen app           | Loading screen briefly, then feed | [ ]  | [ ]  |
| 3    | Verify no onboarding | "Step 1/9" never appears          | [ ]  | [ ]  |
| 4    | Tabs functional      | Home, Updates, Settings clickable | [ ]  | [ ]  |

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Test 4: Account Switch - Logout & New Login ✅

**Objective**: Switching accounts should clear cached flag, show onboarding for new users  
**Test Accounts**: Admin account + new test account

| Step | Action                             | Expected                      | Pass | Fail |
| ---- | ---------------------------------- | ----------------------------- | ---- | ---- |
| 1    | Sign out (tap Settings → Sign Out) | Auth screen appears           | [ ]  | [ ]  |
| 2    | Sign in as admin                   | Feed appears (no onboarding)  | [ ]  | [ ]  |
| 3    | Sign out again                     | Auth screen appears           | [ ]  | [ ]  |
| 4    | Sign in as new user                | "Step 1/9" onboarding appears | [ ]  | [ ]  |

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Test 5: Backend Health Check ✅

**Objective**: Verify `/health` endpoint reports readiness correctly

| Step | Action                   | Expected                          | Pass | Fail |
| ---- | ------------------------ | --------------------------------- | ---- | ---- |
| 1    | Run health check command | Response returns JSON             | [ ]  | [ ]  |
| 2    | Check `ready` field      | `true` or non-critical if `false` | [ ]  | [ ]  |
| 3    | Check integrations       | DB, JWT, auth: `true`             | [ ]  | [ ]  |
| 4    | Check warnings           | SendGrid optional (non-blocking)  | [ ]  | [ ]  |

**Command**:

```bash
curl -s https://api-production-8ac3.up.railway.app/health | jq '.'
```

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Edge Cases (Optional)

- [ ] Network offline → reconnect → app recovers
- [ ] Deep link to feed while unauthenticated → redirects to login
- [ ] Multiple rapid sign-out/sign-in cycles → state remains consistent
- [ ] App backgrounded during onboarding → resume → state preserved

**Notes**: \***\*\*\*\*\***\*\*\***\*\*\*\*\***\_\_\_\***\*\*\*\*\***\*\*\***\*\*\*\*\***

---

## Summary

| Test                           | Status  | Notes            |
| ------------------------------ | ------- | ---------------- |
| Test 1: Admin Skip Onboarding  | ✅ / ❌ | \***\*\_\_\*\*** |
| Test 2: New User Complete Flow | ✅ / ❌ | \***\*\_\_\*\*** |
| Test 3: Cold Restart Caching   | ✅ / ❌ | \***\*\_\_\*\*** |
| Test 4: Account Switch         | ✅ / ❌ | \***\*\_\_\*\*** |
| Test 5: Health Check           | ✅ / ❌ | \***\*\_\_\*\*** |

---

## Sign-Off

**All tests passed**: ✅ / ❌  
**QA Tester**: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***  
**Date**: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***  
**Approval**: \***\*\*\*\*\***\_\_\_\***\*\*\*\*\***

**If ❌ any test fails**: Document issue, create bug ticket, reference this checklist.

---

**Release Notes**: See `RELEASE_NOTES_v1.0.0.md`  
**Technical Details**: See `ONBOARDING_LOOP_FINAL_SOLUTION.md`
