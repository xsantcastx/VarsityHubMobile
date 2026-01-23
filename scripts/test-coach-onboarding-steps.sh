#!/bin/bash
# Test Coach Onboarding Steps - Verify all steps work correctly

set -e

echo "🧪 Testing Coach Onboarding Steps"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Test 1: Verify step numbers in files
echo "1️⃣  Checking step numbers in OnboardingLayout components..."
echo ""

# Step 1
if grep -q 'step={1}' app/onboarding/step-1-role.tsx; then
    echo -e "   ${GREEN}✅ Step 1: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 1: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 2
if grep -q 'step={2}' app/onboarding/step-2-basic.tsx; then
    echo -e "   ${GREEN}✅ Step 2: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 2: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 3
if grep -q 'step={3}' app/onboarding/step-3-plan.tsx; then
    echo -e "   ${GREEN}✅ Step 3: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 3: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 4
if grep -q 'step={4}' app/onboarding/step-4-organization.tsx; then
    echo -e "   ${GREEN}✅ Step 4: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 4: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 6 (no step 5)
if grep -q 'step={6}' app/onboarding/step-6-authorized-users.tsx; then
    echo -e "   ${GREEN}✅ Step 6: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 6: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 7
if grep -q 'step={7}' app/onboarding/step-7-profile.tsx; then
    echo -e "   ${GREEN}✅ Step 7: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 7: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 8
if grep -q 'step={8}' app/onboarding/step-8-interests.tsx; then
    echo -e "   ${GREEN}✅ Step 8: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 8: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 9
if grep -q 'step={9}' app/onboarding/step-9-features.tsx; then
    echo -e "   ${GREEN}✅ Step 9: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 9: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 10
if grep -q 'step={10}' app/onboarding/step-10-confirmation.tsx; then
    echo -e "   ${GREEN}✅ Step 10: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 10: Wrong step number${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "2️⃣  Checking totalSteps in OnboardingLayout..."
if grep -q 'totalSteps = 10' app/onboarding/components/OnboardingLayout.tsx; then
    echo -e "   ${GREEN}✅ Total steps: 10${NC}"
else
    echo -e "   ${RED}❌ Total steps: Wrong (should be 10)${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "3️⃣  Checking progress indices in stepRoutes array..."
if grep -q "'/onboarding/step-1-role'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-2-basic'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-3-plan'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-4-organization'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-6-authorized-users'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-7-profile'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-8-interests'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-9-features'" app/onboarding/index.tsx && \
   grep -q "'/onboarding/step-10-confirmation'" app/onboarding/index.tsx; then
    echo -e "   ${GREEN}✅ All step routes exist in array${NC}"
else
    echo -e "   ${RED}❌ Missing step routes in array${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4️⃣  Checking navigation flow for coaches..."
echo ""

# Step 1 → Step 2
if grep -q "setProgress(1)" app/onboarding/step-1-role.tsx && grep -q "step-2-basic" app/onboarding/step-1-role.tsx; then
    echo -e "   ${GREEN}✅ Step 1 → Step 2: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 1 → Step 2: Navigation issue${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 2 → Step 3 (for coaches)
if grep -q "setProgress(2)" app/onboarding/step-2-basic.tsx && grep -q "step-3-plan" app/onboarding/step-2-basic.tsx; then
    echo -e "   ${GREEN}✅ Step 2 → Step 3: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 2 → Step 3: Navigation issue${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 3 → Step 4
if grep -q "setProgress(3)" app/onboarding/step-3-plan.tsx && grep -q "step-4-organization" app/onboarding/step-3-plan.tsx; then
    echo -e "   ${GREEN}✅ Step 3 → Step 4: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 3 → Step 4: Navigation issue${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 4 → Step 6
if grep -q "setProgress(4)" app/onboarding/step-4-organization.tsx && grep -q "step-6-authorized-users" app/onboarding/step-4-organization.tsx; then
    echo -e "   ${GREEN}✅ Step 4 → Step 6: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 4 → Step 6: Navigation issue${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Step 6 → Step 7
if grep -q "setProgress(5)" app/onboarding/step-6-authorized-users.tsx && grep -q "step-7-profile" app/onboarding/step-6-authorized-users.tsx; then
    echo -e "   ${GREEN}✅ Step 6 → Step 7: Correct${NC}"
else
    echo -e "   ${RED}❌ Step 6 → Step 7: Navigation issue${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "5️⃣  Verifying no old step numbers remain..."
if grep -r "step={5}" app/onboarding/step-*.tsx 2>/dev/null | grep -v "step-5" | grep -v "step={50" | grep -v "step={51"; then
    echo -e "   ${YELLOW}⚠️  Found step={5} in files (might be old code)${NC}"
else
    echo -e "   ${GREEN}✅ No incorrect step={5} found${NC}"
fi

if grep -r "step={6}" app/onboarding/step-7-profile.tsx 2>/dev/null; then
    echo -e "   ${RED}❌ Step 7 still has step={6}${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "   ${GREEN}✅ Step 7 has correct step number${NC}"
fi

echo ""
echo "==================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "📱 Manual Test Checklist:"
    echo ""
    echo "1. Start coach onboarding"
    echo "2. Verify each step shows correct number:"
    echo "   - Step 1/10: Choose Role"
    echo "   - Step 2/10: Basic Info"
    echo "   - Step 3/10: Plan Selection"
    echo "   - Step 4/10: Organization/Team"
    echo "   - Step 6/10: Authorized Users"
    echo "   - Step 7/10: Profile"
    echo "   - Step 8/10: Interests"
    echo "   - Step 9/10: Features"
    echo "   - Step 10/10: Confirmation"
    echo ""
    echo "3. Verify progress bar fills correctly"
    echo "4. Verify navigation works between all steps"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s)${NC}"
    exit 1
fi
