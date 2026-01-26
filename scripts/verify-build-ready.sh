#!/bin/bash
# Comprehensive Build Readiness Verification
# This MUST pass before any EAS build to prevent wasted credits

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 BUILD READINESS VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run pre-build verification
echo -e "${BLUE}Step 1: Running pre-build checks...${NC}"
if bash scripts/pre-build-verify.sh; then
    echo -e "${GREEN}✅ Pre-build checks passed${NC}"
else
    echo -e "${RED}❌ Pre-build checks failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# TypeScript check
echo -e "${BLUE}Step 2: TypeScript compilation...${NC}"
if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found!${NC}"
    npm run typecheck 2>&1 | grep "error TS" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
fi
echo ""

# Critical file checks
echo -e "${BLUE}Step 3: Critical files verification...${NC}"
MISSING_FILES=0
for file in "app.json" "eas.json" "package.json" "tsconfig.json" "android/app/build.gradle" "ios/Podfile"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        MISSING_FILES=$((MISSING_FILES + 1))
    fi
done
if [ $MISSING_FILES -eq 0 ]; then
    echo -e "${GREEN}✅ All critical files present${NC}"
else
    ERRORS=$((ERRORS + MISSING_FILES))
fi
echo ""

# JSON validation
echo -e "${BLUE}Step 4: Configuration file validation...${NC}"
if node -e "JSON.parse(require('fs').readFileSync('app.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ app.json is valid JSON${NC}"
else
    echo -e "${RED}❌ app.json is invalid JSON${NC}"
    ERRORS=$((ERRORS + 1))
fi

if node -e "JSON.parse(require('fs').readFileSync('eas.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ eas.json is valid JSON${NC}"
else
    echo -e "${RED}❌ eas.json is invalid JSON${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Sentry configuration
echo -e "${BLUE}Step 5: Sentry configuration...${NC}"
if grep -q '"organization":.*"varsity-hub"' app.json && grep -q '"project":.*"varsity-hub-mobile"' app.json; then
    echo -e "${GREEN}✅ Sentry plugin configured${NC}"
else
    echo -e "${RED}❌ Sentry plugin not configured${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "SENTRY_ORG" eas.json && grep -q "SENTRY_PROJECT" eas.json; then
    echo -e "${GREEN}✅ EAS Sentry config present${NC}"
else
    echo -e "${RED}❌ EAS Sentry config missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Android build config
echo -e "${BLUE}Step 6: Android build configuration...${NC}"
if grep -q "namespace.*com.varsithub.varsityhub" android/app/build.gradle; then
    echo -e "${GREEN}✅ Android namespace configured${NC}"
else
    echo -e "${RED}❌ Android namespace missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "SENTRY_AUTH_TOKEN" android/app/build.gradle; then
    echo -e "${GREEN}✅ Sentry Android config present${NC}"
else
    echo -e "${YELLOW}⚠️  Sentry Android config check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# iOS configuration
echo -e "${BLUE}Step 7: iOS configuration...${NC}"
if [ -f "ios/Podfile" ] && [ -d "ios/VarsityHub.xcodeproj" ]; then
    echo -e "${GREEN}✅ iOS project structure present${NC}"
else
    echo -e "${YELLOW}⚠️  iOS project structure check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Dependencies
echo -e "${BLUE}Step 8: Dependencies check...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
else
    echo -e "${RED}❌ node_modules missing - run: npm install${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "@sentry/react-native" package.json; then
    echo -e "${GREEN}✅ Sentry package installed${NC}"
else
    echo -e "${RED}❌ Sentry package missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Babel plugins are in dependencies (not devDependencies) for production builds
if grep -A 100 '"dependencies"' package.json | grep -q '"babel-plugin-module-resolver"'; then
    echo -e "${GREEN}✅ babel-plugin-module-resolver in dependencies${NC}"
else
    echo -e "${RED}❌ babel-plugin-module-resolver must be in dependencies (not devDependencies)${NC}"
    echo -e "${RED}   EAS builds with NODE_ENV=production may skip devDependencies${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -A 100 '"dependencies"' package.json | grep -q '"babel-plugin-transform-remove-console"'; then
    echo -e "${GREEN}✅ babel-plugin-transform-remove-console in dependencies${NC}"
else
    echo -e "${RED}❌ babel-plugin-transform-remove-console must be in dependencies (not devDependencies)${NC}"
    echo -e "${RED}   Required for production builds${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 FINAL VERIFICATION RESULT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ ALL CHECKS PASSED - READY FOR BUILD! ✅✅✅${NC}"
        echo ""
        echo "You can now safely run:"
        echo "  eas build --platform android --profile production"
        echo "  eas build --platform ios --profile production"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Build can proceed${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ BUILD BLOCKED - $ERRORS ERROR(S) FOUND ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}FIX ERRORS ABOVE BEFORE BUILDING TO AVOID WASTING EAS CREDITS!${NC}"
    exit 1
fi
