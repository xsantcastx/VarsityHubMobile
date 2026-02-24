#!/bin/bash
# Real-World Login Flow Test Script
# Tests critical login scenarios to ensure app can handle real users

set -e

echo "🧪 Real-World Login Flow Test"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test account credentials (update these)
TEST_EMAIL="test@example.com"
TEST_PASSWORD="TestPassword123!"
TEST_GOOGLE_EMAIL="test@gmail.com"

# API base URL
API_URL="${EXPO_PUBLIC_API_URL:-https://api-production-8ac3.up.railway.app}"

echo "📋 Test Checklist:"
echo ""

# Test 1: Health Check
echo "1. Testing backend health..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" || echo "000")
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "   ${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "   ${RED}❌ Backend is down (HTTP $HEALTH_RESPONSE)${NC}"
    echo "   ⚠️  Cannot proceed with login tests"
    exit 1
fi

# Test 2: Login endpoint exists
echo "2. Testing login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"invalid@test.com","password":"wrong"}' \
    -w "%{http_code}" -o /dev/null || echo "000")
if [ "$LOGIN_RESPONSE" = "401" ] || [ "$LOGIN_RESPONSE" = "400" ]; then
    echo -e "   ${GREEN}✅ Login endpoint responds (HTTP $LOGIN_RESPONSE)${NC}"
else
    echo -e "   ${RED}❌ Login endpoint issue (HTTP $LOGIN_RESPONSE)${NC}"
fi

# Test 3: Rate limiting
echo "3. Testing rate limiting..."
RATE_LIMIT_HIT=false
for i in {1..10}; do
    RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrong"}' \
        -w "%{http_code}" -o /dev/null || echo "000")
    if [ "$RESPONSE" = "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
done
if [ "$RATE_LIMIT_HIT" = true ]; then
    echo -e "   ${GREEN}✅ Rate limiting works${NC}"
else
    echo -e "   ${YELLOW}⚠️  Rate limiting may not be active${NC}"
fi

# Test 4: Token validation
echo "4. Testing token validation..."
# Try to access /me without token
ME_RESPONSE=$(curl -s -X GET "${API_URL}/auth/me" \
    -w "%{http_code}" -o /dev/null || echo "000")
if [ "$ME_RESPONSE" = "401" ]; then
    echo -e "   ${GREEN}✅ Token validation works (401 for no token)${NC}"
else
    echo -e "   ${RED}❌ Token validation issue (HTTP $ME_RESPONSE)${NC}"
fi

echo ""
echo "📱 Manual Testing Required:"
echo ""
echo "Run these tests in the app:"
echo ""
echo "1. ${YELLOW}Fresh Install Test${NC}"
echo "   - Clear app data"
echo "   - Open app"
echo "   - Verify: Shows sign-in screen (not blank/crash)"
echo ""
echo "2. ${YELLOW}Email Login - Success${NC}"
echo "   - Enter valid credentials"
echo "   - Click Sign In"
echo "   - Verify: Redirects to feed/onboarding"
echo ""
echo "3. ${YELLOW}Email Login - Wrong Password${NC}"
echo "   - Enter wrong password"
echo "   - Verify: Shows error, stays on sign-in"
echo ""
echo "4. ${YELLOW}Token Persistence${NC}"
echo "   - Login successfully"
echo "   - Force close app"
echo "   - Reopen app"
echo "   - Verify: Auto-logs in (no sign-in screen)"
echo ""
echo "5. ${YELLOW}Network Failure${NC}"
echo "   - Turn off WiFi"
echo "   - Try to login"
echo "   - Verify: Shows network error"
echo "   - Turn WiFi back on"
echo "   - Try again"
echo "   - Verify: Login succeeds"
echo ""
echo "6. ${YELLOW}Google Sign-In${NC}"
echo "   - Click Google button"
echo "   - Complete OAuth"
echo "   - Verify: Redirects correctly"
echo ""
echo "7. ${YELLOW}Apple Sign-In (iOS only)${NC}"
echo "   - Click Apple button"
echo "   - Complete auth"
echo "   - Verify: Redirects correctly"
echo ""

echo "🔍 Common Login Issues to Check:"
echo ""
echo "❌ 'Invalid login response' → Backend not returning access_token"
echo "❌ Stuck on loading → checkAuth() not completing"
echo "❌ Redirect loops → AuthProvider routing logic issue"
echo "❌ Token not saved → SecureStore/localStorage issue"
echo "❌ Auto-login fails → Token not loading on app start"
echo ""

echo "✅ Test Complete!"
echo ""
echo "If all manual tests pass, your login system is ready for real users."
