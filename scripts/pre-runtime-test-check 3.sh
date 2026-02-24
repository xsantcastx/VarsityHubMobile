#!/bin/bash

##############################################################################
# VarsityHub Mobile - Pre-Runtime Test Setup Script
#
# Purpose: Verify all dependencies and configuration before running
#          the 3 critical production tests in actual Expo environment
#
# Usage: bash scripts/pre-runtime-test-check.sh
##############################################################################

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║       VarsityHub Mobile - Pre-Runtime Test Setup Verification                ║"
echo "║                                                                              ║"
echo "║         Checking all dependencies before executing actual Expo tests         ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to print status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        ((CHECKS_FAILED++))
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "🔍 CHECKING PREREQUISITES"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check 1: Node.js version
echo -n "Checking Node.js version (need v18+)... "
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 18 ]; then
    check_status 0 "Node.js v$(node --version | cut -d'v' -f2)"
else
    check_status 1 "Node.js $(node --version) - Need v18+"
fi

# Check 2: npm is available
echo -n "Checking npm... "
if command -v npm &> /dev/null; then
    check_status 0 "npm $(npm --version)"
else
    check_status 1 "npm not found"
fi

# Check 3: Expo CLI
echo -n "Checking Expo CLI... "
if npm list expo 2>/dev/null | grep -q "expo"; then
    EXPO_VERSION=$(npm list expo 2>/dev/null | grep "expo" | head -1 | awk '{print $2}')
    check_status 0 "Expo $EXPO_VERSION installed"
else
    check_status 1 "Expo not installed. Run: npm install"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "📁 CHECKING PROJECT FILES"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check 4: package.json exists
echo -n "Checking package.json... "
if [ -f "package.json" ]; then
    check_status 0 "package.json found"
else
    check_status 1 "package.json not found"
fi

# Check 5: app.json exists
echo -n "Checking app.json... "
if [ -f "app.json" ]; then
    check_status 0 "app.json found"
else
    check_status 1 "app.json not found"
fi

# Check 6: .env exists
echo -n "Checking .env configuration... "
if [ -f ".env" ]; then
    check_status 0 ".env found"
else
    check_status 1 ".env not found"
fi

# Check 7: Critical source files
echo -n "Checking app/verify.tsx (Test 1)... "
if [ -f "app/verify.tsx" ]; then
    check_status 0 "app/verify.tsx found"
else
    check_status 1 "app/verify.tsx not found"
fi

echo -n "Checking hooks/useGoogleAuth.ts (Test 3)... "
if [ -f "hooks/useGoogleAuth.ts" ]; then
    check_status 0 "hooks/useGoogleAuth.ts found"
else
    check_status 1 "hooks/useGoogleAuth.ts not found"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "🔐 CHECKING ENVIRONMENT VARIABLES"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check 8: Google client IDs
echo -n "Checking EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID... "
if grep -q "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" .env; then
    ANDROID_ID=$(grep "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" .env | cut -d'=' -f2 | tr -d '"')
    if [ -n "$ANDROID_ID" ] && [ "$ANDROID_ID" != "your_android_client_id" ]; then
        check_status 0 "Android client ID configured"
    else
        check_status 1 "Android client ID not set or invalid"
    fi
else
    check_status 1 "Android client ID not found in .env"
fi

echo -n "Checking EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID... "
if grep -q "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" .env; then
    IOS_ID=$(grep "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" .env | cut -d'=' -f2 | tr -d '"')
    if [ -n "$IOS_ID" ] && [ "$IOS_ID" != "your_ios_client_id" ]; then
        check_status 0 "iOS client ID configured"
    else
        check_status 1 "iOS client ID not set or invalid"
    fi
else
    check_status 1 "iOS client ID not found in .env"
fi

echo -n "Checking EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID... "
if grep -q "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" .env; then
    WEB_ID=$(grep "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" .env | cut -d'=' -f2 | tr -d '"')
    if [ -n "$WEB_ID" ] && [ "$WEB_ID" != "your_web_client_id" ]; then
        check_status 0 "Web client ID configured"
    else
        check_status 1 "Web client ID not set or invalid"
    fi
else
    check_status 1 "Web client ID not found in .env"
fi

echo -n "Checking EXPO_PUBLIC_API_URL... "
if grep -q "EXPO_PUBLIC_API_URL" .env; then
    API_URL=$(grep "EXPO_PUBLIC_API_URL" .env | cut -d'=' -f2)
    check_status 0 "API URL: $API_URL"
else
    check_status 1 "API URL not found in .env"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "🔌 CHECKING PORTS"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check 9: Port 4000 (backend)
echo -n "Checking if port 4000 (backend) is available... "
if ! lsof -Pi :4000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    check_status 0 "Port 4000 available"
else
    check_status 1 "Port 4000 in use (backend might already be running)"
fi

# Check 10: Port 8081 (Metro)
echo -n "Checking if port 8081 (Metro) is available... "
if ! lsof -Pi :8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
    check_status 0 "Port 8081 available"
else
    check_status 1 "Port 8081 in use (Expo might already be running)"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "🔍 CHECKING CODE IMPLEMENTATIONS"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Check 11: Email routing logic
echo -n "Checking email routing logic in app/verify.tsx... "
if grep -q "step-3-plan\|step-2-basic" app/verify.tsx; then
    check_status 0 "Email routing logic found"
else
    check_status 1 "Email routing logic not found"
fi

# Check 12: Dev code gate
echo -n "Checking dev code security gate (__DEV__)... "
if grep -q "__DEV__" app/verify.tsx; then
    check_status 0 "Dev security gate found"
else
    check_status 1 "Dev security gate not found"
fi

# Check 13: Platform detection
echo -n "Checking Google platform detection logic... "
if grep -q "Platform.OS.*android\|Platform.OS.*ios\|Platform.OS.*web" hooks/useGoogleAuth.ts; then
    check_status 0 "Platform detection logic found"
else
    check_status 1 "Platform detection logic not found"
fi

# Check 14: Error handling
echo -n "Checking error handling implementation... "
if grep -q "catch" hooks/useGoogleAuth.ts && grep -q "setError" app/verify.tsx; then
    check_status 0 "Error handling found"
else
    check_status 1 "Error handling not found"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo "📊 SUMMARY"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL=$((CHECKS_PASSED + CHECKS_FAILED))
PASS_PERCENT=$((CHECKS_PASSED * 100 / TOTAL))

echo "Checks Passed: $CHECKS_PASSED/$TOTAL"
echo "Checks Failed: $CHECKS_FAILED/$TOTAL"
echo "Pass Rate: $PASS_PERCENT%"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo ""
    echo "You are ready to run the runtime tests! 🚀"
    echo ""
    echo "Next steps:"
    echo "  1. Read RUNTIME_TEST_GUIDE.md"
    echo "  2. In Terminal 1: npm run server:dev"
    echo "  3. In Terminal 2: npm run dev:expo"
    echo "  4. Follow the test guide for Test 1, 2, and 3"
    echo ""
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please fix the failures above before running tests."
    echo ""
    echo "Common fixes:"
    echo "  - Node.js: Install from https://nodejs.org/"
    echo "  - Dependencies: npm install"
    echo "  - .env: Copy .env.example to .env and fill in values"
    echo "  - Ports: Kill processes using 4000 or 8081"
    echo ""
    exit 1
fi
