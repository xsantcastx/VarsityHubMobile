# Real-World Login Test Plan
**Purpose:** Test if your app can handle real users logging in under various conditions

## 🎯 Critical Login Scenarios to Test

### Test 1: Fresh Install - First Time User
**Scenario:** User downloads app, opens it for the first time

**Steps:**
1. Clear app data (uninstall/reinstall or clear SecureStore)
2. Open app
3. **Expected:** Should show sign-in screen (not crash or hang)
4. Try to sign up with email
5. **Expected:** Should create account and redirect to onboarding

**Potential Issues:**
- App hangs on startup waiting for auth
- Token storage fails
- Navigation loops

---

### Test 2: Email/Password Login - Happy Path
**Scenario:** Existing user with verified email

**Steps:**
1. Use valid email/password
2. Click "Sign In"
3. **Expected:** 
   - Loading indicator shows
   - Redirects to feed (if onboarded) or onboarding (if not)
   - No error messages
   - Token is saved

**Potential Issues:**
- "Invalid login response" error
- Stuck on loading screen
- Redirects to wrong screen
- Token not saved

---

### Test 3: Email/Password Login - Unverified Email
**Scenario:** User registered but hasn't verified email

**Steps:**
1. Create account but don't verify email
2. Try to login
3. **Expected:** Should redirect to `/verify-email` screen

**Potential Issues:**
- Gets stuck on sign-in screen
- Shows generic error
- Redirects to wrong screen

---

### Test 4: Email/Password Login - Wrong Password
**Scenario:** User enters incorrect password

**Steps:**
1. Enter correct email, wrong password
2. Click "Sign In"
3. **Expected:** 
   - Shows error: "Invalid credentials" or "Login failed"
   - Stays on sign-in screen
   - Can retry immediately

**Potential Issues:**
- Generic error message
- App crashes
- Can't retry

---

### Test 5: Email/Password Login - Network Failure
**Scenario:** User tries to login with no internet

**Steps:**
1. Turn off WiFi/cellular
2. Enter credentials and click "Sign In"
3. **Expected:**
   - Shows network error after timeout
   - Doesn't crash
   - Can retry when network restored

**Potential Issues:**
- Hangs forever
- Crashes
- No error message

---

### Test 6: Google Sign-In
**Scenario:** User logs in with Google OAuth

**Steps:**
1. Click "Continue with Google"
2. Complete Google OAuth flow
3. **Expected:**
   - Redirects to feed or onboarding
   - User data is loaded
   - Token is saved

**Potential Issues:**
- "Google sign in not configured" error
- Missing email error
- Stuck after OAuth completes
- Doesn't save token

---

### Test 7: Apple Sign-In (iOS only)
**Scenario:** User logs in with Apple

**Steps:**
1. Click Apple sign-in button
2. Complete Apple authentication
3. **Expected:**
   - Redirects to feed or onboarding
   - User data is loaded
   - Token is saved

**Potential Issues:**
- Button doesn't appear
- Missing email error
- Stuck after Apple auth
- Doesn't save token

---

### Test 8: Token Persistence - App Restart
**Scenario:** User logs in, closes app, reopens

**Steps:**
1. Login successfully
2. Force close app completely
3. Reopen app
4. **Expected:**
   - Should automatically log in
   - Should NOT show sign-in screen
   - Should go directly to feed/onboarding

**Potential Issues:**
- Shows sign-in screen (token lost)
- Hangs on loading
- Redirects to wrong screen

---

### Test 9: Token Expiration
**Scenario:** User's token expires while using app

**Steps:**
1. Login successfully
2. Wait for token to expire (or manually expire it on backend)
3. Try to use app (navigate, load data)
4. **Expected:**
   - Should detect 401 error
   - Should redirect to sign-in
   - Should show appropriate message

**Potential Issues:**
- Infinite error loops
- Stuck on loading
- Doesn't redirect to sign-in

---

### Test 10: Multiple Login Attempts
**Scenario:** User tries different login methods rapidly

**Steps:**
1. Try email login (wrong password)
2. Immediately try Google login
3. Immediately try Apple login
4. **Expected:**
   - Each attempt should work independently
   - No race conditions
   - No crashes

**Potential Issues:**
- Race conditions
- State conflicts
- Crashes

---

### Test 11: Login While Offline Then Online
**Scenario:** User tries to login offline, then comes online

**Steps:**
1. Turn off network
2. Try to login (should fail)
3. Turn network back on
4. Try to login again
5. **Expected:**
   - First attempt shows network error
   - Second attempt succeeds
   - No state corruption

**Potential Issues:**
- State gets corrupted
- Can't retry after network restored
- App thinks user is logged in when not

---

### Test 12: Login with Banned Account
**Scenario:** User tries to login with banned account

**Steps:**
1. Create account
2. Ban account (via admin)
3. Try to login
4. **Expected:**
   - Should show "Account banned" error
   - Should NOT allow login
   - Should stay on sign-in screen

**Potential Issues:**
- Generic error message
- Allows login anyway
- Crashes

---

## 🔧 Automated Test Script

Create this test file to run automated checks:
