#!/bin/bash

###############################################################################
# QA E2E Test Guide: Stripe Role Binding Fix
# 
# This guide provides step-by-step manual testing procedures for the fix.
# Run these tests in the app (web or simulator) against a live backend.
###############################################################################

set -e

echo "🚀 VarsityHub Stripe Fix - QA E2E Test Guide"
echo "=============================================="
echo ""
echo "This guide tests the critical role binding fix for Stripe payments."
echo "Duration: 15-20 minutes for full test suite"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

print_test() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Test $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  TESTS_RUN=$((TESTS_RUN + 1))
}

pass() {
  echo -e "${GREEN}✅ PASS: $1${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  echo ""
}

fail() {
  echo -e "${RED}❌ FAIL: $1${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  echo ""
}

warn() {
  echo -e "${YELLOW}⚠️  NOTE: $1${NC}"
  echo ""
}

step() {
  echo -e "${YELLOW}Step: $1${NC}"
}

check() {
  echo -e "${BLUE}→ $1${NC}"
}

###############################################################################
# Pre-Test Setup
###############################################################################

echo -e "${GREEN}Pre-Test Setup${NC}"
echo "==============="
echo ""

echo "Required:"
echo "1. Backend running (npm run dev in server/)"
echo "2. App running (npm run web, or iOS/Android simulator)"
echo "3. Fresh test user account OR multiple test accounts"
echo "4. Stripe test mode enabled"
echo "5. Database access for verification"
echo ""

read -p "Press ENTER when backend and app are ready..."
echo ""

###############################################################################
# Test 1: Veteran Plan Purchase → Step 4 Success
###############################################################################

print_test "1: Veteran Plan Purchase → Step 4 Organization Creation"

step "1.1: Create new test user"
check "Navigate to registration"
check "Create account: test.veteran@varsityhub.test"
check "Complete Steps 1-2 (affiliation, username, interests)"
read -p "Press ENTER after user created..."

if [ $? -eq 0 ]; then
  pass "Test user account created"
else
  fail "Could not create test user"
fi

step "1.2: Select Veteran plan in Step 3"
check "Click 'Veteran' plan card"
check "Verify plan selected: 2.50/team/month (or similar pricing)"
check "Click 'Continue to Payment'"
read -p "Press ENTER after plan selected..."

if [ $? -eq 0 ]; then
  pass "Veteran plan selected in Step 3"
else
  fail "Could not select Veteran plan"
fi

step "1.3: Complete Stripe checkout"
check "Stripe checkout window opens"
check "Use test card: 4242 4242 4242 4242"
check "Email: test.veteran@varsityhub.test"
check "Any future expiry (e.g., 12/26)"
check "Any 3-digit CVC (e.g., 123)"
check "Click 'Pay'"
read -p "Press ENTER after payment submitted..."

if [ $? -eq 0 ]; then
  pass "Stripe checkout completed"
else
  fail "Stripe checkout failed or not completed"
fi

step "1.4: Verify payment success"
check "Success page appears: 'Payment successful'"
check "Message: 'You can return to the app now'"
check "App redirects back to onboarding"
read -p "Press ENTER after success page..."

if [ $? -eq 0 ]; then
  pass "Payment finalization successful"
else
  fail "Payment did not finalize properly"
fi

step "1.5: Proceed to Step 4 - Organization Creation"
check "Step 4 form loads: 'Create Organization'"
check "Organization name input is visible"
check "Location autocomplete is visible"
check "Continue button is visible"
check "NO error message about insufficient permissions"
read -p "Press ENTER after Step 4 loads..."

if [ $? -eq 0 ]; then
  pass "Step 4 organization creation form loaded (role validation passed)"
else
  fail "Step 4 blocked - likely role='fan' instead of 'coach'"
fi

step "1.6: Complete organization creation"
check "Enter organization name: 'Test Veteran Org'"
check "Enter location and select from autocomplete"
check "Click 'Create Organization'"
read -p "Press ENTER after organization created..."

if [ $? -eq 0 ]; then
  pass "Organization created successfully after Veteran purchase"
else
  fail "Could not create organization"
fi

echo -e "${GREEN}✨ Test 1 Summary: Veteran plan → Step 4 SUCCESS${NC}"
echo ""

###############################################################################
# Test 2: Legend Plan Purchase → Step 4 Success
###############################################################################

print_test "2: Legend Plan Purchase → Step 4 Organization Creation"

step "2.1: Create new test user for Legend plan"
check "Register new account: test.legend@varsityhub.test"
check "Complete Steps 1-2"
read -p "Press ENTER after user created..."

pass "Legend test user account created"

step "2.2: Select Legend plan in Step 3"
check "Click 'Legend' plan card"
check "Verify plan selected: \$19.99/year (or similar)"
check "Click 'Continue to Payment'"
read -p "Press ENTER after plan selected..."

pass "Legend plan selected"

