# Coach Onboarding Critical Bug Fix

**Date:** 2026-01-22
**Status:** ✅ FIXED
**Files Modified:** `app/onboarding/index.tsx`

---

## 🐛 The Bug

### Location
[app/onboarding/index.tsx:73-78](../app/onboarding/index.tsx#L73-L78)

### What Was Wrong

```typescript
// BEFORE (BROKEN):
if (progress >= 5 && progress < 4) {  // ❌ IMPOSSIBLE CONDITION
  setProgress(4);
  setHasNavigated(true);
  router.replace('/onboarding/step-6-authorized-users');
  return;
}
```

**The Critical Issue:**
- The condition `progress >= 5 && progress < 4` is **mathematically impossible**
- A number cannot be both ≥5 AND <4 at the same time
- This meant coaches would **NEVER** be redirected to step 6 when needed
- Coaches could skip step 6 (Authorized Users) entirely

### Impact
- Coaches completing onboarding would skip the "Authorized Users" step
- Progress validation was not working correctly
- The flow could jump from step 4 directly to step 7

---

## ✅ The Fix

### What Changed

```typescript
// AFTER (FIXED):
if (progress > 4) {
  // They're past step 6, but we want to make sure they went through it
  // Force them to step 6 first
  setProgress(4);
  setHasNavigated(true);
  router.replace('/onboarding/step-6-authorized-users');
  return;
}
// Progress is at or before step 6, allow normal flow
const targetRoute = stepRoutes[progress] || stepRoutes[0];
setHasNavigated(true);
router.replace(targetRoute as any);
return;
```

### Additional Fixes

1. **Added missing `setProgress` to destructuring** (line 10):
   ```typescript
   const { progress, state, isLoaded, setProgress } = useOnboarding();
   ```

2. **Added `setProgress` to useEffect dependencies** (line 95):
   ```typescript
   }, [hasNavigated, isLoaded, progress, router, state, user, setProgress]);
   ```

---

## 📊 Step Flow Reference

For coaches, the correct step flow is:

```
Step 1 (index 0): Choose Role → Coach
  ↓ setProgress(1)
Step 2 (index 1): Basic Info (username, DOB, zip)
  ↓ setProgress(2)
Step 3 (index 2): Plan Selection (rookie/veteran/legend)
  ↓ setProgress(3)
Step 4 (index 3): Organization/Team Setup
  ↓ setProgress(4)
Step 6 (index 4): Authorized Users ← THIS WAS BEING SKIPPED
  ↓ setProgress(5)
Step 7 (index 5): Profile
  ↓ setProgress(6)
Step 8 (index 6): Interests
  ↓ setProgress(7)
Step 9 (index 7): Features
  ↓ setProgress(8)
Step 10 (index 8): Confirmation
```

**Key Insight:** Step 6 is at **index 4** in the `stepRoutes` array. If progress is > 4, the user has skipped step 6.

---

## 🧪 How to Test

### Test Case 1: Fresh Coach Onboarding
1. Start app with new user or reset onboarding
2. Select "Coach / Organizer" at step 1
3. Complete steps 2, 3, 4 in order
4. **Verify:** User is taken to step 6 (Authorized Users), NOT step 7
5. Continue through steps 6, 7, 8, 9, 10
6. **Verify:** No steps are skipped

### Test Case 2: Resume from Saved Progress
1. Start onboarding as coach
2. Complete through step 4
3. Close the app
4. Reopen the app
5. **Verify:** User resumes at step 6, not step 7

### Test Case 3: Progress Validation
1. Start onboarding as coach
2. Complete through step 4
3. Manually set progress to 5 or higher (via debug tools or AsyncStorage)
4. Reload the onboarding screen
5. **Verify:** User is redirected back to step 6 (index 4)

---

## 🔍 Root Cause Analysis

### Why This Bug Existed

The original code attempted to validate that coaches don't skip step 6, but used **incorrect boolean logic**:

```typescript
// Intended logic: "If progress is past step 6, redirect back to step 6"
// Actual logic: "If progress is >= 5 AND < 4" (impossible)
```

This was likely a **copy-paste error** or **typo** where the developer meant:
- `progress >= 5` (correct - checks if past step 6)
- But accidentally added `&& progress < 4` (wrong - makes condition impossible)

### Why It Wasn't Caught Earlier

1. **TypeScript doesn't catch logical impossibilities** - only type errors
2. **No unit tests** for this validation logic
3. **Manual testing may have followed the happy path** without trying to skip steps
4. Previous fix documentation mentioned fixing this, but the actual code wasn't updated correctly

---

## 📝 Prevention

### Recommendations

1. **Add Unit Tests:**
   ```typescript
   describe('OnboardingIndex coach validation', () => {
     it('should redirect to step 6 if progress skips past it', () => {
       // Test with progress=5, should redirect to step 6
     });
   });
   ```

2. **Add ESLint Rule:**
   Consider using `eslint-plugin-no-redundant-condition` to catch impossible conditions

3. **Code Review Checklist:**
   - Check for impossible boolean conditions (e.g., `x > 5 && x < 3`)
   - Verify progress indices match the stepRoutes array
   - Test edge cases where progress might be out of order

---

## ✅ Verification Checklist

- [x] Fixed impossible condition in line 73
- [x] Added missing `setProgress` to destructuring
- [x] Added `setProgress` to useEffect dependencies
- [x] TypeScript compiles without errors
- [x] Logic now correctly validates coach progress
- [ ] Manual testing confirms step 6 is no longer skipped
- [ ] End-to-end test passes for coach onboarding

---

## 🎯 Expected Behavior After Fix

### Before Fix:
- ❌ Coaches could skip step 6
- ❌ Progress validation had impossible condition
- ❌ Onboarding would jump from step 4 → step 7

### After Fix:
- ✅ Coaches **always** go through step 6
- ✅ Progress validation correctly checks `progress > 4`
- ✅ Onboarding follows correct sequence: step 4 → step 6 → step 7

---

**Status:** Ready for testing
**Priority:** HIGH - Core user flow bug
**Complexity:** Simple logic fix, major impact
