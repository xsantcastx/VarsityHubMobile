/\*\*

- Google & Apple Sign-In - Manual E2E Test Scenarios
-
- Use these scenarios to manually test the sign-in flows on iOS, Android, and Web.
- Each scenario includes step-by-step instructions and expected results.
  \*/

# E2E Test Scenarios for Google & Apple Sign-In

## Prerequisites

Before running E2E tests, ensure:

1. **Google OAuth Setup**
   - [ ] Google Cloud Console project created
   - [ ] OAuth 2.0 credentials generated (Web, iOS, Android)
   - [ ] Redirect URIs configured correctly
   - [ ] Client IDs added to `.env` and app config
   - [ ] GOOGLE_ALLOWED_AUDIENCES set on backend

2. **Apple Sign-In Setup**
   - [ ] Apple Developer account with team ID
   - [ ] Private key downloaded (AuthKey_XXXXXXXXXX.p8)
   - [ ] Key ID and Team ID noted
   - [ ] Database migration applied (apple_id column)
   - [ ] Environment variables configured

3. **Backend Running**
   - [ ] Server running on http://localhost:3000
   - [ ] Database connected and synced
   - [ ] Email service configured (optional for these tests)

4. **Monitoring**
   - [ ] Server logs visible
   - [ ] Browser DevTools open (Network + Console tabs)
   - [ ] Mobile device logs captured (iOS: Xcode, Android: adb logcat)

---

## Scenario 1: Google Sign-In on Web

### Description

Test Google OAuth flow on web platform with valid credentials.

### Steps

1. **Navigate to Sign-Up Page**
   - Open app in web browser
   - Navigate to `/sign-up` or sign-up screen
   - Verify "Sign up with Google" button is visible

2. **Initiate Google Sign-In**
   - Click "Sign up with Google" button
   - Observe: Browser opens Google login dialog
   - Expected: Dialog shows Google account selection

3. **Select Google Account**
   - Select existing Google account or create new one
   - Enter credentials if prompted
   - Consent to app permissions if shown
   - Expected: Dialog closes, redirected back to app

4. **Verify Token Exchange**
   - **Server Log**: Look for `[auth/google] tokeninfo accepted credential`
   - **Network Tab**: POST to `/auth/google` with 200 response
   - **Response Body**:
     ```json
     {
       "access_token": "eyJ...",
       "user": {
         "id": "user-xxx",
         "email": "user@gmail.com",
         "google_id": "google-user-123",
         "display_name": "Test User",
         "avatar_url": "https://..."
       },
       "created": true,
       "needs_onboarding": false
     }
     ```

5. **Verify Token Storage**
   - Check browser DevTools → Storage → LocalStorage
   - Key `auth_token_key` should contain JWT token
   - Token should be valid JWT format (three dot-separated parts)

6. **Verify User Profile**
   - Navigate to profile screen or call `/me` endpoint
   - Verify user details match Google account
   - Verify `email_verified: true`

### Expected Results

- ✅ User created in database
- ✅ Google ID linked correctly
- ✅ Token stored and usable
- ✅ Profile shows correct data
- ✅ No errors in console or server logs

### Troubleshooting

| Issue                                               | Solution                                                                   |
| --------------------------------------------------- | -------------------------------------------------------------------------- |
| "Google credential not issued for this application" | Check `GOOGLE_ALLOWED_AUDIENCES` env var matches response `aud` field      |
| "Invalid redirect_uri"                              | Verify redirect URI in Google Cloud Console matches app's redirect handler |
| CORS errors                                         | Check server CORS config allows `https://accounts.google.com`              |
| Token validation fails                              | Verify Google API is accessible from server (check firewall/proxy)         |

---

## Scenario 2: Apple Sign-In on iOS

### Description

Test Apple Sign-In flow on physical iOS device or simulator.

### Steps

1. **Prerequisites on Device**
   - [ ] iOS 13+ (required for Sign-In with Apple)
   - [ ] For simulator: Use iPhone 12 or later
   - [ ] For device: Real device running iOS 13+
   - [ ] App built with EAS Build or local Xcode

2. **Navigate to Sign-Up**
   - Open app on iOS device/simulator
   - Navigate to sign-up screen
   - Verify "Sign in with Apple" button is visible
   - Verify button styling (white background, black text per Apple guidelines)

3. **Initiate Apple Sign-In**
   - Tap "Sign in with Apple" button
   - Observe: Apple Sign-In sheet slides up from bottom
   - **Simulator**: Mock credential generated automatically
   - **Device**: Face ID / Touch ID or password prompt appears

