# Coach Onboarding Test Guide

**Purpose:** Verify coach onboarding works end-to-end

## 🎯 Critical Test Scenarios

### ✅ TEST 1: Rookie Plan (Free) - Happy Path

**Time:** 5 minutes

**Steps:**

1. Register new account and verify email
2. Select "Coach / Organizer" role
3. Complete Step 2: Basic info (username, DOB, zip)
4. **Step 3: Select Plan**
   - Choose "Rookie" (Free)
   - Click Continue
5. **Expected:**
   - ✅ Plan saved immediately (no payment needed)
   - ✅ Navigates to Step 4 (Team/Organization)
   - ✅ No payment errors

**Potential Issues:**

- Plan not saved to backend
- Navigation fails
- Payment modal appears (shouldn't for Rookie)

---

### ✅ TEST 2: Veteran Plan (Paid) - Full Flow

**Time:** 10 minutes

**Prerequisites:**

- Email verified
- Stripe configured in backend
- Test card: `4242 4242 4242 4242`

**Steps:**

1. Select "Coach / Organizer" role
2. Complete Step 2: Basic info
3. **Step 3: Select Plan**
   - Choose "Veteran"
   - Select team count (minimum 3)
   - Click Continue
4. **Payment Flow:**
   - ✅ Stripe checkout opens in browser
   - Enter test card: `4242 4242 4242 4242`
   - Expiry: `12/25`, CVC: `123`
   - Complete payment
5. **After Payment:**
   - ✅ Navigates to Step 4
   - ✅ Plan saved to backend
   - ✅ Can create teams

**Potential Issues:**

- Stripe checkout doesn't open
- Payment succeeds but plan not saved
- Navigation happens before payment completes
- Team count not saved

---

### ✅ TEST 3: Email Verification Required

**Time:** 3 minutes

**Steps:**

1. Register account but DON'T verify email
2. Select "Coach / Organizer" role
3. Complete Step 2
4. **Step 3: Select Paid Plan**
   - Choose "Veteran" or "Legend"
   - Click Continue
5. **Expected:**
   - ✅ Email verification modal appears
   - ✅ Can enter verification code
   - ✅ Can resend code
   - ✅ After verification, payment flow continues

**Potential Issues:**

- No verification modal (payment fails silently)
- Can't verify email
- Can't continue after verification

---

### ✅ TEST 4: Payment Failure Handling

**Time:** 3 minutes

**Steps:**

1. Select "Coach / Organizer" role
2. Complete Step 2
3. **Step 3: Select Paid Plan**
   - Choose "Veteran"
   - Click Continue
4. **Simulate Payment Failure:**
   - Close Stripe checkout without paying
   - OR: Use declined card: `4000 0000 0000 0002`
5. **Expected:**
   - ✅ Falls back to Rookie plan
   - ✅ Can continue onboarding
   - ✅ No crashes

**Potential Issues:**

- Stuck on payment screen
- Can't continue without payment
- App crashes

---

### ✅ TEST 5: Team/Organization Creation

**Time:** 5 minutes

**Steps:**

1. Complete Steps 1-3 (select Rookie plan)
2. **Step 4: Create Team/Organization**
   - Enter team name
   - Select location
   - Choose sport
   - Click Continue
3. **Expected:**
   - ✅ Team created successfully
   - ✅ Team ID saved to onboarding state
   - ✅ Navigates to Step 6 (Authorized Users)

**Potential Issues:**

- Team not created
- Team ID not saved
- Can't continue to next step

---

### ✅ TEST 6: Onboarding Completion

**Time:** 5 minutes

**Steps:**

1. Complete all steps (1-9)
2. **Step 10: Confirmation**
   - Review all details
   - Click "Complete Setup"
3. **Expected:**
   - ✅ Server confirms `onboarding_completed: true`
   - ✅ Redirects to main app (feed)
   - ✅ Can access coach features
   - ✅ Can create/manage teams

**Potential Issues:**

- Server doesn't confirm completion
- Stuck on confirmation screen
- Redirects to wrong screen
- Can't access coach features after completion

---

## 🚨 Known Issues to Check

### Issue 1: Payment Navigation Timing

**Location:** `app/onboarding/step-3-plan.tsx` line 294-296

**Problem:** Code navigates to next step immediately after opening Stripe checkout, before payment completes.

**Current Code:**

```typescript
await WebBrowser.openBrowserAsync(String(res.url));
setProgress(3);
navigateNext(); // ⚠️ Navigates before payment completes
```

**Risk:** User might skip payment and continue with `payment_pending: true`

**Fix Needed:** Wait for payment confirmation or handle in webhook

---

### Issue 2: Payment Pending State

**Location:** `app/onboarding/step-3-plan.tsx` line 272

**Problem:** Sets `payment_pending: true` but doesn't verify payment completed before allowing onboarding completion.

**Risk:** User can complete onboarding with unpaid subscription

**Fix Needed:** Check payment status before allowing completion

---

### Issue 3: Team Count for Veteran Plan

**Location:** `app/onboarding/step-3-plan.tsx` line 125

**Problem:** Default team count is 3, but pricing shows "$0.99/month per team beyond first 2"

**Current:** `const [teamCount, setTeamCount] = useState<number>(3);`

**Expected:** Should default to 2 (first 2 free), then add paid teams

**Fix Needed:** Default to 2, minimum 3 for Veteran

---

## ✅ Success Criteria

Coach onboarding works if:

- ✅ Rookie plan saves immediately (no payment)
- ✅ Paid plans open Stripe checkout
- ✅ Email verification required for paid plans
- ✅ Payment failures fall back to Rookie
- ✅ Teams can be created
- ✅ Onboarding completion confirmed by server
- ✅ Coach can access features after completion
- ✅ No crashes during any step

---

## 🔧 Quick Fixes Needed

1. **Payment Navigation:** Don't navigate until payment confirmed
2. **Payment Status Check:** Verify payment before allowing completion
3. **Team Count Default:** Fix default to 2 teams (not 3)

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

✅ TEST 1: Rookie Plan - PASS / FAIL
✅ TEST 2: Veteran Plan - PASS / FAIL
✅ TEST 3: Email Verification - PASS / FAIL
✅ TEST 4: Payment Failure - PASS / FAIL
✅ TEST 5: Team Creation - PASS / FAIL
✅ TEST 6: Completion - PASS / FAIL

Issues Found:
-

Ready for Release: YES / NO
```
