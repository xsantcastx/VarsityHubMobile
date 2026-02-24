#!/bin/bash
# Comprehensive App Audit Script
# Tests all critical functionality before release

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 COMPREHENSIVE APP AUDIT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. Check app version
echo -e "${BLUE}Step 1: App Version Check...${NC}"
VERSION=$(grep '"version"' app.json | head -1 | cut -d'"' -f4)
RUNTIME_VERSION=$(grep '"runtimeVersion"' app.json | head -1 | cut -d'"' -f4)
echo -e "  App Version: ${VERSION}"
echo -e "  Runtime Version: ${RUNTIME_VERSION}"
if [ "$VERSION" = "$RUNTIME_VERSION" ]; then
    echo -e "${GREEN}✅ Version numbers match${NC}"
else
    echo -e "${RED}❌ Version mismatch!${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Check critical files
echo -e "${BLUE}Step 2: Critical Files Check...${NC}"
MISSING=0
for file in "app.json" "package.json" "babel.config.js" "metro.config.js" "app/(tabs)/create-post.tsx" "app/public-event.tsx" "server/src/routes/posts.ts"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        MISSING=$((MISSING + 1))
    fi
done
if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ All critical files present${NC}"
else
    ERRORS=$((ERRORS + MISSING))
fi
echo ""

# 3. Check sample event posting implementation
echo -e "${BLUE}Step 3: Sample Event Posting Implementation...${NC}"
if grep -q "isSampleEvent\|isSampleGame" "app/(tabs)/create-post.tsx" && \
   grep -q "isSampleEvent\|isSampleGame" "server/src/routes/posts.ts" && \
   grep -q "SAMPLE_GAME" "server/src/routes/posts.ts"; then
    echo -e "${GREEN}✅ Sample event detection implemented${NC}"
else
    echo -e "${RED}❌ Sample event detection missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "feedForGame" "app/public-event.tsx"; then
    echo -e "${GREEN}✅ Sample event post querying implemented${NC}"
else
    echo -e "${RED}❌ Sample event post querying missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "startsWith.*SAMPLE_GAME" "server/src/routes/posts.ts"; then
    echo -e "${GREEN}✅ Server query for sample events implemented${NC}"
else
    echo -e "${RED}❌ Server query for sample events missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Check coach onboarding
echo -e "${BLUE}Step 4: Coach Onboarding Implementation...${NC}"
if [ -f "app/onboarding/index.tsx" ] && [ -f "app/onboarding/step-1-role.tsx" ]; then
    echo -e "${GREEN}✅ Onboarding screens present${NC}"
    if grep -q "role.*coach" "app/onboarding/index.tsx"; then
        echo -e "${GREEN}✅ Coach role handling present${NC}"
    else
        echo -e "${YELLOW}⚠️  Coach role handling check${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Onboarding screens missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Check upload functionality
echo -e "${BLUE}Step 5: Upload Functionality...${NC}"
if grep -q "uploadFile\|upload" "app/(tabs)/create-post.tsx"; then
    echo -e "${GREEN}✅ Upload functionality present in create-post${NC}"
else
    echo -e "${RED}❌ Upload functionality missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "api/upload.ts" ] || grep -q "upload" "api/entities.ts"; then
    echo -e "${GREEN}✅ Upload API present${NC}"
else
    echo -e "${YELLOW}⚠️  Upload API check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 6. Check Babel plugins in dependencies
echo -e "${BLUE}Step 6: Build Dependencies...${NC}"
if grep -A 100 '"dependencies"' package.json | grep -q '"babel-plugin-module-resolver"'; then
    echo -e "${GREEN}✅ babel-plugin-module-resolver in dependencies${NC}"
else
    echo -e "${RED}❌ babel-plugin-module-resolver must be in dependencies${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -A 100 '"dependencies"' package.json | grep -q '"babel-plugin-transform-remove-console"'; then
    echo -e "${GREEN}✅ babel-plugin-transform-remove-console in dependencies${NC}"
else
    echo -e "${RED}❌ babel-plugin-transform-remove-console must be in dependencies${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 7. TypeScript check
echo -e "${BLUE}Step 7: TypeScript Compilation...${NC}"
if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found!${NC}"
    npm run typecheck 2>&1 | grep "error TS" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
fi
echo ""

# 8. Check Expo dev client
echo -e "${BLUE}Step 8: Expo Configuration...${NC}"
if grep -q '"developmentClient".*true' app.json || grep -q '"expo-dev-client"' package.json; then
    echo -e "${GREEN}✅ Dev client configured${NC}"
else
    echo -e "${YELLOW}⚠️  Dev client check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

EXPO_VERSION=$(npx expo --version 2>/dev/null || echo "not installed")
echo -e "  Expo CLI Version: ${EXPO_VERSION}"
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 AUDIT SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ ALL CHECKS PASSED - APP IS READY! ✅✅✅${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Make sure you're running the latest dev client:"
        echo "     npx expo run:ios --device"
        echo "     OR"
        echo "     npx expo run:android"
        echo ""
        echo "  2. Test sample event posting:"
        echo "     - Navigate to a sample event (e.g., sample-warriors-cavaliers)"
        echo "     - Click 'Create Post'"
        echo "     - Add content/media and post"
        echo "     - Verify post appears on event page"
        echo ""
        echo "  3. Test coach onboarding:"
        echo "     - Sign in as new user"
        echo "     - Select 'Coach' role"
        echo "     - Complete all onboarding steps"
        echo ""
        echo "  4. Test uploads:"
        echo "     - Create post with image"
        echo "     - Create post with video"
        echo "     - Verify uploads work"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - App can proceed${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ AUDIT FAILED - $ERRORS ERROR(S) FOUND ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}FIX ERRORS ABOVE BEFORE RELEASE!${NC}"
    exit 1
fi