4. **Complete Authentication**
   - **Real Device**: Use Face ID or Touch ID to authenticate
   - **Simulator**: Automatic (shows mock token in logs)
   - **Sheet Options**:
     - Let Apple Share My Email (default for new accounts)
     - Hide My Email (generates relay email)

5. **Verify Token Exchange**
   - **Server Log**: Look for `[auth/apple] Processing Apple sign-in`
   - **Simulator Log**: Check for `[Apple Auth] Got credential from native sign-in`
   - **Network Tab**: POST to `/auth/apple` with 200 response
   - **Response Body**:
     ```json
     {
       "access_token": "eyJ...",
       "user": {
         "id": "user-xxx",
         "email": "user+email@privaterelay.appleid.com",
         "apple_id": "...",
         "display_name": "Apple User",
         "email_verified": true
       },
       "created": true,
       "needs_onboarding": false
     }
     ```

6. **Verify Token Storage**
   - Check secure storage (Expo SecureStore on mobile)
   - Token should not appear in device logs
   - DevTools should show auth token in app state

7. **Verify User Profile**
   - Navigate to profile screen
   - Verify user details match Apple Sign-In response
   - Verify `email_verified: true`
   - Note: Display name from Apple may be "Apple User" if not provided

### Expected Results

- ✅ User created with Apple ID
- ✅ Email verified automatically
- ✅ Face/Touch ID works (device) or simulator fallback works
- ✅ Token stored securely
- ✅ Profile reflects Apple account data
- ✅ No auth dialogs appear on subsequent launches

### Simulator Testing

For simulator testing without a real Apple ID:

1. **Mock Token Format**

   ```
   sim-<unique-identifier>
   Example: sim-test-user-1702416900000
   ```

2. **Expected Behavior**
   - Server accepts tokens starting with `sim-`
   - Extracted as development/test credentials
   - User created with mock data

3. **Enable Simulator Testing**
   - Set `APPLE_DEVELOPMENT_MODE=true` (if using env flag)
   - Or check for simulator in code: `Platform.OS === 'ios' && Constants.appOwnership !== 'expo'`

### Troubleshooting

| Issue                                          | Solution                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| "This app does not support Sign in with Apple" | Check APPLE_BUNDLE_ID in Xcode matches team ID configuration                            |
| Apple sheet doesn't appear                     | Verify `expo-apple-authentication` is installed and linked in native code               |
| "Invalid Apple credential"                     | Check private key is properly configured and not expired                                |
| Token verification fails on production         | Ensure production token verification endpoint is implemented (currently mocked for dev) |
| Simulator: "User canceled" error               | This is normal; code should handle gracefully                                           |

---

## Scenario 3: Account Linking - Same Email

### Description

Test linking Google and Apple IDs to single user account.

### Steps

1. **Create User with Email & Password**
   - Navigate to sign-up page
   - Sign up with email: `test@example.com` and password
   - Verify: User created, logged in, token stored

2. **Link Apple ID to Same Email**
   - Log out or open app in another window
   - Go to sign-up again
   - Click "Sign in with Apple"
   - On simulator: Use token `sim-link-test-user`
   - **Expected**: Should recognize email and link to existing user
   - **Response**: `"created": false` (not a new user)

3. **Verify Linking in Database**
   - Query database for user with email `test@example.com`
   - Should have both `apple_id` and password hash
   - Should NOT have `google_id` (unless linked separately)

4. **Test Multiple Sign-In Methods**
   - Sign out
   - Sign in with email/password → Success
   - Sign out
   - Sign in with Apple → Success
   - Both methods should access same user account

### Expected Results

- ✅ Both OAuth methods work with same email
- ✅ `created` flag is `false` on second method
- ✅ User ID remains same across methods
- ✅ User preferences preserved after linking

### Troubleshooting

| Issue                                   | Solution                                                             |
| --------------------------------------- | -------------------------------------------------------------------- |
| Creates new user instead of linking     | Check email matching is case-insensitive in code                     |
| Email from Apple doesn't match existing | Use exact same email during both sign-ups; Apple may use relay email |
| Account lock after linking              | Email verification should be `true` after first OAuth attempt        |

---

## Scenario 4: Onboarding Flow

### Description

Verify new users are directed to onboarding after first OAuth sign-in.

### Steps

1. **Sign In with New Google Account**
   - Use fresh Google account not previously signed in
   - Click "Sign in with Google"
   - Complete OAuth flow

2. **Verify Response Flags**
   - Check auth response: `"needs_onboarding": false` or `true`
   - Current implementation sets to `false` (may be updated)
   - If `true`: App should navigate to onboarding screen

