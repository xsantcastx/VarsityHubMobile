#!/bin/bash

# Quick Coach Button Functionality Test
# Verifies the critical fix is in place

echo "🔘 TESTING COACH BUTTON FUNCTIONALITY"
echo "======================================"
echo ""

ERRORS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_pass() {
  echo -e "${GREEN}✅${NC} $1"
}

print_fail() {
  echo -e "${RED}❌${NC} $1"
  ERRORS=$((ERRORS + 1))
}

print_info() {
  echo -e "${BLUE}ℹ️${NC}  $1"
}

echo "Testing: app/onboarding/step-1-role.tsx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

STEP1_FILE="app/onboarding/step-1-role.tsx"

# Test 1: clearOnboarding is imported
print_info "Test 1: Checking clearOnboarding import..."
if grep -q "clearOnboarding" "$STEP1_FILE" | head -20 | grep -q "clearOnboarding"; then
  print_pass "clearOnboarding is imported"
else
  print_fail "clearOnboarding NOT imported - CRITICAL BUG!"
fi

# Test 2: clearOnboarding is called for coaches
print_info "Test 2: Checking clearOnboarding() is called..."
if grep -A 10 "if (role === 'coach')" "$STEP1_FILE" | grep -q "await clearOnboarding()"; then
  print_pass "clearOnboarding() called when coach selected"
else
  print_fail "clearOnboarding() NOT called - will skip steps!"
fi

# Test 3: Progress is set to 1 (step 2)
print_info "Test 3: Checking progress reset..."
if grep -A 15 "if (role === 'coach')" "$STEP1_FILE" | grep -q "setProgress(1)"; then
  print_pass "Progress set to 1 (Step 2)"
else
  print_fail "Progress not set correctly"
fi

# Test 4: State is set to only role
print_info "Test 4: Checking state is set correctly..."
if grep -A 15 "if (role === 'coach')" "$STEP1_FILE" | grep -q "setOB({ role: 'coach' })"; then
  print_pass "State set to only role after clearing"
else
  print_fail "State not set correctly"
fi

# Test 5: No direct AsyncStorage calls
print_info "Test 5: Checking no direct AsyncStorage calls..."
if ! grep -q "AsyncStorage.removeItem" "$STEP1_FILE"; then
  print_pass "Using clearOnboarding() instead of direct AsyncStorage"
else
  print_fail "Direct AsyncStorage calls found - should use clearOnboarding()"
fi

echo ""
echo "Testing: app/onboarding/index.tsx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

INDEX_FILE="app/onboarding/index.tsx"

# Test 6: Validation prevents skipping step 6
print_info "Test 6: Checking step 6 skip prevention..."
if grep -q "if (progress > 4)" "$INDEX_FILE"; then
  print_pass "Step 6 skip prevention in place (progress > 4)"
else
  print_fail "Missing step 6 skip prevention - CRITICAL!"
fi

# Test 7: Forces to step 6
print_info "Test 7: Checking redirect to step 6..."
if grep -A 5 "if (progress > 4)" "$INDEX_FILE" | grep -q "step-6-authorized-users"; then
  print_pass "Forces redirect to step 6"
else
  print_fail "Doesn't redirect to step 6"
fi

echo ""
echo "Testing: context/OnboardingContext.tsx"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CONTEXT_FILE="context/OnboardingContext.tsx"

# Test 8: clearOnboarding function exists
print_info "Test 8: Checking clearOnboarding exists..."
if grep -q "const clearOnboarding = async" "$CONTEXT_FILE"; then
  print_pass "clearOnboarding function defined"
else
  print_fail "clearOnboarding function missing!"
fi

# Test 9: clearOnboarding is exported
print_info "Test 9: Checking clearOnboarding export..."
if grep -q "clearOnboarding" "$CONTEXT_FILE" | tail -20 | grep -q "clearOnboarding"; then
  print_pass "clearOnboarding exported in provider"
else
  print_fail "clearOnboarding not exported"
fi

echo ""
echo "======================================"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
  echo ""
  echo "The coach button is properly implemented:"
  echo "  1. Clicking 'Coach' clears ALL cached state"
  echo "  2. Progress resets to step 2"
  echo "  3. Step 6 cannot be skipped"
  echo ""
  echo "🧪 Manual Test:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "1. npm run dev"
  echo "2. Delete app from simulator"
  echo "3. Reinstall and open app"
  echo "4. Sign in"
  echo "5. Click 'Coach' button"
  echo "6. Verify you land on Step 2 (Basic Info)"
  echo "7. Complete steps 2, 3, 4"
  echo "8. Verify you land on Step 6 (Authorized Users)"
  echo "9. Complete Step 6"
  echo "10. Complete remaining steps"
  echo ""
  exit 0
else
  echo -e "${RED}❌ FOUND $ERRORS ISSUE(S)${NC}"
  echo ""
  echo "Fix the issues above before testing."
  exit 1
fi
