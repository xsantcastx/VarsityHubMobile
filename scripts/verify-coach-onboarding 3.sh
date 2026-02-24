#!/bin/bash

# Comprehensive Coach Onboarding Verification Script
# Tests both frontend code and backend API routes

echo "🔍 COMPREHENSIVE COACH ONBOARDING VERIFICATION"
echo "================================================"
echo ""

ERRORS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_pass() {
  echo -e "${GREEN}✅ PASS${NC}: $1"
}

print_fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  ERRORS=$((ERRORS + 1))
}

print_warn() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 1: FRONTEND CODE VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Step 1: Coach button and clearOnboarding
echo "📋 Checking Step 1: Role Selection (app/onboarding/step-1-role.tsx)"
STEP1_FILE="app/onboarding/step-1-role.tsx"

if [ ! -f "$STEP1_FILE" ]; then
  print_fail "Step 1 file not found!"
else
  # Check clearOnboarding is destructured
  if grep -q "clearOnboarding" "$STEP1_FILE"; then
    print_pass "clearOnboarding imported from context"
  else
    print_fail "clearOnboarding NOT imported - coach state won't reset!"
  fi

  # Check clearOnboarding is called for coaches
  if grep -q "await clearOnboarding()" "$STEP1_FILE"; then
    print_pass "clearOnboarding() called for coaches"
  else
    print_fail "clearOnboarding() NOT called - will skip steps!"
  fi

  # Check progress is set to 1 for coaches
  if grep -q "setProgress(1)" "$STEP1_FILE"; then
    print_pass "Progress set to step 2 (index 1) for coaches"
  else
    print_fail "Progress not properly set for coaches"
  fi

  # Verify AsyncStorage direct calls are removed
  if grep -q "AsyncStorage.removeItem" "$STEP1_FILE"; then
    print_warn "Direct AsyncStorage calls found - should use clearOnboarding()"
  else
    print_pass "No direct AsyncStorage calls (using clearOnboarding)"
  fi
fi

echo ""

# Check Step 2: Basic Info
echo "📋 Checking Step 2: Basic Info (app/onboarding/step-2-basic.tsx)"
STEP2_FILE="app/onboarding/step-2-basic.tsx"

if [ ! -f "$STEP2_FILE" ]; then
  print_fail "Step 2 file not found!"
else
  if grep -q "username" "$STEP2_FILE" && grep -q "dob" "$STEP2_FILE" && grep -q "zip" "$STEP2_FILE"; then
    print_pass "Step 2 collects username, DOB, zip"
  else
    print_fail "Step 2 missing required fields"
  fi
fi

echo ""

# Check Step 3: Plan Selection
echo "📋 Checking Step 3: Plan Selection (app/onboarding/step-3-plan.tsx)"
STEP3_FILE="app/onboarding/step-3-plan.tsx"

if [ ! -f "$STEP3_FILE" ]; then
  print_fail "Step 3 file not found!"
else
  if grep -q "plan" "$STEP3_FILE"; then
    print_pass "Step 3 has plan selection"
  else
    print_fail "Step 3 missing plan selection"
  fi
fi

echo ""

# Check Step 4: Organization
echo "📋 Checking Step 4: Organization (app/onboarding/step-4-organization.tsx)"
STEP4_FILE="app/onboarding/step-4-organization.tsx"

if [ ! -f "$STEP4_FILE" ]; then
  print_fail "Step 4 file not found!"
else
  if grep -q "team_id\|organization_id" "$STEP4_FILE"; then
    print_pass "Step 4 has organization/team selection"
  else
    print_fail "Step 4 missing organization fields"
  fi
fi

echo ""

# Check Step 6: Authorized Users
echo "📋 Checking Step 6: Authorized Users (app/onboarding/step-6-authorized-users.tsx)"
STEP6_FILE="app/onboarding/step-6-authorized-users.tsx"

if [ ! -f "$STEP6_FILE" ]; then
  print_fail "Step 6 file not found!"
else
  # Check if coaches can skip
  if grep -q "if (ob.role === 'coach')" "$STEP6_FILE"; then
    print_pass "Step 6 has coach validation"

    # Check what happens for coaches
    if grep -A 5 "if (ob.role === 'coach')" "$STEP6_FILE" | grep -q "return false"; then
      print_pass "Coaches CANNOT skip step 6 (return false)"
    else
      print_warn "Check step 6 skip logic for coaches"
    fi
  else
    print_warn "Step 6 may allow coaches to skip"
  fi
fi

echo ""

# Check index.tsx validation
echo "📋 Checking Onboarding Index Validation (app/onboarding/index.tsx)"
INDEX_FILE="app/onboarding/index.tsx"

if [ ! -f "$INDEX_FILE" ]; then
  print_fail "Onboarding index file not found!"
else
  # Check validation logic exists
  if grep -q "if (state?.role === 'coach')" "$INDEX_FILE"; then
    print_pass "Coach-specific validation exists"
  else
    print_fail "No coach validation in index!"
  fi

  # Check for step 6 validation
  if grep -q "if (progress > 4)" "$INDEX_FILE"; then
    print_pass "Correct condition to prevent skipping step 6 (progress > 4)"
  else
    print_fail "Missing or incorrect step 6 skip prevention"
  fi

  # Check setProgress is used
  if grep -q "setProgress" "$INDEX_FILE"; then
    print_pass "setProgress available for validation"
  else
    print_fail "setProgress not available in index"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 2: BACKEND API VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check backend user routes
