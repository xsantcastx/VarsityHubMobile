# Coach Onboarding Steps Skip Fix
**Date:** Fixed  
**Status:** ✅ Complete

## 🐛 Root Causes Found

### Issue 1: Auto-Skip Logic in Step 4
**Problem:** Step 4 was automatically skipping to Step 6 if a team/org already existed, bypassing the step entirely.

**Location:** `app/onboarding/step-4-organization.tsx` lines 88-96, 113-121

**Fix:** Removed auto-skip for non-E2E tests. Users now always see Step 4, even if team/org exists.

---

### Issue 2: Wrong Progress Index in Step 4
**Problem:** When team/org exists, Step 4 was setting progress to 5 (Step 7) instead of 4 (Step 6).

**Location:** `app/onboarding/step-4-organization.tsx` line 377

**Fix:** Changed `setProgress(5)` to `setProgress(4)` to correctly go to Step 6.

---

### Issue 3: Saved Progress Resuming
**Problem:** `index.tsx` was resuming from saved AsyncStorage progress, which could jump coaches to Step 7 if they previously got there.

**Location:** `app/onboarding/index.tsx`

**Fix:** Added validation to ensure coaches have completed required steps (username, plan, team/org) before allowing resume at Step 7+.

---

### Issue 4: Wrong Progress Index in Step 7
**Problem:** Step 7 was setting progress to 5 (Step 7) instead of 6 (Step 8) when navigating to Step 8.

**Location:** `app/onboarding/step-7-profile.tsx` line 114

**Fix:** Changed `setProgress(5)` to `setProgress(6)`.

---

### Issue 5: No Progress Reset for Coaches
**Problem:** When coach selects role, old saved progress wasn't cleared, causing jumps.

**Location:** `app/onboarding/step-1-role.tsx`

**Fix:** Added logic to reset progress and clear onboarding state for fresh coach onboarding.

---

## ✅ Fixes Applied

### Fix 1: Removed Auto-Skip in Step 4
```typescript
// BEFORE: Auto-skipped if team exists
if (!e2e) {
  setProgress(5);
  router.replace('/onboarding/step-6-authorized-users');
  return;
}

// AFTER: Only skip in E2E tests, always show step to users
if (e2e) {
  setProgress(4);
  router.replace('/onboarding/step-6-authorized-users');
  return;
}
```

### Fix 2: Fixed Progress Indices
- Step 4 → Step 6: `setProgress(4)` (was 5)
- Step 7 → Step 8: `setProgress(6)` (was 5)

### Fix 3: Added Progress Validation
```typescript
// In index.tsx - Validate coach has completed required steps
if (state?.role === 'coach') {
  if (progress >= 5 && (!state.username || !state.plan || !state.team_id && !state.organization_id)) {
    targetProgress = 1; // Force back to step 2
  }
}
```

### Fix 4: Reset Progress for Fresh Coach Onboarding
```typescript
// In step-1-role.tsx - Clear state for coaches
if (role === 'coach') {
  setProgress(1); // Force start at step 2
  setOB({ role }); // Clear old state
}
```

---

## 🧪 Verification

### Expected Coach Flow (After Fix):

```
Step 1/10: Choose Role (Coach)
  ↓ setProgress(1)
Step 2/10: Basic Info ✅ (ALWAYS shown)
  ↓ setProgress(2)
Step 3/10: Plan Selection ✅ (ALWAYS shown)
  ↓ setProgress(3)
Step 4/10: Organization/Team ✅ (ALWAYS shown, even if team exists)
  ↓ setProgress(4)
Step 6/10: Authorized Users ✅ (ALWAYS shown)
  ↓ setProgress(5)
Step 7/10: Profile ✅ (ALWAYS shown)
  ↓ setProgress(6)
Step 8/10: Interests ✅ (ALWAYS shown)
  ↓ setProgress(7)
Step 9/10: Features ✅ (ALWAYS shown)
  ↓ setProgress(8)
Step 10/10: Confirmation ✅
```

---

## 📝 Files Modified

1. **`app/onboarding/step-1-role.tsx`**
   - Added progress reset for coaches
   - Clear onboarding state for fresh start
   - Use `router.replace` instead of `push` for coaches

2. **`app/onboarding/step-4-organization.tsx`**
   - Removed auto-skip logic (only skip in E2E tests)
   - Fixed progress index: `setProgress(4)` instead of `setProgress(5)`

3. **`app/onboarding/step-7-profile.tsx`**
   - Fixed progress index: `setProgress(6)` instead of `setProgress(5)`

4. **`app/onboarding/index.tsx`**
   - Added validation to prevent resuming at Step 7+ if required steps not completed
   - Check if coach has username, plan, and team/org before allowing resume

---

## ✅ Result

**Before:**
- ❌ Step 4 auto-skipped if team exists
- ❌ Saved progress could jump to Step 7
- ❌ Coaches could bypass Steps 2-6

**After:**
- ✅ Step 4 always shown (unless E2E test)
- ✅ Progress validated before resume
- ✅ Coaches must go through ALL steps 2-6
- ✅ Progress indices corrected

---

**Status:** ✅ Fixed - Coaches now go through all required steps
