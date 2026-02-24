#!/bin/bash
# SAFE BUILD SCRIPT - Prevents wasted EAS credits
# This script runs comprehensive verification BEFORE building

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛡️  SAFE BUILD SYSTEM - PREVENTING WASTED CREDITS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Run comprehensive verification
echo -e "${BLUE}Step 1/3: Running build readiness verification...${NC}"
if ! bash scripts/verify-build-ready.sh; then
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ BUILD BLOCKED - Verification Failed!${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${RED}Fix the errors above before building to avoid wasting EAS credits!${NC}"
    echo ""
    echo "Run verification again after fixes:"
    echo "  bash scripts/verify-build-ready.sh"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Verification passed!${NC}"
echo ""

# Step 2: Final TypeScript check
echo -e "${BLUE}Step 2/3: Final TypeScript compilation check...${NC}"
if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found - BUILD BLOCKED${NC}"
    npm run typecheck 2>&1 | grep "error TS" | head -10
    exit 1
else
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
fi
echo ""

# Step 3: Confirm build
echo -e "${BLUE}Step 3/3: Build confirmation...${NC}"
echo -e "${YELLOW}⚠️  You are about to start an EAS build that will consume credits.${NC}"
echo ""
read -p "Continue with build? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "${YELLOW}Build cancelled by user.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ ALL CHECKS PASSED - PROCEEDING WITH BUILD${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Determine platform from argument
PLATFORM=${1:-all}

case $PLATFORM in
    android)
        echo "🤖 Building Android..."
        eas build --platform android --profile production
        ;;
    ios)
        echo "🍎 Building iOS..."
        eas build --platform ios --profile production
        ;;
    all|*)
        echo "📱🤖 Building both platforms..."
        eas build --platform all --profile production
        ;;
esac

echo ""
echo -e "${GREEN}✅ Build process completed!${NC}"
echo "Check build status: https://expo.dev/accounts/varsity-hub/projects/varsity-hub-mobile/builds"
