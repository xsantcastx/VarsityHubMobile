#!/bin/bash
# Quick Login Test - Run this to test if login works
# This simulates real-world login scenarios

echo "🧪 Quick Login Test"
echo "==================="
echo ""
echo "This test will check if your login system can handle real users."
echo ""

# Test 1: Check if backend is reachable
echo "1️⃣  Testing backend connectivity..."
API_URL="${EXPO_PUBLIC_API_URL:-https://api-production-8ac3.up.railway.app}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")

if [ "$HEALTH" = "200" ]; then
    echo "   ✅ Backend is online"
else
    echo "   ❌ Backend is offline (HTTP $HEALTH)"
    echo "   ⚠️  Cannot test login - backend must be running"
    exit 1
fi

# Test 2: Check login endpoint
echo ""
echo "2️⃣  Testing login endpoint..."
LOGIN_TEST=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@invalid.com","password":"wrong"}' \
    -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")

if [ "$LOGIN_TEST" = "401" ] || [ "$LOGIN_TEST" = "400" ]; then
    echo "   ✅ Login endpoint is working (rejected invalid credentials)"
else
    echo "   ⚠️  Login endpoint returned HTTP $LOGIN_TEST (expected 401 or 400)"
fi

# Test 3: Check token validation
echo ""
echo "3️⃣  Testing token validation..."
ME_TEST=$(curl -s -X GET "${API_URL}/auth/me" \
    -w "%{http_code}" -o /dev/null 2>/dev/null || echo "000")

if [ "$ME_TEST" = "401" ]; then
    echo "   ✅ Token validation works (401 for no token)"
else
    echo "   ⚠️  Token validation returned HTTP $ME_TEST (expected 401)"
fi

echo ""
echo "📱 Manual Test Checklist:"
echo ""
echo "Run these in your app (in order):"
echo ""
echo "✅ TEST 1: Fresh Install"
echo "   1. Clear app data (Settings → Delete App)"
echo "   2. Reinstall app"
echo "   3. Open app"
echo "   4. ✅ Should show sign-in screen (not blank/crash)"
echo ""
echo "✅ TEST 2: Email Login - Success"
echo "   1. Enter valid email/password"
echo "   2. Click 'Sign In'"
echo "   3. ✅ Should redirect to feed (if onboarded) or onboarding"
echo "   4. ✅ Should NOT show 'Invalid login response' error"
echo ""
echo "✅ TEST 3: Email Login - Wrong Password"
echo "   1. Enter correct email, wrong password"
echo "   2. Click 'Sign In'"
echo "   3. ✅ Should show error message"
echo "   4. ✅ Should stay on sign-in screen"
echo ""
echo "✅ TEST 4: Token Persistence"
echo "   1. Login successfully"
echo "   2. Force close app (swipe up, close)"
echo "   3. Reopen app"
echo "   4. ✅ Should auto-login (goes to feed, NOT sign-in screen)"
echo ""
echo "✅ TEST 5: Network Failure"
echo "   1. Turn off WiFi/cellular"
echo "   2. Try to login"
echo "   3. ✅ Should show network error (not crash)"
echo "   4. Turn WiFi back on"
echo "   5. Try login again"
echo "   6. ✅ Should work now"
echo ""
echo "✅ TEST 6: Google Sign-In"
echo "   1. Click 'Continue with Google'"
echo "   2. Complete Google OAuth"
echo "   3. ✅ Should redirect to feed/onboarding"
echo "   4. ✅ Should NOT show 'Failed to retrieve email' error"
echo ""
echo "✅ TEST 7: Apple Sign-In (iOS only)"
echo "   1. Click Apple sign-in button"
echo "   2. Complete Apple auth"
echo "   3. ✅ Should redirect correctly"
echo ""
echo "🚨 RED FLAGS (If you see these, FIX before release):"
echo ""
echo "   ❌ 'Invalid login response' → Backend not returning access_token"
echo "   ❌ Stuck on loading screen → checkAuth() never completes"
echo "   ❌ Redirect loops → AuthProvider routing broken"
echo "   ❌ Token lost on restart → Storage not working"
echo "   ❌ App crashes on login → Unhandled errors"
echo ""
echo "✅ If all tests pass, your login is ready for real users!"
