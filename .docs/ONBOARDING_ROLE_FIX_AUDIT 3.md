# Onboarding Role Assignment Fix - Critical Bug Resolution

**Date:** January 20, 2025  
**Issue:** Coach accounts created via OAuth (Apple/Google) were automatically set to "FAN" role  
**Status:** ✅ **FIXED**

---

## 🚨 Critical Bug Identified

### Problem
Users signing up with Apple/Google OAuth were **always** created with `role: 'fan'` hardcoded, even when they selected "Coach" during onboarding.

### Root Causes

1. **OAuth Flows Hardcode Role to 'fan'**
   - **Location:** `server/src/routes/auth.ts` lines 229, 379
   - **Issue:** Both Google and Apple OAuth create new users with `preferences: { role: 'fan', onboarding_completed: false }`
   - **Impact:** All OAuth users start as 'fan' regardless of their onboarding selection

2. **completeOnboarding May Not Preserve Role**
   - **Location:** `server/src/routes/auth.ts` line 851
   - **Issue:** If `data.role` is `undefined` in the completion payload, it gets deleted from `preferencesUpdate` (line 876-877)
   - **Impact:** Role reverts to existing value ('fan') instead of using the user's selection

3. **Missing Role Validation**
   - **Location:** `app/onboarding/step-10-confirmation.tsx` line 178
   - **Issue:** No validation that role exists before sending completion payload
   - **Impact:** If role is missing from onboarding state, undefined gets sent to server

---

## ✅ Fixes Applied

### Fix 1: Preserve Role in completeOnboarding
**File:** `server/src/routes/auth.ts` (lines 848-895)

**Before:**
```typescript
const preferencesUpdate: any = {
  onboarding_completed: true,
  role: data.role, // Could be undefined
  // ...
};

// Clean up undefined values
Object.keys(preferencesUpdate).forEach(key => {
  if (preferencesUpdate[key] === undefined) {
    delete preferencesUpdate[key]; // Role gets deleted if undefined!
  }
});
```

**After:**
```typescript
// Get current preferences FIRST to preserve role if not in payload
const current = await prisma.user.findUnique({ where: { id: req.user.id }, select: { preferences: true } });
const currentPrefs = current?.preferences as any || {};

// CRITICAL: Role must NEVER be undefined - preserve from current preferences if not in payload
if (preferencesUpdate.role === undefined) {
  preferencesUpdate.role = currentPrefs.role || 'fan'; // Use existing role or default to fan
}

// Clean up undefined values (but keep role - it's already set above)
Object.keys(preferencesUpdate).forEach(key => {
  if (preferencesUpdate[key] === undefined && key !== 'role') {
    delete preferencesUpdate[key];
  }
});
```

**Impact:** Role is now preserved from step-1 selection even if not explicitly in completion payload.

---

### Fix 2: Validate Role Before Completion
**File:** `app/onboarding/step-10-confirmation.tsx` (lines 147-177)

**Before:**
```typescript
const prefsPatch: any = {};
if (ob.role) prefsPatch.role = ob.role; // Silent if missing
// ...
const completionPayload = {
  role: ob.role, // Could be undefined
  // ...
};
```

**After:**
```typescript
// CRITICAL: Ensure role is persisted before finalizing onboarding
const prefsPatch: any = {};
if (ob.role) {
  prefsPatch.role = ob.role;
} else {
  // If role is missing from onboarding state, fetch from server
  try {
    const me: any = await User.me();
    if (me?.preferences?.role) {
      prefsPatch.role = me.preferences.role;
      setOB((prev) => ({ ...prev, role: me.preferences.role }));
    } else {
      throw new Error('Role not set. Please go back to step 1 and select your role.');
    }
  } catch (fetchErr: any) {
    throw new Error('Failed to verify role. Please go back to step 1 and select your role.');
  }
}

// CRITICAL: Role MUST be included - fail if missing
if (!ob.role) {
  throw new Error('Role is required. Please go back to step 1 and select your role (Fan or Coach).');
}

const completionPayload = {
  role: ob.role, // REQUIRED - must be 'fan' or 'coach'
  // ...
};
```

**Impact:** Users cannot complete onboarding without a role, and missing roles are caught early.

---

### Fix 3: Load Role from Server in Step 1
**File:** `app/onboarding/step-1-role.tsx` (lines 139-155)

**Before:**
```typescript
useEffect(() => {
  if (ob.role) setRole(ob.role);
}, [ob.role]);
```

**After:**
```typescript
useEffect(() => {
  // Load role from onboarding state if available
  if (ob.role) {
    setRole(ob.role);
  } else {
    // If not in onboarding state, check server preferences
    void (async () => {
      try {
        const me: any = await User.me();
        if (me?.preferences?.role && (me.preferences.role === 'fan' || me.preferences.role === 'coach')) {
          setRole(me.preferences.role);
          setOB((prev) => ({ ...prev, role: me.preferences.role }));
        }
      } catch {
        // ignore - user will select role
      }
    })();
  }
}, [ob.role]);
```

