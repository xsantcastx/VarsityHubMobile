# Unified Authentication Flow

## Overview

The authentication system has been refactored to eliminate competing redirect logic and ensure all auth paths (email/password, Google, Apple) flow through a single centralized routing engine in `AuthProvider`.

**Core principle**: Every auth path calls `checkAuth()` and lets `AuthProvider` own the navigation decisions.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Authentication Sources                        │
├─────────────────────────────────────────────────────────────────┤
│ Email/Password    │     Google OAuth       │    Apple OAuth      │
└──────┬────────────┴────────┬───────────────┴──────┬─────────────┘
       │                     │                      │
       ├─ User.loginViaEmailPassword()
       ├─ User.loginViaGoogle()
       └─ User.loginViaApple()
               │
               ├ If needs_verification: call checkAuth({ email, pendingVerification: true })
               └ Otherwise: call checkAuth()
               │
       ┌───────▼────────────────────────────────────┐
       │       AuthProvider.checkAuth()              │
       │  - Sets user state from User.me()           │
       │  - Or sets pendingVerificationEmail         │
       └───────┬────────────────────────────────────┘
               │
       ┌───────▼────────────────────────────────────────────────────┐
       │    AuthProvider Routing Logic (useEffect)                   │
       │                                                             │
       │  1. If pendingVerificationEmail → route to /verify-email   │
       │  2. If user exists & needs_onboarding → route to /onboarding
       │  3. If user exists & onboarded → route to /(tabs)/feed    │
       │  4. If no user & not on public route → route to /sign-in  │
       └─────────────────────────────────────────────────────────────┘
```

---

## Unified Entry Points

### 1. Email/Password Login

**File**: `app/sign-in.tsx` → `onSubmit()`

```typescript
const res = await User.loginViaEmailPassword(email, password);

if (res?.needs_verification) {
  // Mark email as pending verification; don't fetch user yet
  await checkAuth({ email, pendingVerification: true });
  // AuthProvider will detect pendingVerificationEmail and route to /verify-email
  return;
}

// Normal login; fetch user and let AuthProvider route
await checkAuth();
// AuthProvider will check onboarding_completed and route to /onboarding or /feed
```

**Benefits**:
- Single code path for all outcomes
- User context available on verify-email screen
- No manual route navigation; AuthProvider decides

---

### 2. Google OAuth

**File**: `app/sign-in.tsx` → `handleGoogleLogin()`

```typescript
const response = await signInWithGoogle();

// Validate response contains email
if (!response?.user?.email && !response?.email) {
  captureException(new Error('Missing email in Google response'));
  setError('Failed to retrieve email from Google');
  return;
}

// Unified entry: call checkAuth and let AuthProvider route
await checkAuth();
// AuthProvider will detect onboarding_completed and route appropriately
```

**Key changes**:
- Removed manual `router.replace('/onboarding/step-1-role')` 
- Removed manual `router.replace('/(tabs)/feed')`
- Added response validation with Sentry telemetry
- Single path for all outcomes

---

### 3. Apple OAuth

**File**: `app/sign-in.tsx` → `handleAppleLogin()`

```typescript
const response = await signInWithApple();

// Validate response contains email
if (!response?.user?.email && !response?.email) {
  captureException(new Error('Missing email in Apple response'));
  setError('Failed to retrieve email from Apple');
  return;
}

// Unified entry: call checkAuth and let AuthProvider route
await checkAuth();
// AuthProvider will detect onboarding_completed and route appropriately
```

**Key changes**:
- Removed manual `router.replace('/onboarding/step-1-role')`
- Removed manual `router.replace('/(tabs)/feed')`
- Added response validation with Sentry telemetry
- Single path for all outcomes

---

## AuthProvider Changes

### New State

```typescript
const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
```

Tracks when a user is awaiting email verification; populated by `checkAuth({ email, pendingVerification: true })`.

### Enhanced checkAuth()

```typescript
const checkAuth = async (options?: { 
  email?: string; 
  pendingVerification?: boolean 
}) => {
  // If email verification is pending, store email and don't fetch user
  if (options?.pendingVerification && options?.email) {
    setPendingVerificationEmail(options.email);
    setUser(null); // Don't populate user until verified
    return;
  }

  // Normal flow: fetch user from backend
  const me = await User.me();
  setUser(me);
  setPendingVerificationEmail(null); // Clear pending email
};
```

### Unified Routing Logic

```typescript
// In routing effect:
if (pendingVerificationEmail && firstSegment !== 'verify-email') {
  router.replace('/verify-email');
  return;
}

if (user) {
  if (user.preferences?.onboarding_completed === false) {
    router.replace('/onboarding/step-1-role');
    return;
  }
  // Onboarded: redirect to feed if on public route
  if (isPublic) {
    router.replace('/(tabs)');
  }
}

// Unauthenticated: redirect to sign-in if not on public route
if (!user && !pendingVerificationEmail && !isPublic) {
  router.replace('/sign-in');
}
```

---

## Verify Email Screen

**File**: `app/verify-email.tsx`

### Protection Against Missing Context

```typescript
const { pendingVerificationEmail, checkAuth } = useAuth();

