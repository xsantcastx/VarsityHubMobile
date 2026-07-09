#!/bin/bash
# Comprehensive Pre-Build Verification Script
# This script MUST pass before any EAS build to prevent wasted credits

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 COMPREHENSIVE PRE-BUILD VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to check and report
check_step() {
    local name=$1
    local command=$2
    echo -n "Checking $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

warn_step() {
    local name=$1
    local command=$2
    echo -n "Checking $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  WARNING${NC}"
        WARNINGS=$((WARNINGS + 1))
        return 1
    fi
}

# 1. TypeScript Compilation
echo -e "${BLUE}📝 TypeScript & Type Checking${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found!${NC}"
    npm run typecheck 2>&1 | grep "error TS" | head -10
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
fi
echo ""

# 2. Linting (warnings are OK, but check for errors)
echo -e "${BLUE}🔍 Linting${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

LINT_OUTPUT=$(npm run lint 2>&1 || true)
if echo "$LINT_OUTPUT" | grep -Eq "[1-9][0-9]* errors?"; then
    echo -e "${RED}❌ Linting errors found!${NC}"
    echo "$LINT_OUTPUT" | grep -E "[1-9][0-9]* errors?" | head -10
    ERRORS=$((ERRORS + 1))
else
    WARN_COUNT=$(echo "$LINT_OUTPUT" | grep -oE "[0-9]+ warnings?" | tail -1 | grep -oE "[0-9]+" || echo "0")
    if [ -n "$WARN_COUNT" ] && [ "$WARN_COUNT" -gt 0 ] 2>/dev/null; then
        echo -e "${YELLOW}⚠️  $WARN_COUNT linting warnings (non-blocking)${NC}"
        WARNINGS=$((WARNINGS + WARN_COUNT))
    else
        echo -e "${GREEN}✅ No linting issues${NC}"
    fi
fi
echo ""

# 3. Required Files Check
echo -e "${BLUE}📁 Required Files & Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_step "app.json exists" "test -f app.json"
check_step "eas.json exists" "test -f eas.json"
check_step "package.json exists" "test -f package.json"
check_step "tsconfig.json exists" "test -f tsconfig.json"
check_step "android/app/build.gradle exists" "test -f android/app/build.gradle"
check_step "ios/Podfile exists" "test -f ios/Podfile"
echo ""

# 4. App Configuration Validation
echo -e "${BLUE}⚙️  App Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check app.json is valid JSON
if node -e "JSON.parse(require('fs').readFileSync('app.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ app.json is valid JSON${NC}"
else
    echo -e "${RED}❌ app.json is invalid JSON${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check eas.json is valid JSON
if node -e "JSON.parse(require('fs').readFileSync('eas.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ eas.json is valid JSON${NC}"
else
    echo -e "${RED}❌ eas.json is invalid JSON${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check required app.json fields
if grep -q '"name":' app.json && grep -q '"slug":' app.json && grep -q '"version":' app.json; then
    echo -e "${GREEN}✅ app.json has required fields (name, slug, version)${NC}"
else
    echo -e "${RED}❌ app.json missing required fields${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Sentry configuration
if grep -q '"organization":' app.json && grep -q '"project":' app.json; then
    echo -e "${GREEN}✅ Sentry plugin configured${NC}"
else
    echo -e "${YELLOW}⚠️  Sentry plugin may not be fully configured${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 5. Android Configuration
echo -e "${BLUE}🤖 Android Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_step "Android build.gradle exists" "test -f android/app/build.gradle"
check_step "Android manifest exists" "test -f android/app/src/main/AndroidManifest.xml"

# Check for critical Android config
if grep -q "namespace.*com.varsityhub.varsityhub" android/app/build.gradle; then
    echo -e "${GREEN}✅ Android namespace configured${NC}"
else
    echo -e "${RED}❌ Android namespace not found (expected com.varsityhub.varsityhub)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Sentry Android config
if grep -q "sentry.gradle" android/app/build.gradle && grep -q "defaults.org=lime-productions" android/sentry.properties && grep -q "defaults.project=varsityhub" android/sentry.properties; then
    echo -e "${GREEN}✅ Sentry Android configuration present${NC}"
else
    echo -e "${YELLOW}⚠️  Sentry Android configuration may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 6. iOS Configuration
echo -e "${BLUE}🍎 iOS Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_step "iOS Podfile exists" "test -f ios/Podfile"
check_step "iOS project exists" "test -d ios/VarsityHub.xcodeproj"

# Check bundle identifier
if grep -q "com.varsithub.varsityhub-ios" ios/VarsityHub.xcodeproj/project.pbxproj 2>/dev/null || grep -q "com.varsithub.varsityhub-ios" app.json; then
    echo -e "${GREEN}✅ iOS bundle identifier configured${NC}"
else
    echo -e "${YELLOW}⚠️  iOS bundle identifier check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 7. Dependencies Check
echo -e "${BLUE}📦 Dependencies${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_step "node_modules exists" "test -d node_modules"
check_step "Package lock exists" "test -f package-lock.json"

# Check critical dependencies
if grep -q "@sentry/react-native" package.json; then
    echo -e "${GREEN}✅ Sentry package installed${NC}"
else
    echo -e "${RED}❌ Sentry package missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "expo" package.json; then
    echo -e "${GREEN}✅ Expo SDK installed${NC}"
else
    echo -e "${RED}❌ Expo SDK missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 8. Environment Variables Check
echo -e "${BLUE}🔐 Environment Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
    
    if grep -q "EXPO_PUBLIC_SENTRY_DSN" .env && ! grep -q "EXPO_PUBLIC_SENTRY_DSN=\"\"" .env; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_SENTRY_DSN configured${NC}"
    else
        echo -e "${YELLOW}⚠️  EXPO_PUBLIC_SENTRY_DSN may not be set${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  .env file not found (may use EAS secrets)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Sentry source-of-truth configuration
if grep -q '"organization": "lime-productions"' app.json && grep -q '"project": "varsityhub"' app.json && grep -q "defaults.org=lime-productions" android/sentry.properties && grep -q "defaults.project=varsityhub" android/sentry.properties && grep -q "defaults.org=lime-productions" ios/sentry.properties && grep -q "defaults.project=varsityhub" ios/sentry.properties; then
    echo -e "${GREEN}✅ Repo-managed Sentry configuration present${NC}"
else
    echo -e "${RED}❌ Repo-managed Sentry configuration missing or inconsistent${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 9. Critical Code Paths
echo -e "${BLUE}🔑 Critical Code Paths${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_step "Sentry initialization exists" "test -f utils/sentry.ts"
check_step "App layout exists" "test -f app/_layout.tsx"
check_step "Error boundary exists" "test -f components/ErrorBoundary.tsx"

# Check Sentry is initialized in app
if grep -q "initSentry" app/_layout.tsx; then
    echo -e "${GREEN}✅ Sentry initialized in app${NC}"
else
    echo -e "${RED}❌ Sentry not initialized in app${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 10. Build Configuration
echo -e "${BLUE}🏗️  Build Configuration${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check EAS build profiles
if grep -q '"production":' eas.json && grep -q '"preview":' eas.json && grep -q '"development":' eas.json; then
    echo -e "${GREEN}✅ EAS build profiles configured${NC}"
else
    echo -e "${RED}❌ EAS build profiles incomplete${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Android build type
if grep -q '"buildType":.*"app-bundle"' eas.json; then
    echo -e "${GREEN}✅ Android production build type configured${NC}"
else
    echo -e "${YELLOW}⚠️  Android build type check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED - Ready for build!${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS warning(s) found (non-blocking)${NC}"
    echo -e "${GREEN}✅ No errors - Build can proceed${NC}"
    exit 0
else
    echo -e "${RED}❌ $ERRORS error(s) found - BUILD BLOCKED${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}Fix the errors above before building to avoid wasting EAS credits!${NC}"
    exit 1
fi
