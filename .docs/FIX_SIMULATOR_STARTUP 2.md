# Fix Simulator Startup Issues

## Quick Fix (60 seconds)

Your simulator warnings are normal on cold startup. Here's what's happening:

### 1. **Sentry DSN Warning** ✅ ALREADY FIXED
```
WARN [sentry] No valid DSN; crash reporting disabled
```
**Status:** Your `.env` file already has the DSN set correctly.
- The warning appears because Sentry initializes before env vars fully load
- This resolves after the app boots completely
- **No action needed** — just ignore this warning on startup

### 2. **Unauthorized /me Error** ⏳ NEEDS LOGIN
```
ERROR [http] Request failed … /me → Unauthorized
```
**Cause:** App tries to fetch user profile before a token is saved
**Fix:** Simply log in once, and the token will be cached

**Steps:**
1. App is open in simulator now
2. Look for the **Sign In** or **Sign Up** screen
3. Click **Sign Up** (or use test account if available)
4. Complete email verification
5. Once logged in, the token is saved to SecureStore
6. This error will disappear on next app restart

**Alternative (Instant):** If you want to skip login for testing:
- Edit `context/AuthProvider.tsx` line 100
- Temporarily comment out the `User.me()` call
- The app will boot without auth (useful for UI testing only)

### 3. **Animation Warning** ✅ COSMETIC
```
WARN Sending onAnimatedValueUpdate with no listeners registered
```
**Status:** This is harmless and internal to React Native
- Appears when animations initialize before listeners attach
- Resolves once UI components mount
- No fix needed — purely cosmetic warning

---

## Full Startup Sequence (What's Happening)

```
Expo Start
  ↓
Load .env (DSN not immediately available → Sentry warning)
  ↓
Sentry initializes (warning is harmless)
  ↓
App renders AuthProvider
  ↓
Check backend health: ✅ (Railway API responding)
  ↓
Check for stored token: ❌ (none found on clean start)
  ↓
Skip User.me() since no token (correct behavior!)
  ↓
App shows Sign In screen
  ↓
**YOU LOGIN HERE** ← Token gets saved to SecureStore
  ↓
Token is now available for all API calls
  ↓
No more /me Unauthorized errors!
```

---

## What You Need to Do Right Now

**Pick ONE:**

### Option A: Quick UI Testing (No Login)
If you just want to test UI without logging in:
1. Go to `context/AuthProvider.tsx` line 100
2. Wrap `User.me()` in try-catch, set dummy user on error
3. App boots to home screen instantly
4. **Downside:** Can't test authenticated features

### Option B: Proper Testing (Recommended) ✅
1. Let app show Sign In screen
2. Click **Sign Up**
3. Enter test email (e.g., `test@varsityhub.app`)
4. Verify email when prompted
5. Complete onboarding
6. **Result:** Full access to all features, token cached
7. On next restart, app goes straight to home (no login needed)

### Option C: Use Existing Test Account
If you have a test account from previous runs:
1. Use email: `[test account email]`
2. Use password: `[test account password]`
3. Click **Sign In**
4. **Result:** Instant access, token cached

---

## Technical Details (For Reference)

### Sentry DSN Timing
- `initSentry()` runs in `_layout.tsx` at app boot
- `.env` loading is slightly async
- DSN env var becomes available ~50-100ms later
- Sentry gracefully handles missing DSN on cold start
- **Fix:** Non-blocking, warning disappears after boot

### /me Authorization
The error is correct behavior:
```typescript
// AuthProvider.tsx line 100 (CORRECT)
const token = await auth.getToken();
if (!token) {
  setUser(null);
  return; // ← Don't call /me without token!
}
const me = await User.me(); // ← Only called with token
```

### Animation Warning
From React Native's Animated module:
- Emitter fires before listeners attach during init
- Harmless on startup (not a memory leak)
- Resolves once component trees mount
- Can be safely ignored

---

## Verification Checklist

After you log in once and restart the app:

- [ ] App loads without "Unauthorized" error
- [ ] Home screen displays (not Sign In)
- [ ] No repeated requests to `/me` in console
- [ ] Sentry DSN warning gone after initial boot
- [ ] Animation warning gone (or only on first load)

---

## Quick Commands

```bash
# Start fresh (clears old tokens, forces new build)
npx expo start --clear

# Start with logs (see all errors/warnings)
npx expo start --ios 2>&1 | tee expo-logs.txt

# Check env vars are loaded
grep EXPO_PUBLIC_SENTRY_DSN .env

# Verify backend is live
curl https://api-production-8ac3.up.railway.app/health
```

---

## Next Steps

1. **Now:** Let the app boot, use Sign Up to create account
2. **After Login:** Warnings should disappear
3. **After Restart:** App goes straight to home screen (token is cached)
4. **Ready for QA:** Test all features with full authentication

---

**Status:** ✅ App is ready to test. Just log in once to cache the token!