useEffect(() => {
  if (!pendingVerificationEmail) {
    router.replace('/sign-in');
  }
}, [pendingVerificationEmail, router]);
```

If user navigates directly to `/verify-email` without pending verification, they're redirected back to sign-in.

### Post-Verification Redirect

```typescript
const onVerify = async () => {
  const result = await User.verifyEmail(code);
  setIsVerified(true);

  // Call checkAuth to populate user state
  await checkAuth();
  // AuthProvider will now detect user and route based on onboarding_completed
};
```

No manual routing needed; `AuthProvider` detects populated user state and routes automatically.

---

## Error Handling & Telemetry

All three auth paths include Sentry captures for error tracking:

### Invalid Responses

```typescript
if (!res?.access_token) {
  const errMsg = `Missing access_token. Response keys: ${Object.keys(res || {}).join(', ')}`;
  captureException(new Error(errMsg), { 
    tags: { context: 'email-password-login', userId: email } 
  });
  setError('Invalid login response');
  return;
}
```

### Malformed OAuth Responses

```typescript
if (!response?.user?.email && !response?.email) {
  const errMsg = `Missing email in Google response. Response: ${JSON.stringify(response).substring(0, 200)}`;
  captureException(new Error(errMsg), { tags: { context: 'google-signin' } });
  setError('Failed to retrieve email from Google');
  return;
}
```

### Request Failures

```typescript
catch (e: any) {
  captureException(e, {
    tags: { context: 'email-password-login', userId: email },
    extra: { response: e?.data?.error || e?.response?.data },
  });
  setError(e?.message || 'Login failed');
}
```

---

## Redirect Loop Prevention

`AuthProvider` uses a `lastRedirectRef` to track the last navigation decision:

```typescript
const lastRedirectRef = React.useRef<string | null>(null);

if (lastRedirectRef.current !== '/verify-email') {
  lastRedirectRef.current = '/verify-email';
  router.replace('/verify-email');
}
```

This prevents rapid re-routing loops when dependencies change (e.g., user state updates).

---

## Testing Checklist

- [ ] **Email/Password Login**
  - [ ] Successful login (onboarded user) → redirects to feed
  - [ ] Login requiring verification → redirects to /verify-email
  - [ ] Invalid email/password → shows error, stays on sign-in

- [ ] **Email Verification**
  - [ ] Verify email code → shows success, redirects based on onboarding
  - [ ] Resend code → works correctly
  - [ ] Direct navigation to /verify-email without pending email → redirects to sign-in

- [ ] **Google OAuth**
  - [ ] Successful sign-in (onboarded user) → redirects to feed
  - [ ] Successful sign-in (new user) → redirects to onboarding
  - [ ] Cancelled by user → shows appropriate message

- [ ] **Apple OAuth**
  - [ ] Successful sign-in (onboarded user) → redirects to feed
  - [ ] Successful sign-in (new user) → redirects to onboarding
  - [ ] Cancelled by user → shows appropriate message

- [ ] **Auth State Consistency**
  - [ ] AuthProvider.user populated after each successful auth
  - [ ] pendingVerificationEmail set only during verification flow
  - [ ] No stale auth state between navigations
  - [ ] No redirect loops when routing

---

## Files Modified

1. **`context/AuthProvider.tsx`**
   - Added `pendingVerificationEmail` state
   - Enhanced `checkAuth()` with verification options
   - Added verification detection in routing logic

2. **`app/sign-in.tsx`**
   - Unified email/password handler to always call `checkAuth()`
   - Replaced Google/Apple hardcoded routes with `checkAuth()`
   - Added Sentry error telemetry for all paths

3. **`app/verify-email.tsx`**
   - Added `useAuth()` context to detect pending verification
   - Enforce redirect if not in verification flow
   - Call `checkAuth()` after successful verification

---

## Benefits of Unified Flow

✅ **Single source of truth**: AuthProvider owns all routing decisions  
✅ **No hardcoded routes**: Sign-in screen doesn't decide where user goes  
✅ **Consistent state**: User context available on verify-email screen  
✅ **Error telemetry**: Malformed responses captured to Sentry  
✅ **No redirect loops**: lastRedirectRef prevents rapid re-routing  
✅ **Easy to test**: Single entry point (`checkAuth()`) for all paths  
✅ **Future-proof**: Adding new auth methods only requires calling `checkAuth()`  

---

## Migration Guide (if adding new auth methods)

1. Implement login handler in sign-in.tsx (Google/Apple style)
2. Validate API response contains required fields
3. Capture errors to Sentry
4. Call `checkAuth()` with optional email/verification context
5. AuthProvider handles routing automatically

Example:
```typescript
const handleNewAuthMethod = async () => {
  try {
    const res = await NewAuthService.login();
    
    if (!res?.email) {
      captureException(new Error('Missing email'));
      return;
    }
    
    // Unified entry
    await checkAuth();
  } catch (e) {
    captureException(e, { tags: { context: 'new-auth' } });
  }
};
```
