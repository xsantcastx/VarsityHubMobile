# Google & Apple Sign-In - Complete Testing & Implementation Guide

## Overview

This guide provides everything needed to test Google and Apple sign-in authentication flows. The testing approach uses:

1. **Mock Tests** - Run without a backend server (fast, lightweight)
2. **Integration Tests** - Test full auth endpoints with mocked Prisma
3. **E2E Tests** - Manual testing on iOS, Android, Web platforms
4. **Configuration Validation** - Verify all setup is correct

---

## Quick Start - Run Tests Now

### Step 1: Run Mock Tests (Fastest)

```bash
# Navigate to backend
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server

# Run mock tests (no dependencies needed)
npm test -- tests/auth-signin.mock.test.ts

# Expected output: All tests should pass ✓
```

**What it tests:**
- Google sign-in logic (create user, link account, validate token)
- Apple sign-in logic (simulator tokens, account linking)
- Error handling (invalid tokens, missing data)
- Database consistency (email verification, preferences)

**Time to complete:** ~5-10 seconds

---

### Step 2: Validate Configuration

```bash
# Make script executable
chmod +x /Users/varsityhub/Desktop/CODE/VarsityHubMobile/validate-signin-config.sh

# Run validator
./validate-signin-config.sh
```

**What it checks:**
- ✓ All required files present
- ✓ Environment variables configured
- ✓ Frontend code implements both sign-in methods
- ✓ Backend endpoints exist
- ✓ Database schema includes google_id and apple_id
- ✓ Dependencies installed

**Expected output:**
```
Results:
  ✓ Passed: 25+
  ⚠ Warnings: 0-3 (optional configs)
  ✗ Failed: 0

✅ All critical checks passed!
```

---

### Step 3: Integration Tests (Optional - Requires Running Server)

```bash
# Start server
cd server
npm run dev

# In another terminal, run integration tests
npm test -- tests/auth-signin.integration.test.ts --testTimeout=30000

# Expected: All tests pass after token exchange succeeds
```

---

## Detailed Test Scenarios

### Scenario 1: Google Sign-In (Web)

**Test Files:**
- `server/tests/auth-signin.mock.test.ts` - Mock test
- `server/tests/auth-signin.integration.test.ts` - Full integration test
- `E2E_SIGNIN_TEST_SCENARIOS.md` - Manual E2E steps

**What happens:**
1. User clicks "Sign in with Google"
2. Browser opens Google login dialog
3. User authenticates with Google
4. App receives ID token
5. Backend validates token with Google API
6. User created or linked in database
7. JWT token issued for app use

**Test Commands:**
```bash
# Test Google logic only
npm test -- auth-signin.mock.test.ts -t "Google Sign-In Logic"

# Test full integration
npm test -- auth-signin.integration.test.ts -t "POST /auth/google"

# Test error cases
npm test -- auth-signin.mock.test.ts -t "reject"
```

**Expected Test Results:**
```
✓ should create user with valid token
✓ should reject empty email
✓ should reject unverified email
✓ should reject invalid token
✓ should reuse existing user on second sign-in
✓ should link to existing user by email
✓ should enforce audience validation
```

---

### Scenario 2: Apple Sign-In (iOS)

**Test Files:**
- `server/tests/auth-signin.mock.test.ts` - Mock test
- `server/tests/auth-signin.integration.test.ts` - Full integration test
- `E2E_SIGNIN_TEST_SCENARIOS.md` - Manual E2E steps (Scenario 2)

**What happens:**
1. User taps "Sign in with Apple"
2. Apple Sheet appears (Face/Touch ID on device, auto-approval in simulator)
3. App receives identity_token
4. Backend validates token (simulator tokens start with 'sim-')
5. User created or linked in database
6. JWT token issued for app use

**Test Commands:**
```bash
# Test Apple logic only
npm test -- auth-signin.mock.test.ts -t "Apple Sign-In Logic"

# Test full integration
npm test -- auth-signin.integration.test.ts -t "POST /auth/apple"

# Test simulator token handling
npm test -- auth-signin.mock.test.ts -t "simulator"
```

**Expected Test Results:**
```
✓ should create user with valid simulator token
✓ should reject empty token
✓ should reuse existing user on second sign-in
✓ should link to existing user by email
✓ should create user with generated email if not provided
```

---

### Scenario 3: Account Linking

**What it tests:** Multiple OAuth methods (Google + Apple) on same email

