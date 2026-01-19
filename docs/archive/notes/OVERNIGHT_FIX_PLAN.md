# Overnight Navigation Fix Plan
**Created:** December 10, 2025 3:12 AM
**Issue:** App stuck on loading spinner, not redirecting to sign-in

## Root Cause Analysis

The app loads successfully but gets stuck on the index screen showing a loading spinner. The AuthProvider initialization completes but routing logic never executes properly.

### Symptoms:
- ✅ Metro bundles successfully (3909-3975 modules)
- ✅ App initializes (Sentry, HTTP client, push notifications)
- ❌ No auth check logs appear in console
- ❌ App never redirects from index to sign-in
- ❌ Stuck on white screen with loading spinner

### Likely Root Causes:
1. **Navigation State Race Condition**: `navState?.key` may not be available when AuthProvider tries to initialize
2. **Timing Issue**: The `initializing` flag prevents routing useEffect from running if there's any delay
3. **Missing Error Handling**: Silent failures in auth check or health check
4. **AsyncStorage Blocking**: Onboarding flag check might be blocking initialization

## Implemented Fixes (Committed)

### ✅ Added Debug Logging
Added comprehensive console.log statements to track:
- Navigation state readiness
- Health check execution and results  
- Auth check execution and results
- Initialization completion
- Routing decisions

Location: `context/AuthProvider.tsx` lines 228-276, 285-302, 354-359

## Remaining Tasks

### 1. Add Fallback Navigation Timeout
**Priority: CRITICAL**
**File:** `context/AuthProvider.tsx`

Add a safety timeout that forces navigation to sign-in if initialization takes too long:

```typescript
// In Initial auth check useEffect, after setInitializing(false)
// Add timeout fallback
useEffect(() => {
  const timeout = setTimeout(() => {
    if (initializing) {
      console.warn('[AuthProvider] Initialization timeout - forcing completion');
      setLoading(false);
      setInitializing(false);
    }
  }, 5000); // 5 second timeout

  return () => clearTimeout(timeout);
}, [initializing]);
```

### 2. Fix Navigation State Dependency
**Priority: HIGH**  
**File:** `app/_layout.tsx`

Remove the `navState?.key` check that blocks rendering:

```typescript
// Current (line 145):
if (!loaded || !navState?.key) {
  return <LoadingView />;
}

// Change to:
if (!loaded) {
  return <LoadingView />;
}
```

The `navState` check is too strict and may prevent the app from ever showing content.

### 3. Simplify Index Screen
**Priority: MEDIUM**
**File:** `app/index.tsx`

Add a direct redirect after a timeout if AuthProvider doesn't handle it:

```typescript
export default function Index() {
  const { loading, user } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    // Fallback: if stuck loading for >3 seconds, manually redirect
    const timeout = setTimeout(() => {
      if (!user) {
        console.log('[Index] Fallback redirect to sign-in');
        router.replace('/sign-in');
      } else {
        router.replace('/(tabs)');
      }
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [user, router]);
  
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
```

### 4. Add Error Boundary to Index
**Priority: MEDIUM**
**File:** `app/index.tsx`

Wrap index in error boundary to catch silent failures:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function Index() {
  return (
    <ErrorBoundary>
      <IndexContent />
    </ErrorBoundary>
  );
}
```

### 5. Make AsyncStorage Non-Blocking
**Priority: HIGH**
**File:** `context/AuthProvider.tsx`

The AsyncStorage read for onboarding flag happens in a separate useEffect but could still block. Add a timeout:

```typescript
useEffect(() => {
  let mounted = true;
  const timeout = setTimeout(() => {
    if (mounted) {
      console.warn('[Auth] AsyncStorage timeout - assuming onboarding incomplete');
      setHasCompletedOnboarding(false);
    }
  }, 2000);

  (async () => {
    try {
      const storedValue = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
      clearTimeout(timeout);
      if (mounted) {
        setHasCompletedOnboarding(storedValue === 'true');
      }
    } catch (error) {
      clearTimeout(timeout);
      console.warn('[Auth] Failed to load onboarding flag from storage:', error);
    }
  })();

  return () => {
    mounted = false;
    clearTimeout(timeout);
  };
}, []);
```

### 6. Add Initialization Progress Indicator
**Priority: LOW**
**File:** `app/index.tsx`

Show more feedback during loading:

```typescript
const { loading, healthOk, healthError } = useAuth();

return (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
    <ActivityIndicator size="large" />
    {__DEV__ && (
      <Text style={{ marginTop: 20, color: '#666' }}>
        {healthError ? `Backend Error: ${healthError}` : 'Initializing...'}
      </Text>
    )}
  </View>
);
```

### 7. Test Health Check Timeout
**Priority: MEDIUM**
**File:** `context/AuthProvider.tsx`

Verify the health check doesn't hang:

```typescript
const checkHealth = useCallback(async () => {
  try {
    console.log('[AuthProvider] Starting health check...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    await httpGet('/health', { signal: controller.signal });
    clearTimeout(timeout);
    
    console.log('[AuthProvider] Health check passed');
    setHealthOk(true);
    setHealthError(null);
    return true;
  } catch (err: any) {
    console.error('[AuthProvider] Health check failed:', err.message);
    setHealthOk(false);
    const message = typeof err?.message === 'string' ? err.message : 'API unreachable';
    setHealthError(message);
    return false;
  }
}, []);
```

### 8. Add Metro Cache Clear to Morning Script
**Priority: LOW**
**File:** `MORNING_COMMANDS.sh`

Add watchman fix:

```bash
# Fix watchman warning
watchman watch-del "$PWD"
watchman watch-project "$PWD"

# Clear all caches
rm -rf node_modules/.cache .expo ios/build android/build
```

## Execution Order

1. ✅ **Remove `navState?.key` check from _layout.tsx** - Most likely culprit
2. ✅ **Add fallback timeout to AuthProvider** - Safety net
3. ✅ **Add fallback redirect to Index** - Last resort
4. **Test on simulator** - Verify fixes work
5. **Add AsyncStorage timeout** - Prevent blocking
6. **Add health check timeout** - Prevent hanging
7. **Clean up debug logs** - Remove after verification
8. **Commit and document** - Save working solution

## Success Criteria

- [ ] App loads and immediately redirects to sign-in (no user logged in)
- [ ] Console logs show complete initialization flow
- [ ] No hanging or infinite loading states
- [ ] Works on cold start (kill app, relaunch)
- [ ] Works on hot reload (save file changes)

## Testing Protocol

```bash
# 1. Kill all processes
pkill -f expo
pkill -f metro

# 2. Clear caches
rm -rf node_modules/.cache .expo

# 3. Start fresh
npx expo start --ios --clear

# 4. Watch console for debug logs
# Expected output:
# [AuthProvider] Waiting for navigation state...
# [AuthProvider] Navigation ready, starting auth check
# [AuthProvider] Checking backend health...
# [AuthProvider] Health check result: true
# [AuthProvider] Checking authentication...
# [AuthProvider] Auth check failed (user not logged in): Unauthorized
# [AuthProvider] Initialization complete
# [AuthProvider] Routing check - segment: , user: false, pendingVerif: false
# [AuthProvider] Redirecting to sign-in (unauthenticated)
```

## Rollback Plan

If fixes cause issues:
```bash
git revert HEAD~1  # Revert debug logs
git revert HEAD~2  # Revert any other changes
```

Original working commit before changes: `[check git log]`
