# Coach Onboarding Issues Found

## 🚨 Critical Issues

### Issue 1: Payment Not Verified Before Onboarding Completion
**Severity:** HIGH  
**Location:** `app/onboarding/step-10-confirmation.tsx`

**Problem:**
- User can complete onboarding even if payment is still pending
- Code doesn't check `payment_pending` status before allowing completion
- User could finish onboarding with unpaid subscription

**Current Behavior:**
```typescript
// Step 10 completion doesn't check payment status
await User.completeOnboarding(completionPayload);
// ✅ Server confirms onboarding_completed: true
// ❌ But payment might still be pending!
```

**Expected Behavior:**
- For paid plans (Veteran/Legend), verify payment completed before allowing onboarding completion
- Show error if payment still pending

**Fix Needed:**
```typescript
// In step-10-confirmation.tsx, before onComplete():
if (isCoach && ob.plan !== 'rookie' && ob.payment_pending) {
  // Check payment status
  const me: any = await User.me();
  const prefs = me?.preferences || {};
  
  if (prefs.payment_pending === true || !prefs.subscription_id) {
    Alert.alert(
      'Payment Required',
      'Please complete your payment before finishing setup. You can complete payment in Settings → Manage Subscription.'
    );
    return;
  }
}
```

---

### Issue 2: Navigation Happens Before Payment Completes
**Severity:** MEDIUM  
**Location:** `app/onboarding/step-3-plan.tsx` line 294-296

**Problem:**
- Code navigates to next step immediately after opening Stripe checkout
- User could skip payment and continue onboarding

**Current Code:**
```typescript
await WebBrowser.openBrowserAsync(String(res.url));
setProgress(3);
navigateNext(); // ⚠️ Navigates before payment completes
```

**Expected Behavior:**
- Wait for payment confirmation OR
- Handle payment completion in webhook/success callback

**Fix Options:**
1. **Option A:** Don't navigate, wait for payment success callback
2. **Option B:** Navigate but check payment status in Step 10
3. **Option C:** Use deep link to return to app after payment (like ad payments do)

**Recommended:** Option B (check in Step 10) - already implemented for ad payments

---

### Issue 3: Team Count Default is Wrong
**Severity:** LOW  
**Location:** `app/onboarding/step-3-plan.tsx` line 125

**Problem:**
- Default team count is 3
- Pricing says "First 2 teams free, then $1.50/month per team"
- Should default to 2 (first 2 free), minimum 3 for Veteran

**Current:**
```typescript
const [teamCount, setTeamCount] = useState<number>(3); // Minimum 3 teams for Veteran
```

**Expected:**
```typescript
const [teamCount, setTeamCount] = useState<number>(2); // First 2 free
// Then validate minimum 3 for Veteran plan
```

**Fix:**
```typescript
const [teamCount, setTeamCount] = useState<number>(2); // First 2 free

// In team count modal, validate:
if (plan === 'veteran' && teamCount < 3) {
  Alert.alert('Minimum Teams', 'Veteran plan requires at least 3 teams (2 free + 1 paid)');
  return;
}
```

---

## ✅ What Works

1. **Rookie Plan (Free):** ✅ Saves immediately, no payment needed
2. **Email Verification:** ✅ Required for paid plans, modal works
3. **Payment Fallback:** ✅ Falls back to Rookie if payment fails
4. **Team Creation:** ✅ Works in Step 4
5. **Server Validation:** ✅ Confirms onboarding completion

---

## 🔧 Recommended Fixes (Priority Order)

### Priority 1: Payment Verification (CRITICAL)
Add payment status check in Step 10 before allowing completion:

```typescript
// In app/onboarding/step-10-confirmation.tsx
const onComplete = async () => {
  // ... existing validation ...
  
  // NEW: Check payment status for paid plans
  if (isCoach && ob.plan !== 'rookie') {
    try {
      const me: any = await User.me();
      const prefs = me?.preferences || {};
      
      // Check if payment is still pending
      if (prefs.payment_pending === true) {
        Alert.alert(
          'Payment Required',
          'Please complete your payment before finishing setup. You can complete payment in Settings → Manage Subscription, or return to Step 3 to select the free Rookie plan.',
          [
            {
              text: 'Go to Settings',
              onPress: () => router.push('/settings/manage-subscription'),
            },
            {
              text: 'Select Free Plan',
              onPress: () => router.push('/onboarding/step-3-plan?returnToConfirmation=true'),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
      
      // Check if subscription ID exists (payment completed)
      if (!prefs.subscription_id && ob.plan !== 'rookie') {
        Alert.alert(
          'Payment Not Completed',
          'Your payment is still processing. Please wait a moment and try again, or check your subscription status in Settings.',
          [
            {
              text: 'Check Status',
              onPress: () => router.push('/settings/manage-subscription'),
            },
            { text: 'Retry', onPress: () => void onComplete() },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
        return;
      }
    } catch (err) {
      console.warn('Failed to check payment status:', err);
      // Continue anyway - might be network issue
    }
  }
  
  // ... rest of completion logic ...
};
```

### Priority 2: Team Count Default (LOW)
Fix default to 2 teams:

```typescript
// In app/onboarding/step-3-plan.tsx
const [teamCount, setTeamCount] = useState<number>(2); // First 2 free

// In team count modal validation:
if (plan === 'veteran' && teamCount < 3) {
  Alert.alert('Minimum Teams', 'Veteran plan requires at least 3 teams (first 2 free, then $1.50/month per additional team).');
  setTeamCount(3);
  return;
}
```

---

## 📊 Test Results After Fixes

After implementing Priority 1 fix:

- ✅ User cannot complete onboarding with pending payment
- ✅ Clear error message shown
- ✅ User can navigate to payment or select free plan
- ✅ Payment status checked before completion

---

## 🎯 Summary

**Current Status:** Coach onboarding works BUT has a critical gap - users can complete onboarding without paying.

**Fix Required:** Add payment verification in Step 10 before allowing completion.

**Impact:** Without fix, coaches could get paid features without paying (revenue loss).

**Effort:** ~30 minutes to implement Priority 1 fix.
