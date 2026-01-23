#!/bin/bash
# Test Coach Onboarding Payment Verification
# This script tests the payment verification logic

set -e

echo "🧪 Testing Coach Onboarding Payment Verification"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 Test Checklist:"
echo ""

# Test 1: Check if payment verification code exists
echo "1️⃣  Checking payment verification code..."
if grep -q "payment_pending === true" app/onboarding/step-10-confirmation.tsx; then
    echo -e "   ${GREEN}✅ Payment verification check found${NC}"
else
    echo -e "   ${RED}❌ Payment verification check NOT found${NC}"
    exit 1
fi

# Test 2: Check if subscription_id check exists
echo ""
echo "2️⃣  Checking subscription ID verification..."
if grep -q "subscription_id" app/onboarding/step-10-confirmation.tsx; then
    echo -e "   ${GREEN}✅ Subscription ID check found${NC}"
else
    echo -e "   ${RED}❌ Subscription ID check NOT found${NC}"
    exit 1
fi

# Test 3: Check if Rookie plan is excluded from payment check
echo ""
echo "3️⃣  Checking Rookie plan exclusion..."
if grep -q "ob.plan !== 'rookie'" app/onboarding/step-10-confirmation.tsx; then
    echo -e "   ${GREEN}✅ Rookie plan excluded from payment check${NC}"
else
    echo -e "   ${RED}❌ Rookie plan NOT excluded${NC}"
    exit 1
fi

# Test 4: Check team count default
echo ""
echo "4️⃣  Checking team count default..."
if grep -q "useState<number>(2)" app/onboarding/step-3-plan.tsx; then
    echo -e "   ${GREEN}✅ Team count defaults to 2 (first 2 free)${NC}"
else
    echo -e "   ${YELLOW}⚠️  Team count default may not be 2${NC}"
fi

# Test 5: Check team count minimum validation
echo ""
echo "5️⃣  Checking team count minimum validation..."
if grep -q "teamCount < 3" app/onboarding/step-3-plan.tsx; then
    echo -e "   ${GREEN}✅ Minimum 3 teams validation found${NC}"
else
    echo -e "   ${YELLOW}⚠️  Minimum team validation may be missing${NC}"
fi

echo ""
echo "📱 Manual Test Required:"
echo ""
echo "To fully test, you need to:"
echo ""
echo "1. ${YELLOW}Test Pending Payment Block${NC}"
echo "   - Select Coach role"
echo "   - Choose Veteran plan"
echo "   - Open Stripe checkout but DON'T complete"
echo "   - Navigate to Step 10"
echo "   - Click 'Complete Setup'"
echo "   - ${GREEN}Expected: Alert shown, completion blocked${NC}"
echo ""
echo "2. ${YELLOW}Test Completed Payment${NC}"
echo "   - Select Coach role"
echo "   - Choose Veteran plan"
echo "   - Complete Stripe payment"
echo "   - Navigate to Step 10"
echo "   - Click 'Complete Setup'"
echo "   - ${GREEN}Expected: Onboarding completes${NC}"
echo ""
echo "3. ${YELLOW}Test Rookie Plan (Free)${NC}"
echo "   - Select Coach role"
echo "   - Choose Rookie plan"
echo "   - Navigate to Step 10"
echo "   - Click 'Complete Setup'"
echo "   - ${GREEN}Expected: Onboarding completes immediately${NC}"
echo ""
echo "✅ Code verification complete!"
echo ""
echo "Next: Run manual tests in the app to verify behavior."