**Test Steps:**
1. Create user with email `test@example.com`
2. Link Apple ID via sign-in
3. Link Google ID via separate sign-in
4. Same user account handles both methods

**Test Command:**
```bash
# Test account linking
npm test -- auth-signin.mock.test.ts -t "Linking"

# Test cross-OAuth linking
npm test -- auth-signin.mock.test.ts -t "Cross OAuth"
```

**Expected Results:**
```
✓ should link to existing user by email
✓ should allow both Google and Apple on same user
✓ Email-based linking preserves existing preferences
```

---

## Complete Test Checklist

Run through all of these to ensure sign-in is production-ready:

### Unit & Mock Tests
- [ ] `npm test -- auth-signin.mock.test.ts` (All pass - ~10 seconds)

### Configuration Checks
- [ ] `./validate-signin-config.sh` (No critical failures)

### Code Review
- [ ] ✓ `hooks/useGoogleAuth.ts` - Google OAuth hook
- [ ] ✓ `hooks/useAppleAuth.ts` - Apple Sign-In hook
- [ ] ✓ `server/src/routes/auth.ts` - Backend endpoints
- [ ] ✓ `api/auth.ts` - API client methods

### Environment Configuration
- [ ] `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` set
- [ ] `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` set
- [ ] `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` set
- [ ] `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` set
- [ ] `APPLE_TEAM_ID` set (if using production)
- [ ] `APPLE_KEY_ID` set (if using production)
- [ ] `APPLE_BUNDLE_ID` set (if using production)

### Database
- [ ] [ ] Run `npx prisma migrate deploy` (apple_id column added)
- [ ] [ ] Verify schema has `google_id` field (String, UNIQUE, nullable)
- [ ] [ ] Verify schema has `apple_id` field (String, UNIQUE, nullable)

### Integration Tests (Requires Running Server)
- [ ] Start server: `npm run dev` (in server directory)
- [ ] Run tests: `npm test -- auth-signin.integration.test.ts`
- [ ] All tests pass

### Manual E2E Tests

**On Web:**
- [ ] Load `/sign-up` page
- [ ] Click "Sign in with Google"
- [ ] Complete Google auth flow
- [ ] User created/verified in database
- [ ] Logged in state reflected in app

**On iOS Simulator:**
- [ ] Load app with iOS simulator
- [ ] Navigate to sign-up
- [ ] Click "Sign in with Apple"
- [ ] Apple sheet appears and auto-completes
- [ ] Check server logs for `[auth/apple] Processing Apple sign-in`
- [ ] User created with apple_id
- [ ] Can access protected endpoints with token

**On Physical iOS Device:**
- [ ] Build with EAS or Xcode
- [ ] Install on device
- [ ] Sign in with Apple using Face/Touch ID
- [ ] User created with apple_id
- [ ] All functionality works

**On Android:**
- [ ] Build and deploy to device/emulator
- [ ] Sign in with Google (platform-specific flow)
- [ ] User created with google_id
- [ ] Token exchange successful

---

## Running All Tests Automatically

```bash
# From project root
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Step 1: Validate config (no dependencies)
echo "Running configuration validator..."
chmod +x validate-signin-config.sh
./validate-signin-config.sh

# Step 2: Run mock tests (5-10 seconds)
echo -e "\nRunning mock tests..."
cd server
npm test -- tests/auth-signin.mock.test.ts --no-coverage

# Step 3: Optional - run integration tests (requires server)
# npm test -- tests/auth-signin.integration.test.ts --testTimeout=30000

echo -e "\n✅ All automated tests completed!"
```

---

## Test Results Interpretation

### All Tests Pass ✅
```
PASS  tests/auth-signin.mock.test.ts
  Google Sign-In Logic
    ✓ should create user with valid token
    ✓ should reject empty email
    ...
  Apple Sign-In Logic
    ✓ should create user with valid simulator token
    ...

Test Suites: 1 passed, 1 total
Tests:       42 passed, 42 total
```

**Meaning:** OAuth logic is correct, ready for integration testing

---

### Some Tests Fail ❌

**Common Failures:**

1. **"Firebase not configured"**
   - Usually not needed for Google OAuth in backend
   - Verify `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` environment variable

2. **"Prisma not initialized"**
   - Run `npm install` in server directory
   - Ensure `.env` points to valid database

3. **"Apple authentication not available"**
   - Expected on non-iOS platforms
   - Code should handle gracefully with simulator fallback

