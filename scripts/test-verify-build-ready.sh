#!/bin/bash
# Test script to verify build verification catches Sentry configuration issues

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 TESTING BUILD VERIFICATION SCRIPT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Run the actual verification script
echo -e "${BLUE}Test 1: Running full verification script...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if bash scripts/verify-build-ready.sh > /tmp/verify-output.log 2>&1; then
    VERIFY_EXIT=$?
else
    VERIFY_EXIT=$?
fi

echo "Exit code: $VERIFY_EXIT"
echo ""

# Check for Sentry validation in output
echo -e "${BLUE}Test 2: Checking Sentry configuration validation...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "Sentry plugin configured in app.json" /tmp/verify-output.log; then
    echo -e "${GREEN}✅ Sentry plugin check found${NC}"
else
    echo -e "${RED}❌ Sentry plugin check missing${NC}"
fi

if grep -q "EAS Sentry config present" /tmp/verify-output.log; then
    echo -e "${GREEN}✅ EAS Sentry config check found${NC}"
else
    echo -e "${RED}❌ EAS Sentry config check missing${NC}"
fi

if grep -q "Sentry org/project values match" /tmp/verify-output.log; then
    echo -e "${GREEN}✅ Sentry org/project matching check found${NC}"
else
    echo -e "${RED}❌ Sentry org/project matching check missing${NC}"
fi

if grep -q "Sentry org/project configured correctly" /tmp/verify-output.log; then
    echo -e "${GREEN}✅ Sentry org/project validation found${NC}"
else
    echo -e "${RED}❌ Sentry org/project validation missing${NC}"
fi

echo ""

# Test 3: Check for error detection
echo -e "${BLUE}Test 3: Checking error detection capabilities...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "ERROR(S) FOUND" /tmp/verify-output.log || [ $VERIFY_EXIT -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Script detected errors (this is expected if there are actual issues)${NC}"
    echo "Errors found:"
    grep "❌" /tmp/verify-output.log | head -5
else
    echo -e "${GREEN}✅ No blocking errors detected${NC}"
fi

echo ""

# Test 4: Verify Sentry token check
echo -e "${BLUE}Test 4: Checking Sentry token verification...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "SENTRY_AUTH_TOKEN" /tmp/verify-output.log; then
    echo -e "${GREEN}✅ Sentry token check found${NC}"
    if grep -q "SENTRY_AUTH_TOKEN found" /tmp/verify-output.log; then
        echo -e "${GREEN}   Token is configured${NC}"
    else
        echo -e "${YELLOW}   Token check ran but token not found (may need EAS CLI auth)${NC}"
    fi
else
    echo -e "${RED}❌ Sentry token check missing${NC}"
fi

echo ""

# Test 5: Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo ""
echo -e "${BLUE}Full verification output saved to: /tmp/verify-output.log${NC}"
echo ""
echo -e "${BLUE}To view full output:${NC}"
echo "  cat /tmp/verify-output.log"
echo ""
echo -e "${BLUE}To test with incorrect Sentry config (simulate error):${NC}"
echo "  1. Temporarily change SENTRY_ORG in eas.json"
echo "  2. Run: bash scripts/verify-build-ready.sh"
echo "  3. Should see error about org/project mismatch"
echo "  4. Revert the change"
echo ""
echo -e "${BLUE}To verify it catches 'Project not found' issues:${NC}"
echo "  The script validates:"
echo "  - app.json Sentry plugin org/project values"
echo "  - eas.json SENTRY_ORG and SENTRY_PROJECT values"
echo "  - That both match each other"
echo "  - That values are correct (lime-productions / varsityhub)"
echo ""
echo -e "${GREEN}✅ If all checks pass, the script will catch Sentry config issues before builds!${NC}"
