# Login Issues Diagnostic Checklist

## 🔴 Critical Issues Found in Code Review

### Issue 1: Missing Error Handling in checkAuth()
**Location:** `context/AuthProvider.tsx` line 216-220

**Problem:** If `checkAuth()` throws an error, it's caught but user state might be inconsistent.

**Current Code:**
```typescript
} catch (err: any) {
  setUser(null);
  throw err; // Error is thrown but not handled
}
```

**Risk:** If `checkAuth()` is called from sign-in and throws, the error might not be displayed to user.

---

### Issue 2: Token Loading Race Condition
**Location:** `api/auth.ts` line 19-29

**Problem:** `loadToken()` might return null even if token exists in storage (async timing).

**Current Code:**
```typescript
export async function loadToken(): Promise<string | null> {
  const cached = getAuthToken();
  if (cached) return cached;
  // ... async SecureStore access
}
```

**Risk:** On app startup, token might not load fast enough, causing unnecessary redirect to sign-in.

---

### Issue 3: No Retry Logic for Network Failures
**Location:** `app/sign-in.tsx` line 47-89

**Problem:** If network request fails (timeout, 502, etc.), login just shows error. No automatic retry.

**Risk:** Users on slow/unstable connections will see errors even when backend is just slow.

---

### Issue 4: Google/Apple Auth Missing Email Validation
**Location:** `app/sign-in.tsx` line 100-105, 138-143

**Problem:** Checks for email but doesn't validate format or handle edge cases.

**Current Code:**
```typescript
if (!response?.user?.email && !response?.email) {
  setError('Failed to retrieve email from Google');
  return;
}
```

**Risk:** If OAuth returns malformed email, app might crash or create invalid account.

---

### Issue 5: AuthProvider Routing Logic Complexity
**Location:** `context/AuthProvider.tsx` line 350-440

**Problem:** Complex routing logic with multiple conditions. Hard to debug if routing fails.

**Risk:** Users might get stuck on wrong screen or in redirect loops.

---

## 🧪 Test Scenarios That Will Reveal Issues

### Scenario A: Slow Network Login
1. Throttle network to 3G speed
2. Try to login
3. **Watch for:** Timeout errors, stuck loading, partial state

### Scenario B: Interrupted Login
1. Start login process
2. Immediately close app mid-request
3. Reopen app
4. **Watch for:** Corrupted state, stuck screens, token issues

### Scenario C: Multiple Tabs/Instances
1. Login on device
2. Try to login on another device with same account
3. **Watch for:** Token conflicts, session issues

### Scenario D: Backend Restart During Login
1. Start login
2. Restart backend server mid-request
3. **Watch for:** Error handling, retry logic, user feedback

---

## 🔧 Quick Fixes to Implement

### Fix 1: Add Retry Logic to Login
```typescript
const onSubmit = async () => {
  // ... existing code ...
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const res = await User.loginViaEmailPassword(email, password);
      // ... handle success ...
      return;
    } catch (e: any) {
      attempts++;
      const isRetryable = 
        e?.message?.includes('Network') ||
        e?.status === 502 ||
        e?.status === 503 ||
        e?.status === 0;
      
      if (isRetryable && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000 * attempts));
        continue;
      }
      throw e;
    }
  }
};
```

### Fix 2: Better Token Loading
```typescript
// In AuthProvider, wait for token before routing
useEffect(() => {
  let mounted = true;
  (async () => {
    // Wait a bit for token to load from storage
    await new Promise(r => setTimeout(r, 100));
    const token = await auth.getToken();
    if (mounted && token) {
      await checkAuth();
    }
  })();
}, []);
```

### Fix 3: Add Loading States
Show clear loading indicators during:
- Token loading
- Auth check
- Login request
- Navigation

---

## 📊 Real-World Usage Test Plan

### Phase 1: Basic Functionality (15 min)
- [ ] Fresh install → sign-in screen appears
- [ ] Email login works
- [ ] Google login works  
- [ ] Apple login works (iOS)
- [ ] Wrong password shows error
- [ ] Token persists after app restart

### Phase 2: Edge Cases (20 min)
- [ ] Login with no internet → shows error
- [ ] Login with slow internet → doesn't timeout too fast
- [ ] Login with expired token → redirects to sign-in
- [ ] Login with banned account → shows ban message
- [ ] Multiple rapid login attempts → no crashes

### Phase 3: Stress Test (10 min)
- [ ] 10 login attempts in 30 seconds
- [ ] Login while backend is restarting
- [ ] Login, close app mid-request, reopen
- [ ] Login on multiple devices simultaneously

---

## 🚨 Red Flags (If You See These, Fix Before Release)

1. **"Invalid login response"** error → Backend not returning proper format
2. **Stuck on loading screen** → checkAuth() never completes
3. **Redirect loops** → AuthProvider routing logic broken
4. **Token lost on app restart** → Storage not working
5. **Can't login after network restored** → State corruption
6. **Crashes on login** → Unhandled errors

---

## ✅ Success Criteria

Your login is ready for real users if:
- ✅ All 3 login methods work (email, Google, Apple)
- ✅ Errors are shown clearly to users
- ✅ Token persists across app restarts
- ✅ Network failures are handled gracefully
- ✅ No crashes during login flow
- ✅ Users can retry after errors
- ✅ Redirects go to correct screens