4. **"User creation failed"**
   - Check database connection
   - Verify `apple_id` and `google_id` columns exist in schema
   - Run `npx prisma migrate deploy`

---

## Debugging Failed Tests

### Enable Verbose Output
```bash
npm test -- tests/auth-signin.mock.test.ts --verbose
```

### Run Single Test
```bash
npm test -- tests/auth-signin.mock.test.ts -t "Google.*email"
```

### Check Server Logs
```bash
# From server directory
npm run dev 2>&1 | grep -E "\[auth|token|google|apple"
```

### Inspect Token Format
Add to test:
```typescript
console.log('ID Token payload:', payload);
console.log('Token format valid:', payload.sub && payload.email);
```

---

## Next Steps After Tests Pass

### 1. Get Production Credentials

**Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web, iOS, Android)
3. Add production client IDs to `.env.production`
4. Update `GOOGLE_ALLOWED_AUDIENCES` env variable

**Apple Sign-In:**
1. Go to [Apple Developer](https://developer.apple.com)
2. Download private key (AuthKey_XXXXXXXXXX.p8)
3. Note Key ID and Team ID
4. Set environment variables:
   ```bash
   APPLE_KEY_ID=XXXXXXXXXX
   APPLE_TEAM_ID=XXXXXXXXXX
   APPLE_KEY_FILE=/path/to/AuthKey_XXXXXXXXXX.p8
   ```

### 2. Test on Real Devices

- [ ] iOS device with real Apple Sign-In (Face/Touch ID)
- [ ] Android device with Google sign-in
- [ ] Test account linking between both methods
- [ ] Verify all data syncs correctly

### 3. Monitor Production

```bash
# Check auth success rate
tail -f logs/server.log | grep -E "\[auth/(google|apple)\]"

# Monitor failed auth attempts
grep "authentication failed" logs/server.log | wc -l
```

### 4. Performance Benchmarks

Expected performance:
- Token validation: < 500ms
- User creation: < 200ms
- Total sign-in flow: < 1 second
- Concurrent sign-ins: Handle 100+ simultaneously

---

## Security Checklist

Before going to production:

- [ ] Tokens never logged
- [ ] Passwords never logged
- [ ] Private keys not in version control
- [ ] Environment variables used for all secrets
- [ ] HTTPS enforced for all OAuth redirects
- [ ] Email verification required
- [ ] Token expiration implemented
- [ ] Rate limiting on auth endpoints
- [ ] CSRF protection enabled
- [ ] CORS properly configured

---

## Support & Troubleshooting

### Test Won't Run
1. Check Node.js version: `node --version` (should be 16+)
2. Install dependencies: `npm install`
3. Check Jest config: `jest.config.js` exists in server directory

### Token Validation Fails
1. Google: Verify `GOOGLE_ALLOWED_AUDIENCES` matches token `aud` field
2. Apple: Check private key file path in `APPLE_KEY_FILE` env var
3. Both: Ensure backend can reach OAuth provider APIs

### User Not Created
1. Verify database connection in `.env`
2. Check schema migration: `npx prisma migrate status`
3. Ensure `google_id` and `apple_id` columns exist: `npx prisma studio`

### Token Exchange Returns 401
1. Check server logs for detailed error
2. Validate token format (should be valid JWT)
3. Verify authentication endpoint URL matches

---

## Files Created for Testing

```
/Users/varsityhub/Desktop/CODE/VarsityHubMobile/
├── server/tests/
│   ├── auth-signin.mock.test.ts         # Mock tests (no server)
│   └── auth-signin.integration.test.ts  # Integration tests (requires server)
├── E2E_SIGNIN_TEST_SCENARIOS.md          # Manual test procedures
├── TESTING_IMPLEMENTATION_GUIDE.md       # This file
├── validate-signin-config.sh             # Configuration validator
├── run-signin-tests.sh                   # Test runner script
└── SIGNIN_FIX_GUIDE.md                   # Configuration instructions
```

---

## Summary

✅ **Ready to Test:**
- Mock tests verify all logic without dependencies
- Configuration validator checks setup
- Integration tests verify endpoints work
- E2E scenarios provide manual test steps
- All tests can run in ~30 seconds

✅ **Testing Path:**
1. Run mock tests (fastest)
2. Validate config
3. Run integration tests (optional)
4. Perform manual E2E tests
5. Test on real devices
6. Deploy to production

**All tests passing = Production ready!**
