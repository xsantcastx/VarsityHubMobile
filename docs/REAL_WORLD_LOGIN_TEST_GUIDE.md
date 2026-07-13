# Real-World Login Test Guide

**Purpose:** Test if your app can handle real users logging in

## 🚀 Quick Test (5 minutes)

Run this script first:

```bash
./scripts/QUICK_LOGIN_TEST.sh
```

This checks:

- ✅ Backend is online
- ✅ Login endpoint works
- ✅ Token validation works

---

## 📱 Manual Test Checklist (15 minutes)

### ✅ TEST 1: Fresh Install

**Time:** 2 minutes

1. **Clear app data:**
   - iOS: Settings → General → iPhone Storage → VarsityHub → Delete App
   - Android: Settings → Apps → VarsityHub → Uninstall

2. **Reinstall app** (or just clear SecureStore if you have a dev tool)

3. **Open app**

4. **Expected Result:**
   - ✅ Shows sign-in screen (not blank/crash)
   - ✅ No errors in console
   - ✅ Can see email/password fields

**❌ If fails:** App might be hanging on auth check or crashing on startup

---

### ✅ TEST 2: Email Login - Success

**Time:** 1 minute

1. **Enter valid email/password** (use a test account)

2. **Click "Sign In"**

3. **Watch for:**
   - ✅ Loading indicator appears
   - ✅ Redirects to feed (if onboarded) OR onboarding (if not)
   - ✅ NO "Invalid login response" error
   - ✅ NO stuck on loading screen

4. **Check token saved:**
   - Force close app
   - Reopen app
   - ✅ Should auto-login (NOT show sign-in screen)

**❌ If fails:**

- "Invalid login response" → Backend not returning `access_token`
- Stuck on loading → `checkAuth()` never completes
- Wrong redirect → AuthProvider routing issue

---

### ✅ TEST 3: Email Login - Wrong Password

**Time:** 30 seconds

1. **Enter correct email, wrong password**

2. **Click "Sign In"**

3. **Expected:**
   - ✅ Shows error: "Invalid credentials" or "Login failed"
   - ✅ Stays on sign-in screen
   - ✅ Can immediately retry

**❌ If fails:**

- Generic error → Error handling issue
- Can't retry → State not reset

---

### ✅ TEST 4: Network Failure

**Time:** 2 minutes

1. **Turn off WiFi/cellular**

2. **Try to login**

3. **Expected:**
   - ✅ Shows network error after ~30 seconds
   - ✅ Doesn't crash
   - ✅ Error message is clear

4. **Turn WiFi back on**

5. **Try login again**

6. **Expected:**
   - ✅ Login succeeds
   - ✅ No state corruption

**❌ If fails:**

- Hangs forever → No timeout
- Crashes → Unhandled error
- Can't retry → State corruption

---

### ✅ TEST 5: Google Sign-In

**Time:** 1 minute

1. **Click "Continue with Google"**

2. **Complete Google OAuth flow**

3. **Expected:**
   - ✅ Redirects to feed/onboarding
   - ✅ NO "Failed to retrieve email" error
   - ✅ User data loads correctly

**❌ If fails:**

- "Google sign in not configured" → Missing OAuth client IDs
- "Failed to retrieve email" → OAuth response issue
- Stuck after OAuth → `checkAuth()` issue

---

### ✅ TEST 6: Apple Sign-In (iOS only)

**Time:** 1 minute

1. **Click Apple sign-in button**

2. **Complete Apple authentication**

3. **Expected:**
   - ✅ Redirects correctly
   - ✅ User data loads

**❌ If fails:**

- Button doesn't appear → iOS-only check working
- Missing email error → Apple OAuth issue
- Stuck after auth → Routing issue

---

### ✅ TEST 7: Token Persistence

**Time:** 1 minute

1. **Login successfully**

2. **Force close app completely:**
   - iOS: Swipe up, swipe away app
   - Android: Recent apps, swipe away

3. **Reopen app**

