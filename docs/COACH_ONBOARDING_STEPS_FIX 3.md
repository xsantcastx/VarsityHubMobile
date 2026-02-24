# Coach Onboarding Steps Fix
**Date:** Fixed  
**Status:** ✅ Complete

## 🐛 Issues Found

### Issue 1: Wrong Step Numbers Displayed
**Problem:** Steps 6-10 were showing incorrect step numbers in the header.

**Before:**
- Step 6 (Authorized Users): Showed "Step 5/9" ❌
- Step 7 (Profile): Showed "Step 6/9" ❌
- Step 8 (Interests): Showed "Step 7/9" ❌
- Step 9 (Features): Showed "Step 8/9" ❌
- Step 10 (Confirmation): Showed "Step 9/9" ❌

**After:**
- Step 6 (Authorized Users): Shows "Step 6/10" ✅
- Step 7 (Profile): Shows "Step 7/10" ✅
- Step 8 (Interests): Shows "Step 8/10" ✅
- Step 9 (Features): Shows "Step 9/10" ✅
- Step 10 (Confirmation): Shows "Step 10/10" ✅

### Issue 2: Wrong Total Steps
**Problem:** OnboardingLayout defaulted to 9 steps instead of 10.

**Fixed:** Changed `totalSteps = 9` to `totalSteps = 10`

### Issue 3: Progress Index Wrong
**Problem:** Step 4 was setting progress to 5 instead of 4 when navigating to Step 6.

**Fixed:** Changed `setProgress(5)` to `setProgress(4)` in step-4-organization.tsx

---

## ✅ Coach Onboarding Flow (Corrected)

**Step 1:** Choose Role (Fan or Coach)
- ✅ Shows "Step 1/10"

**Step 2:** Basic Info (username, DOB, zip, affiliation)
- ✅ Shows "Step 2/10"
- ✅ Navigates to Step 3 for coaches

**Step 3:** Plan Selection (Rookie/Veteran/Legend)
- ✅ Shows "Step 3/10"
- ✅ Navigates to Step 4

**Step 4:** Organization/Team Setup
- ✅ Shows "Step 4/10"
- ✅ Navigates to Step 6 (Step 5 doesn't exist)

**Step 6:** Authorized Users (optional)
- ✅ Shows "Step 6/10" (was showing 5/9)
- ✅ Navigates to Step 7

**Step 7:** Profile (avatar, username, bio, interests)
- ✅ Shows "Step 7/10" (was showing 6/9)
- ✅ Navigates to Step 8

**Step 8:** Interests/Goals
- ✅ Shows "Step 8/10" (was showing 7/9)
- ✅ Navigates to Step 9

**Step 9:** Features/Permissions
- ✅ Shows "Step 9/10" (was showing 8/9)
- ✅ Navigates to Step 10

**Step 10:** Confirmation
- ✅ Shows "Step 10/10" (was showing 9/9)
- ✅ Completes onboarding

---

## 📝 Changes Made

### Files Modified:

1. **`app/onboarding/step-6-authorized-users.tsx`**
   - Changed `step={5}` → `step={6}`

2. **`app/onboarding/step-7-profile.tsx`**
   - Changed `step={6}` → `step={7}`

3. **`app/onboarding/step-8-interests.tsx`**
   - Changed `step={7}` → `step={8}`

4. **`app/onboarding/step-9-features.tsx`**
   - Changed `step={8}` → `step={9}`

5. **`app/onboarding/step-10-confirmation.tsx`**
   - Changed `step={9}` → `step={10}`

6. **`app/onboarding/components/OnboardingLayout.tsx`**
   - Changed `totalSteps = 9` → `totalSteps = 10`

7. **`app/onboarding/step-4-organization.tsx`**
   - Changed `setProgress(5)` → `setProgress(4)` when navigating to Step 6

---

## ✅ Verification

**Step Numbers:** All steps now show correct numbers (1-10)  
**Progress Tracking:** Progress indices match stepRoutes array  
**Navigation:** Coaches go through all required steps  
**Display:** "Step X/10" shows correctly for all steps

---

## 🎯 Result

Coaches now see:
- ✅ Correct step numbers (1-10)
- ✅ Correct progress bar
- ✅ All steps are accessible
- ✅ No steps are skipped

**Status:** ✅ Ready for testing
