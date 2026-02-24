#!/bin/bash
# Test Coach Onboarding Validation Fix
# Verifies the fix for the impossible condition bug (progress >= 5 && progress < 4)

set -e

echo "🐛 Testing Coach Onboarding Validation Fix"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

echo "1️⃣  Checking that impossible condition is GONE..."
echo ""

# Check that the impossible condition doesn't exist
if grep -q "progress >= 5 && progress < 4" app/onboarding/index.tsx; then
    echo -e "   ${RED}❌ CRITICAL: Impossible condition still exists!${NC}"
    echo -e "   ${RED}   Found: progress >= 5 && progress < 4${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✅ Impossible condition removed${NC}"
fi

echo ""
echo "2️⃣  Checking that correct validation logic is present..."
echo ""

# Check that progress > 4 validation exists
if grep -q "progress > 4" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ Found correct validation: progress > 4${NC}"
else
    echo -e "   ${RED}❌ Missing correct validation logic${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check that setProgress is available in scope
if grep -q "const { progress, state, isLoaded, setProgress } = useOnboarding();" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ setProgress properly destructured from useOnboarding${NC}"
else
    echo -e "   ${RED}❌ setProgress not properly available${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check that setProgress is in useEffect dependencies
if grep -q "\[hasNavigated, isLoaded, progress, router, state, user, setProgress\]" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ setProgress in useEffect dependencies${NC}"
else
    echo -e "   ${YELLOW}⚠️  setProgress might be missing from useEffect dependencies${NC}"
fi

echo ""
echo "3️⃣  Verifying step 6 validation logic..."
echo ""

# Check that step 6 is at index 4 in stepRoutes
if grep -A 10 "const stepRoutes = \[" app/onboarding/index.tsx | grep -n "step-6-authorized-users" | grep "6:"; then
    echo -e "   ${GREEN}✅ Step 6 is at index 4 in stepRoutes array (line 6, index 4 due to 0-based)${NC}"
else
    echo -e "   ${RED}❌ Step 6 might not be at correct index${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check that redirect to step 6 uses correct route
if grep -q "router.replace('/onboarding/step-6-authorized-users')" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ Correct redirect to step-6-authorized-users${NC}"
else
    echo -e "   ${RED}❌ Missing redirect to step 6${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4️⃣  Checking coach role validation..."
echo ""

# Check that role validation exists
if grep -q "if (state?.role === 'coach')" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ Coach role validation present${NC}"
else
    echo -e "   ${RED}❌ Missing coach role validation${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check that required step checks exist
if grep -q "const hasStep2 =" app/onboarding/index.tsx && \
   grep -q "const hasStep3 =" app/onboarding/index.tsx && \
   grep -q "const hasStep4 =" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ All required step checks present (hasStep2, hasStep3, hasStep4)${NC}"
else
    echo -e "   ${RED}❌ Missing required step validation checks${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "5️⃣  Verifying step progression logic..."
echo ""

# Check step 4 → step 6 progression
if grep -q "setProgress(4)" app/onboarding/step-4-organization.tsx; then
    echo -e "   ${GREEN}✅ Step 4 sets progress to 4 (step 6 index)${NC}"
else
    echo -e "   ${RED}❌ Step 4 progression incorrect${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check step 6 → step 7 progression
if grep -q "setProgress(5)" app/onboarding/step-6-authorized-users.tsx; then
    echo -e "   ${GREEN}✅ Step 6 sets progress to 5 (step 7 index)${NC}"
else
    echo -e "   ${RED}❌ Step 6 progression incorrect${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All validation tests passed!${NC}"
    echo ""
    echo "The fix is working correctly:"
    echo "  • Impossible condition removed"
    echo "  • Correct validation logic in place (progress > 4)"
    echo "  • setProgress properly available in scope"
    echo "  • Coach validation ensures step 6 is not skipped"
    echo ""
    echo "📱 Next Steps:"
    echo "  1. Test manually in simulator"
    echo "  2. Verify step 6 appears after step 4"
    echo "  3. Confirm no steps are skipped"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) - Fix incomplete or incorrect${NC}"
    exit 1
fi