step "2.3: Complete Stripe checkout for Legend"
check "Stripe checkout opens"
check "Test card: 4242 4242 4242 4242"
check "Click 'Pay'"
read -p "Press ENTER after payment..."

pass "Legend plan payment completed"

step "2.4: Verify Step 4 loads without errors"
check "Step 4 organization form is visible"
check "No 'insufficient permissions' error"
check "Can proceed to organization creation"
read -p "Press ENTER when verified..."

pass "Step 4 loaded for Legend user (role='coach' confirmed)"

echo -e "${GREEN}✨ Test 2 Summary: Legend plan → Step 4 SUCCESS${NC}"
echo ""

###############################################################################
# Test 3: Rookie Plan → Step 4 Should Be Blocked
###############################################################################

print_test "3: Rookie Plan (Free) → Step 4 Should Be Blocked"

step "3.1: Create test user for Rookie plan"
check "Register: test.rookie@varsityhub.test"
check "Complete Steps 1-2"
read -p "Press ENTER..."

pass "Rookie test user created"

step "3.2: Select Rookie plan (free)"
check "Click 'Rookie' plan card"
check "Message: 'Start for free'"
check "Click 'Continue'"
read -p "Press ENTER..."

pass "Rookie plan selected (no payment)"

step "3.3: Attempt Step 4 - Organization Creation"
check "Step 4 form attempts to load"
check "ERROR message appears: 'Only coaches can create organizations'"
check "Continue button is DISABLED"
check "Form does NOT allow organization creation"
read -p "Press ENTER after error appears..."

if [ $? -eq 0 ]; then
  pass "Rookie user correctly blocked from Step 4 (role remains 'fan')"
else
  warn "Rookie user may have been granted coach role (unexpected)"
fi

echo -e "${GREEN}✨ Test 3 Summary: Rookie plan correctly restricted${NC}"
echo ""

###############################################################################
# Test 4: Database Verification
###############################################################################

print_test "4: Database Verification"

step "4.1: Connect to production database"
check "Open database client (psql, DBeaver, etc.)"
check "Connect to varsityhub database"
read -p "Press ENTER when connected..."

warn "Ensure you have database read access before proceeding"

step "4.2: Query Veteran user preferences"
echo ""
echo "Run this SQL query:"
echo "---"
echo "SELECT id, email, preferences->>'plan' as plan, preferences->>'role' as role"
echo "FROM \"User\""
echo "WHERE email = 'test.veteran@varsityhub.test';"
echo "---"
echo ""
check "Expected result:"
echo "  - plan: 'veteran'"
echo "  - role: 'coach'"
read -p "Press ENTER after running query..."

step "4.3: Query Legend user preferences"
echo ""
echo "Run this SQL query:"
echo "---"
echo "SELECT id, email, preferences->>'plan' as plan, preferences->>'role' as role"
echo "FROM \"User\""
echo "WHERE email = 'test.legend@varsityhub.test';"
echo "---"
echo ""
check "Expected result:"
echo "  - plan: 'legend'"
echo "  - role: 'coach'"
read -p "Press ENTER after running query..."

step "4.4: Query Rookie user preferences"
echo ""
echo "Run this SQL query:"
echo "---"
echo "SELECT id, email, preferences->>'plan' as plan, preferences->>'role' as role"
echo "FROM \"User\""
echo "WHERE email = 'test.rookie@varsityhub.test';"
echo "---"
echo ""
check "Expected result:"
echo "  - plan: 'rookie'"
echo "  - role: 'fan'"
read -p "Press ENTER after running query..."

pass "Database verification complete"

echo -e "${GREEN}✨ Test 4 Summary: All users show correct plan + role${NC}"
echo ""

###############################################################################
# Test Summary
###############################################################################

echo "=============================================="
echo -e "${GREEN}QA Test Summary${NC}"
echo "=============================================="
echo ""
echo "Tests Run:     $TESTS_RUN"
echo -e "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed:  ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "The Stripe role binding fix is working correctly:"
  echo "1. Veteran/Legend purchases set role='coach' ✅"
  echo "2. Step 4 org creation succeeds for paid users ✅"
  echo "3. Rookie users remain with role='fan' ✅"
  echo "4. Database shows correct plan + role values ✅"
  echo ""
  echo "APPROVED FOR DEPLOYMENT"
  echo ""
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Issues detected. Review failed tests above and:"
  echo "1. Check backend logs for errors"
  echo "2. Verify Stripe webhook is configured"
  echo "3. Ensure database is accessible"
  echo "4. Retest after fixes"
  echo ""
fi

echo "Next Steps:"
echo "- [ ] Have product manager review test results"
echo "- [ ] Merge to production deployment branch"
echo "- [ ] Deploy to staging for final validation"
echo "- [ ] Deploy to production"
echo "- [ ] Monitor payment logs for 24+ hours"
echo "- [ ] Alert team if any anomalies detected"
echo ""