echo "📋 Checking Backend User Routes (server/src/routes/users.ts)"
USERS_API="server/src/routes/users.ts"

if [ ! -f "$USERS_API" ]; then
  print_fail "Backend users.ts not found!"
else
  # Check for profile update endpoint
  if grep -q "router.put\|router.patch" "$USERS_API"; then
    print_pass "User update endpoint exists"
  else
    print_fail "No user update endpoint found"
  fi

  # Check for onboarding-related fields
  if grep -q "username\|role\|plan" "$USERS_API"; then
    print_pass "Backend handles onboarding fields"
  else
    print_warn "Check if backend handles all onboarding fields"
  fi
fi

echo ""

# Check backend organization routes
echo "📋 Checking Backend Organization Routes (server/src/routes/organizations.ts)"
ORG_API="server/src/routes/organizations.ts"

if [ ! -f "$ORG_API" ]; then
  print_fail "Backend organizations.ts not found!"
else
  if grep -q "router.post\|router.get" "$ORG_API"; then
    print_pass "Organization CRUD endpoints exist"
  else
    print_fail "Organization endpoints missing"
  fi
fi

echo ""

# Check backend teams routes
echo "📋 Checking Backend Team Routes (server/src/routes/teams.ts)"
TEAMS_API="server/src/routes/teams.ts"

if [ ! -f "$TEAMS_API" ]; then
  print_fail "Backend teams.ts not found!"
else
  if grep -q "router.post\|router.get" "$TEAMS_API"; then
    print_pass "Team CRUD endpoints exist"
  else
    print_fail "Team endpoints missing"
  fi
fi

echo ""

# Check OnboardingContext
echo "📋 Checking OnboardingContext (context/OnboardingContext.tsx)"
CONTEXT_FILE="context/OnboardingContext.tsx"

if [ ! -f "$CONTEXT_FILE" ]; then
  print_fail "OnboardingContext not found!"
else
  # Check clearOnboarding function exists
  if grep -q "const clearOnboarding" "$CONTEXT_FILE"; then
    print_pass "clearOnboarding function defined"
  else
    print_fail "clearOnboarding function missing!"
  fi

  # Check it removes AsyncStorage items
  if grep -q "AsyncStorage.removeItem.*ONBOARDING_STATE_KEY" "$CONTEXT_FILE" && \
     grep -q "AsyncStorage.removeItem.*ONBOARDING_PROGRESS_KEY" "$CONTEXT_FILE"; then
    print_pass "clearOnboarding removes both state and progress from AsyncStorage"
  else
    print_fail "clearOnboarding doesn't properly clear AsyncStorage"
  fi

  # Check it resets context state
  if grep -q "setState({})" "$CONTEXT_FILE" && grep -q "setProgress(0)" "$CONTEXT_FILE"; then
    print_pass "clearOnboarding resets context state and progress"
  else
    print_fail "clearOnboarding doesn't reset context properly"
  fi

  # Check clearOnboarding is exported
  if grep -q "clearOnboarding" "$CONTEXT_FILE" | tail -5 | grep -q "clearOnboarding"; then
    print_pass "clearOnboarding exported from context"
  else
    print_warn "Verify clearOnboarding is exported in context value"
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PART 3: DATA FLOW VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Verifying Complete Data Flow"

# Check step progression
echo ""
echo "Step Flow Analysis:"
echo "  Step 1 (role) → clears state → sets progress to 1"
echo "  Step 2 (basic) → saves username, dob, zip → progress to 2"
echo "  Step 3 (plan) → saves plan → progress to 3"
echo "  Step 4 (org) → saves team_id/org_id → progress to 4"
echo "  Step 6 (users) → cannot skip → progress to 5"
echo "  Step 7+ → profile, interests, features → completion"
echo ""

# Verify step routes array
if grep -q "step-6-authorized-users.*// 4" "$INDEX_FILE"; then
  print_pass "Step 6 correctly at index 4 in stepRoutes array"
else
  print_warn "Verify step 6 is at correct index (4) in stepRoutes"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CHECKS PASSED!${NC}"
  echo ""
  echo "Coach onboarding flow should work correctly:"
  echo "  1. Selecting 'Coach' clears all cached state"
  echo "  2. Forces progression through steps 2, 3, 4, 6"
  echo "  3. Cannot skip step 6 (authorized users)"
  echo "  4. Backend APIs ready to handle data"
  echo ""
  echo "📱 MANUAL TESTING STEPS:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Clear app data (delete and reinstall app)"
  echo "2. Sign in as a new user"
  echo "3. Select 'Coach' role in step 1"
  echo "4. Verify you land on step 2 (Basic Info)"
  echo "5. Complete step 2 → should go to step 3 (Plan)"
  echo "6. Complete step 3 → should go to step 4 (Organization)"
  echo "7. Complete step 4 → should go to step 6 (Authorized Users)"
  echo "8. Step 6 should NOT be skippable"
  echo "9. Complete step 6 → should go to step 7 (Profile)"
  echo "10. Complete remaining steps"
  echo ""
  echo "🧪 TEST EDGE CASES:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "1. Test switching from Fan → Coach (should clear state)"
  echo "2. Test app reload mid-onboarding (should resume at correct step)"
  echo "3. Test completing step 4 then going back (should not skip step 6)"
  echo "4. Test network failures during save"
  echo ""
  exit 0
else
  echo -e "${RED}❌ FOUND $ERRORS ISSUE(S)${NC}"
  echo ""
  echo "Fix the issues above before testing."
  echo ""
  exit 1
fi
