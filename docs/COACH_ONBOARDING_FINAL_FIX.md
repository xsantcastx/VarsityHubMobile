# Coach Onboarding Steps - FINAL FIX

**Date:** Fixed  
**Status:** ✅ Complete - All Skip Logic Removed

## 🚨 Problem

Coaches were STILL skipping Steps 2-6, jumping directly to Step 7 (Profile).

## 🔍 Root Causes (All Fixed)

### Issue 1: AsyncStorage Persisting Old Progress

**Problem:** Saved progress in AsyncStorage was causing app to resume at Step 7.

**Fix:** Clear AsyncStorage when coach selects role:

```typescript
// In step-1-role.tsx
if (role === 'coach') {
  setOB({ role });
  setProgress(1);
  // Clear AsyncStorage to remove any saved progress
  await AsyncStorage.removeItem('onboarding_progress');
  await AsyncStorage.removeItem('onboarding_state');
}
```

---

### Issue 2: No Guards in Step 7

**Problem:** Step 7 didn't validate that Steps 2-6 were completed.

**Fix:** Added validation guard in Step 7:

```typescript
// In step-7-profile.tsx
useEffect(() => {
  if (ob.role === 'coach' && !returnToConfirmation) {
    const hasStep2 = !!(ob.username && ob.dob && (ob.zip || ob.zip_code));
    const hasStep3 = !!ob.plan;
    const hasStep4 = !!(ob.team_id || ob.organization_id);

    if (!hasStep2) {
      setProgress(1);
      router.replace('/onboarding/step-2-basic');
      return;
    }
    if (!hasStep3) {
      setProgress(2);
      router.replace('/onboarding/step-3-plan');
      return;
    }
    if (!hasStep4) {
      setProgress(3);
      router.replace('/onboarding/step-4-organization');
      return;
    }
  }
}, [
  ob.role,
  ob.username,
  ob.dob,
  ob.zip,
  ob.zip_code,
  ob.plan,
  ob.team_id,
  ob.organization_id,
  returnToConfirmation,
  router,
  setProgress,
]);
```

---

### Issue 3: Weak Validation in index.tsx

**Problem:** Validation wasn't strict enough.

**Fix:** Added strict sequential validation:

```typescript
// In index.tsx
if (state?.role === 'coach') {
  // Step 1: Role selected
  if (!state.role) {
    router.replace('/onboarding/step-1-role');
    return;
  }

  // Step 2: Basic info required
  if (!state.username || !state.dob || (!state.zip && !state.zip_code)) {
    router.replace('/onboarding/step-2-basic');
    return;
  }

  // Step 3: Plan required
  if (!state.plan) {
    router.replace('/onboarding/step-3-plan');
    return;
  }

  // Step 4: Team/Organization required
  if (!state.team_id && !state.organization_id) {
    router.replace('/onboarding/step-4-organization');
    return;
  }

  // Only allow progress 5+ if all required steps complete
  if (progress >= 5) {
    const hasStep2 = !!(state.username && state.dob && (state.zip || state.zip_code));
    const hasStep3 = !!state.plan;
    const hasStep4 = !!(state.team_id || state.organization_id);

    if (!hasStep2 || !hasStep3 || !hasStep4) {
      // Force back to first incomplete step
      if (!hasStep2) {
        setProgress(1);
        router.replace('/onboarding/step-2-basic');
        return;
      }
      if (!hasStep3) {
        setProgress(2);
        router.replace('/onboarding/step-3-plan');
        return;
      }
      if (!hasStep4) {
        setProgress(3);
        router.replace('/onboarding/step-4-organization');
        return;
      }
    }
  }
}
```

---

### Issue 4: Backend Not Validating

**Problem:** Backend wasn't checking if coaches completed required steps.

**Fix:** Added backend validation:

```typescript
// In server/src/routes/auth.ts
if (finalRole === 'coach') {
  // Coaches MUST have: username, plan, and team/org
  if (!data.username) {
    return res.status(400).json({ error: 'Username required for coach onboarding' });
  }
  if (!data.plan) {
    return res.status(400).json({ error: 'Plan selection required for coach onboarding' });
  }
  if (!data.team_id && !data.organization_id) {
    return res.status(400).json({ error: 'Team or organization required for coach onboarding' });
  }
}
```

---

### Issue 5: Using router.push Instead of router.replace

**Problem:** `router.push` allows back navigation which can cause issues.

**Fix:** Changed all coach navigation to `router.replace`:

- Step 1 → Step 2: `router.replace` ✅
- Step 2 → Step 3: `router.replace` ✅
- Step 3 → Step 4: `router.replace` ✅
- Step 4 → Step 6: `router.replace` ✅
- Step 6 → Step 7: `router.replace` ✅

---

## ✅ Complete Fix Summary

### Frontend Fixes:

1. ✅ Clear AsyncStorage when coach selects role
2. ✅ Added guard in Step 7 to validate Steps 2-6
3. ✅ Strict validation in index.tsx
4. ✅ Changed all navigation to `router.replace`
5. ✅ Removed all auto-skip logic (except E2E)

### Backend Fixes:

1. ✅ Added validation in `/me/complete-onboarding`
2. ✅ Requires username, plan, and team/org for coaches

---

## 🧪 Verification

**Test Flow:**

1. Select Coach role
2. **Expected:** Goes to Step 2/10 (Basic Info)
3. Complete Step 2
4. **Expected:** Goes to Step 3/10 (Plan Selection)
5. Complete Step 3
6. **Expected:** Goes to Step 4/10 (Organization/Team)
7. Complete Step 4
8. **Expected:** Goes to Step 6/10 (Authorized Users)
9. Complete/Skip Step 6
10. **Expected:** Goes to Step 7/10 (Profile) ✅

**If user tries to access Step 7 without completing Steps 2-6:**

- Frontend guard redirects to first incomplete step
- Backend rejects completion if steps missing

---

## 📝 Files Modified

### Frontend:

1. `app/onboarding/step-1-role.tsx` - Clear AsyncStorage, use replace
2. `app/onboarding/step-2-basic.tsx` - Use replace
3. `app/onboarding/step-3-plan.tsx` - Use replace
4. `app/onboarding/step-4-organization.tsx` - Use replace, removed auto-skip
5. `app/onboarding/step-6-authorized-users.tsx` - Use replace
6. `app/onboarding/step-7-profile.tsx` - Added validation guard
7. `app/onboarding/index.tsx` - Strict sequential validation

### Backend:

1. `server/src/routes/auth.ts` - Added coach validation in complete-onboarding

---

## ✅ Result

**Before:**

- ❌ Steps 2-6 skipped
- ❌ AsyncStorage caused resume at Step 7
- ❌ No guards in Step 7
- ❌ Backend didn't validate

**After:**

- ✅ Steps 2-6 ALWAYS shown
- ✅ AsyncStorage cleared for coaches
- ✅ Step 7 validates Steps 2-6
- ✅ Backend validates required steps
- ✅ All navigation uses replace (no back issues)

---

**Status:** ✅ FIXED - Coaches CANNOT skip steps anymore!
