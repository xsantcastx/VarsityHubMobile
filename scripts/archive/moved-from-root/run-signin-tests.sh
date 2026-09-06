#!/bin/bash
#
# Google & Apple Sign-In Test Runner
# Runs comprehensive integration tests for OAuth authentication
#

set -e

echo "════════════════════════════════════════════════════════════════"
echo "  Google & Apple Sign-In Integration Test Suite"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server"
TEST_TIMEOUT=30000
JEST_CONFIG="jest.config.js"

echo "${BLUE}📋 Test Configuration${NC}"
echo "├─ Backend Directory: $BACKEND_DIR"
echo "├─ Test Timeout: ${TEST_TIMEOUT}ms"
echo "└─ Jest Config: $JEST_CONFIG"
echo ""

# Step 1: Verify dependencies
echo "${BLUE}🔍 Checking Dependencies${NC}"
cd "$BACKEND_DIR"

if [ ! -f "package.json" ]; then
    echo "${RED}✗ package.json not found in $BACKEND_DIR${NC}"
    exit 1
fi

echo "✓ package.json found"

if ! command -v npm &> /dev/null; then
    echo "${RED}✗ npm not found${NC}"
    exit 1
fi

echo "✓ npm is available"
echo ""

# Step 2: Install dependencies if needed
echo "${BLUE}📦 Installing Dependencies${NC}"
npm install 2>&1 | tail -5
echo "✓ Dependencies installed"
echo ""

# Step 3: Check if test file exists
echo "${BLUE}📝 Locating Test Files${NC}"
if [ ! -f "tests/auth-signin.integration.test.ts" ]; then
    echo "${RED}✗ Test file not found: tests/auth-signin.integration.test.ts${NC}"
    exit 1
fi

echo "✓ Test file found: tests/auth-signin.integration.test.ts"
echo ""

# Step 4: Run type checking
echo "${BLUE}🔎 Running TypeScript Type Check${NC}"
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo "${YELLOW}⚠ Type check warnings (non-blocking):${NC}"
    npx tsc --noEmit 2>&1 | head -20
else
    echo "✓ Type check passed"
fi
echo ""

# Step 5: Run the tests
echo "${BLUE}🧪 Running Tests${NC}"
echo "────────────────────────────────────────────────────────────────"

npx jest tests/auth-signin.integration.test.ts \
    --testTimeout=$TEST_TIMEOUT \
    --verbose \
    --coverage=false \
    --forceExit 2>&1 | tee test-output.log

TEST_EXIT_CODE=${PIPESTATUS[0]}

echo "────────────────────────────────────────────────────────────────"
echo ""

# Step 6: Parse and display results
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "${GREEN}✅ ALL TESTS PASSED${NC}"
    echo ""
    echo "Summary:"
    grep -E "Tests:|Snapshots:|Syntax errors:" test-output.log | head -3
    echo ""
else
    echo "${RED}❌ TESTS FAILED${NC}"
    echo ""
    echo "Please review the test output above for details."
    echo ""
fi

# Step 7: Cleanup
rm -f test-output.log

echo "════════════════════════════════════════════════════════════════"
echo ""

exit $TEST_EXIT_CODE