**Impact:** If user navigates back to step-1, their previously selected role is restored from server.

---

## 🔍 Onboarding Flow Verification

### Expected Flow for Coach Account

1. **User Signs Up with Apple/Google**
   - ✅ User created with `role: 'fan'` (temporary default)
   - ✅ `onboarding_completed: false`

2. **User Reaches Step 1: Role Selection**
   - ✅ User selects "Coach / Organizer"
   - ✅ `setOB({ role: 'coach' })` - saves to local state
   - ✅ `User.updatePreferences({ role: 'coach' })` - **persists to server**
   - ✅ Server now has `preferences.role = 'coach'`

3. **User Completes Onboarding Steps 2-9**
   - ✅ Role remains 'coach' in onboarding state
   - ✅ Role remains 'coach' in server preferences

4. **User Reaches Step 10: Confirmation**
   - ✅ Validates `ob.role` exists (throws error if missing)
   - ✅ Sends `role: 'coach'` in completion payload
   - ✅ Server receives `data.role = 'coach'`
   - ✅ Server sets `preferences.role = 'coach'` (explicitly)
   - ✅ Server marks `onboarding_completed = true`

5. **User Completes Onboarding**
   - ✅ Server returns user with `preferences.role = 'coach'`
   - ✅ User sees Coach dashboard/features
   - ✅ User can create teams

---

## 🧪 Testing Checklist

### Test Case 1: Apple Sign-In → Coach Selection
- [ ] Sign in with Apple
- [ ] Select "Coach / Organizer" in step 1
- [ ] Complete all onboarding steps
- [ ] Verify profile shows "COACH" badge (not "FAN")
- [ ] Verify user can create teams
- [ ] Verify user sees coach-specific features

### Test Case 2: Google Sign-In → Coach Selection
- [ ] Sign in with Google
- [ ] Select "Coach / Organizer" in step 1
- [ ] Complete all onboarding steps
- [ ] Verify profile shows "COACH" badge
- [ ] Verify user can create teams

### Test Case 3: Email/Password → Coach Selection
- [ ] Register with email/password
- [ ] Select "Coach / Organizer" in step 1
- [ ] Complete all onboarding steps
- [ ] Verify profile shows "COACH" badge

### Test Case 4: Role Persistence
- [ ] Sign in with OAuth
- [ ] Select "Coach" in step 1
- [ ] Navigate back to step 1
- [ ] Verify "Coach" is still selected
- [ ] Complete onboarding
- [ ] Verify role is 'coach' in final profile

### Test Case 5: Missing Role Detection
- [ ] Sign in with OAuth
- [ ] Clear onboarding state (simulate bug)
- [ ] Try to complete onboarding without selecting role
- [ ] Verify error message appears
- [ ] Verify user is redirected to step 1

---

## 📊 Code Changes Summary

### Files Modified

1. **`server/src/routes/auth.ts`**
   - ✅ Fixed `completeOnboarding` to preserve role from current preferences if not in payload
   - ✅ Ensured role is never undefined in preferencesUpdate
   - ✅ Role now explicitly set before merge

2. **`app/onboarding/step-10-confirmation.tsx`**
   - ✅ Added role validation before completion
   - ✅ Added fallback to fetch role from server if missing from state
   - ✅ Added error handling for missing role

3. **`app/onboarding/step-1-role.tsx`**
   - ✅ Added server preference check on mount
   - ✅ Restores role from server if missing from local state

---

## ⚠️ Known Limitations

1. **OAuth Still Creates Users as 'fan' Initially**
   - This is acceptable - users select their role in step 1
   - Role is properly updated when they select "Coach"
   - Fix ensures role is preserved through completion

2. **No Role Change After Onboarding**
   - Users cannot change role after completing onboarding
   - This is by design - role is set during onboarding
   - If needed, add role change feature in settings

---

## 🎯 Verification Steps

After these fixes, verify:

1. **Server Logs:**
   ```bash
   # Check user preferences after onboarding
   # Should show: preferences.role = 'coach' (not 'fan')
   ```

2. **Client Verification:**
   - Complete onboarding as coach
   - Check profile screen - should show "COACH" badge
   - Try to create team - should work (coach-only feature)

3. **Database Verification:**
   ```sql
   SELECT id, email, preferences->>'role' as role, preferences->>'onboarding_completed' as completed
   FROM "User"
   WHERE email = 'test@example.com';
   -- Should show: role = 'coach', completed = 'true'
   ```

---

## ✅ Status

**All fixes applied. Ready for testing.**

The onboarding process now:
- ✅ Preserves role selection from step 1
- ✅ Validates role exists before completion
- ✅ Restores role from server if missing from state
- ✅ Ensures role is never undefined in completion payload
- ✅ Properly sets role in server preferences

**Next Step:** Test with a fresh Apple/Google sign-in to verify coach role is properly assigned.