3. **Verify User Preferences**
   - Query user in database
   - Check `preferences.onboarding_completed` value
   - New users: Should be `false`
   - After onboarding: Should be `true`

4. **Complete Onboarding Flow**
   - If directed to onboarding, complete all steps:
     - Set user role (fan, player, coach, etc.)
     - Add profile information
     - Accept terms
   - Verify: Call to `/me/complete-onboarding` endpoint
   - After completion: `onboarding_completed: true`

### Expected Results

- ✅ New users have `onboarding_completed: false`
- ✅ Onboarding screen shown to new users
- ✅ Existing users skip onboarding
- ✅ `onboarding_completed` flag updated after completion

---

## Scenario 5: Error Handling

### Description

Test error cases and recovery flows.

### Sub-Scenario 5a: Invalid Google Token

1. **Simulate Invalid Token**
   - Intercept request in DevTools
   - Change `id_token` value to invalid string
   - Send modified request

2. **Expected Response**: 401 Unauthorized

   ```json
   { "error": "Google authentication failed" }
   ```

3. **User Experience**
   - Error message displayed
   - User returned to sign-in screen
   - Can retry

### Sub-Scenario 5b: Network Error During OAuth

1. **Simulate Network Failure**
   - Open DevTools Network tab
   - Throttle to "Offline" mode
   - Click "Sign in with Google"

2. **Expected Behavior**
   - Initial OAuth opens in browser (may work if cached)
   - Token exchange fails with network error
   - Error message shown to user
   - Can retry when online

### Sub-Scenario 5c: Unverified Email (Google)

1. **Note**: Most Google accounts have verified emails
   - This test may require special Google test account
   - Backend checks `email_verified: true`

2. **Expected Response**: 400 Bad Request

   ```json
   { "error": "Google account email is not verified" }
   ```

3. **User Experience**
   - Error message displayed
   - User directed to verify email on Google account
   - Can retry after verification

### Sub-Scenario 5d: Missing Email (Apple)

1. **Simulator**: Apple returns null email for some test tokens
2. **Expected Behavior**:
   - Backend generates placeholder email: `apple_<id>@appleid.local`
   - User created successfully with generated email
   - User should update email during onboarding

### Expected Results

- ✅ Invalid credentials rejected with 401
- ✅ Network errors handled gracefully
- ✅ Unverified emails rejected with helpful message
- ✅ Missing emails get fallback generation
- ✅ Users can retry after errors

---

## Scenario 6: Multiple Devices

### Description

Test that same user account works across multiple devices.

### Steps

1. **Sign In on Device 1 (e.g., iOS)**
   - Sign in with Google
   - Note user ID in response
   - Verify profile on device

2. **Sign In on Device 2 (e.g., Android)**
   - Use same Google account
   - Expected: Receives same user ID
   - Check: `"created": false`

3. **Verify Shared Data**
   - Add data on Device 1 (e.g., favorite teams)
   - Refresh Device 2
   - Should see same data

4. **Update on One Device**
   - Change profile information on Device 1
   - Sign out and back in on Device 2
   - Changes should be visible

### Expected Results

- ✅ Same account ID on both devices
- ✅ User data synchronized across devices
- ✅ No duplicate accounts created
- ✅ Changes reflected in real-time or after refresh

---

## Scenario 7: Session Management

### Description

Test token expiration and session refresh.

### Steps

1. **Successful Sign-In**
   - Sign in with Google/Apple
   - Get access token
   - Token stored locally

2. **Access Protected Endpoint**
   - Call `/me` with stored token
   - Response: User data with 200 status

3. **With Expired Token** (requires token manipulation)
   - Manually modify stored token (change payload)
   - Call `/me` with modified token
   - Expected: 401 Unauthorized

4. **Logout**
   - Call logout endpoint or clear local token
   - Token removed from storage
   - Calling `/me` should return 401

5. **Sign Back In**
   - Use same Google/Apple account
   - Receive new token
   - Access protected endpoint succeeds

### Expected Results

- ✅ Valid token grants access to `/me`
- ✅ Invalid/expired token returns 401
- ✅ Logout clears token completely
- ✅ Can sign back in after logout

---

## Test Checklist - Before Production

- [ ] **Google Sign-In**
  - [ ] Web platform works
  - [ ] iOS works with correct client ID
  - [ ] Android works with correct client ID
  - [ ] Invalid tokens rejected
  - [ ] Unverified emails rejected
  - [ ] User created and linked correctly
  - [ ] Avatar downloaded if provided
  - [ ] Multiple sign-ins use same user