4. **Expected:**
   - ✅ Auto-logs in (goes to feed/onboarding)
   - ✅ Does NOT show sign-in screen
   - ✅ User data loads

**❌ If fails:**

- Shows sign-in screen → Token not saved/loaded
- Hangs on loading → Token loading race condition
- Wrong screen → Routing issue

---

### ✅ TEST 8: Rapid Login Attempts

**Time:** 1 minute

1. **Try email login (wrong password)**
2. **Immediately try Google login**
3. **Immediately try Apple login**

4. **Expected:**
   - ✅ Each attempt works independently
   - ✅ No crashes
   - ✅ No state conflicts

**❌ If fails:**

- Crashes → Race condition
- State conflicts → Multiple auth calls interfering

---

## 🔍 Common Login Issues & Fixes

### Issue: "Invalid login response"

**Cause:** Backend not returning `access_token` in response

**Check:**

```bash
# Test login endpoint directly
curl -X POST https://api-production-8ac3.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

**Should return:**

```json
{
  "access_token": "eyJ...",
  "user": {...},
  "needs_onboarding": false
}
```

**Fix:** Check `server/src/routes/auth.ts` line 145 - should return `access_token`

---

### Issue: Stuck on Loading Screen

**Cause:** `checkAuth()` never completes

**Check:**

1. Open React Native debugger
2. Check console for errors
3. Look for: "AuthProvider checkAuth error"

**Common causes:**

- `User.me()` failing silently
- Network timeout
- Token invalid but not cleared

**Fix:** Added better error handling in `AuthProvider.tsx` - check console logs

---

### Issue: Redirect Loops

**Cause:** AuthProvider routing logic conflicting

**Check:**

1. Watch console for: `[AuthProvider] Routing check`
2. Look for rapid redirects

**Fix:** `lastRedirectRef` should prevent this, but check routing logic

---

### Issue: Token Lost on App Restart

**Cause:** SecureStore not saving/loading correctly

**Check:**

```typescript
// In app, after login:
import * as SecureStore from 'expo-secure-store';
const token = await SecureStore.getItemAsync('auth_token_key');
console.log('Token saved:', !!token);
```

**Fix:** Check `api/auth.ts` - `saveToken()` should work on both iOS/Android

---

## 🎯 Success Criteria

Your login is **ready for real users** if:

- ✅ All 3 login methods work (email, Google, Apple)
- ✅ Errors are shown clearly (not generic)
- ✅ Token persists across app restarts
- ✅ Network failures are handled gracefully
- ✅ No crashes during login
- ✅ Users can retry after errors
- ✅ Redirects go to correct screens
- ✅ No redirect loops

---

## 🚨 Red Flags (Fix Before Release)

If you see ANY of these, **fix immediately**:

1. ❌ **"Invalid login response"** error → Backend issue
2. ❌ **Stuck on loading** → `checkAuth()` broken
3. ❌ **Redirect loops** → Routing logic broken
4. ❌ **Token lost on restart** → Storage broken
5. ❌ **Crashes on login** → Unhandled errors
6. ❌ **Can't login after network restored** → State corruption

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

✅ TEST 1: Fresh Install - PASS / FAIL
✅ TEST 2: Email Login Success - PASS / FAIL
✅ TEST 3: Wrong Password - PASS / FAIL
✅ TEST 4: Network Failure - PASS / FAIL
✅ TEST 5: Google Sign-In - PASS / FAIL
✅ TEST 6: Apple Sign-In - PASS / FAIL
✅ TEST 7: Token Persistence - PASS / FAIL
✅ TEST 8: Rapid Attempts - PASS / FAIL

Issues Found:
-

Ready for Release: YES / NO
```

---

## 🔧 Quick Fixes Applied

I've improved error handling in:

- ✅ `app/sign-in.tsx` - Better handling of `checkAuth()` failures
- ✅ `context/AuthProvider.tsx` - Better error logging

These changes prevent users from seeing confusing errors when login succeeds but routing fails.

---

**Next Steps:**

1. Run the quick test script
2. Complete manual test checklist
3. Fix any issues found
4. Re-test before release
