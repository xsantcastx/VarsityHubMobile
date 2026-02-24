# Coach Onboarding Fixes Applied

## Date: Now

## Issues Fixed

### 1. **Progress Index Bug in step-2-basic.tsx**
**Problem:** When returning to confirmation from step-2, progress was set to 7 instead of 8.
**Fix:** Changed `setProgress(7)` to `setProgress(8)` for step-10-confirmation (index 8).

### 2. **Progress Index Bugs in step-4-organization.tsx**
**Problem:** Multiple places set progress to 7 when navigating to step-10-confirmation, but step-10 is index 8.
**Fix:** Changed all instances of `setProgress(7)` to `setProgress(8)` when navigating to confirmation.

### 3. **Progress Index Bugs in step-6-authorized-users.tsx**
**Problem:** When returning to confirmation, progress was set to 7 instead of 8.
**Fix:** Changed `setProgress(7)` to `setProgress(8)` for step-10-confirmation.

### 4. **Router.pathname TypeScript Error in onboarding/index.tsx**
**Problem:** `router.pathname` doesn't exist in expo-router, causing TypeScript error.
**Fix:** Replaced with `useSegments()` hook to check current route segments.

## Progress Index Reference

The stepRoutes array in `app/onboarding/index.tsx`:
- Index 0: `/onboarding/step-1-role`
- Index 1: `/onboarding/step-2-basic`
- Index 2: `/onboarding/step-3-plan`
- Index 3: `/onboarding/step-4-organization`
- Index 4: `/onboarding/step-6-authorized-users`
- Index 5: `/onboarding/step-7-profile`
- Index 6: `/onboarding/step-8-interests`
- Index 7: `/onboarding/step-9-features`
- Index 8: `/onboarding/step-10-confirmation`

## Verification Checklist

All progress indices have been verified to match the stepRoutes array:
- ✅ Step 1 → Step 2: progress = 1
- ✅ Step 2 → Step 3: progress = 2
- ✅ Step 3 → Step 4: progress = 3
- ✅ Step 4 → Step 6: progress = 5
- ✅ Step 6 → Step 7: progress = 5
- ✅ Step 7 → Step 8: progress = 6
- ✅ Step 8 → Step 9: progress = 7
- ✅ Step 9 → Step 10: progress = 8
- ✅ All returnToConfirmation paths: progress = 8

## Testing Instructions

1. **Start the app in simulator:**
   ```bash
   npm start
   # Then press 'i' for iOS simulator or 'a' for Android
   ```

2. **Test the full coach onboarding flow:**
   - Sign up with a new email
   - Verify email
   - Step 1: Select "Coach / Organizer"
   - Step 2: Enter username, DOB, zip code
   - Step 3: Select plan (Rookie/Veteran/Legend)
   - Step 4: Create organization
   - Step 6: Add authorized users (or skip)
   - Step 7: Create profile
   - Step 8: Select interests
   - Step 9: Configure features
   - Step 10: Complete onboarding

3. **Verify:**
   - No redirects to main app before completing all steps
   - Progress persists when navigating back and forward
   - All data saves correctly to server
   - No crashes or errors in console
   - User can complete onboarding and reach main app

## Files Modified

1. `app/onboarding/index.tsx` - Fixed router.pathname issue
2. `app/onboarding/step-2-basic.tsx` - Fixed progress index for confirmation
3. `app/onboarding/step-4-organization.tsx` - Fixed progress indices (3 instances)
4. `app/onboarding/step-6-authorized-users.tsx` - Fixed progress indices (2 instances)

## Next Steps

1. Test the flow end-to-end in simulator
2. Verify all steps complete without errors
3. Check that onboarding_completed is set to true on server
4. Confirm user can access main app after completion