- [ ] **Apple Sign-In**
  - [ ] iOS simulator works with mock tokens
  - [ ] iOS device works with Face/Touch ID
  - [ ] Token exchange succeeds
  - [ ] User created with correct data
  - [ ] Multiple sign-ins use same user
  - [ ] Account linking works (if testing with email)
  - [ ] Production token verification implemented

- [ ] **Account Linking**
  - [ ] Email-based linking works
  - [ ] Multiple OAuth methods link to same account
  - [ ] Preferences preserved after linking
  - [ ] User ID consistent across methods

- [ ] **Onboarding**
  - [ ] New users flagged for onboarding
  - [ ] Onboarding completion tracked
  - [ ] Existing users skip onboarding
  - [ ] Role assignment works

- [ ] **Error Handling**
  - [ ] Invalid tokens rejected (401)
  - [ ] Network errors caught and shown
  - [ ] Missing data handled gracefully
  - [ ] Error messages user-friendly
  - [ ] Users can retry after errors

- [ ] **Security**
  - [ ] Tokens not exposed in logs
  - [ ] Tokens stored securely
  - [ ] Password hashes not revealed
  - [ ] Email verification enforced
  - [ ] CORS properly configured

- [ ] **Database**
  - [ ] No duplicate users created
  - [ ] All required fields set
  - [ ] Preferences initialized correctly
  - [ ] Email verification flags accurate

- [ ] **Performance**
  - [ ] Token exchange completes <500ms
  - [ ] No N+1 database queries
  - [ ] User lookup optimized
  - [ ] Concurrent sign-ins handled

---

## Running Automated Tests

Once E2E tests pass manually, run automated integration tests:

```bash
# Run all sign-in tests
npm test -- auth-signin.integration.test.ts

# Run specific test suite
npm test -- auth-signin.integration.test.ts -t "Google"

# Run with coverage
npm test -- auth-signin.integration.test.ts --coverage

# Watch mode (re-run on file changes)
npm test -- auth-signin.integration.test.ts --watch
```

---

## Debugging Guide

### Enable Debug Logging

Add to environment:

```bash
DEBUG=varsity:*
LOG_LEVEL=debug
```

### Check Server Logs

Look for patterns:

- `[auth/google]` - Google OAuth events
- `[auth/apple]` - Apple OAuth events
- `[Apple Auth]` - Client-side Apple auth
- `tokeninfo` - Token validation

### Browser DevTools

1. **Console**: Check for API errors
2. **Network**: Inspect `/auth/google` and `/auth/apple` requests
3. **Storage**: Verify token stored in localStorage/SecureStore
4. **Application**: Check cookies and session storage

### Mobile Logs

**iOS (Xcode)**:

```
Window → Devices and Simulators → Select Device → View Device Logs
```

**Android (adb)**:

```bash
adb logcat | grep -i "varsity\|auth\|apple\|google"
```

### Database Inspection

```sql
-- Check user created
SELECT id, email, google_id, apple_id, email_verified
FROM "User"
WHERE email = 'test@example.com';

-- Check preferences
SELECT id, preferences->'role', preferences->'onboarding_completed'
FROM "User"
WHERE id = 'user-xxx';

-- Check verification codes
SELECT id, email_verification_code, email_verification_expires
FROM "User"
WHERE email_verification_code IS NOT NULL;
```

---

## Success Criteria

All of the following must pass before considering sign-in complete:

✅ **Functionality**

- [ ] Google sign-in works on all platforms
- [ ] Apple sign-in works on iOS
- [ ] Account linking works
- [ ] Onboarding flow complete
- [ ] Token exchange working
- [ ] Error handling graceful

✅ **Security**

- [ ] Tokens validated correctly
- [ ] No credential leaks in logs
- [ ] Secure storage implemented
- [ ] CORS configured properly
- [ ] Email verification enforced

✅ **Quality**

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests completed
- [ ] Code reviewed
- [ ] No console errors
- [ ] Performance acceptable

✅ **Documentation**

- [ ] Configuration documented
- [ ] Troubleshooting guide complete
- [ ] Environment variables listed
- [ ] Deployment steps clear

---

## Next Steps After Passing Tests

1. **Production Configuration**
   - Update Google OAuth IDs to production
   - Update Apple config to production keys
   - Test on production-like environment

2. **Monitoring**
   - Set up alerts for auth failures
   - Monitor sign-in success rates
   - Track error frequencies

3. **Release**
   - Build for TestFlight (iOS)
   - Build for Play Store beta (Android)
   - Deploy server code
   - Monitor first week of signups

4. **Feedback Loop**
   - Collect user feedback on sign-in
   - Monitor error rates
   - Iterate on UX if needed
   - Plan follow-up features (social linking, etc.)
