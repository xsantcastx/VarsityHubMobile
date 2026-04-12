#!/bin/bash
# Verify Sentry Configuration
# This script checks if Sentry is properly configured for builds

set -e

echo "🔍 Verifying Sentry Configuration..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

EAS_ENV_CACHE=""
if command -v eas &> /dev/null; then
    EAS_ENV_CACHE=$(eas env:list --environment production 2>/dev/null || true)
fi

has_eas_env() {
    local key="$1"
    [ -n "$EAS_ENV_CACHE" ] && echo "$EAS_ENV_CACHE" | grep -q "^${key}="
}

# Check 1: Sentry packages installed
echo "1. Checking Sentry packages..."
if grep -q "@sentry/react-native" package.json; then
    echo -e "${GREEN}✅ @sentry/react-native found in package.json${NC}"
else
    echo -e "${RED}❌ @sentry/react-native NOT found in package.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "@sentry/node" server/package.json; then
    echo -e "${GREEN}✅ @sentry/node found in server/package.json${NC}"
else
    echo -e "${RED}❌ @sentry/node NOT found in server/package.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check 2: Sentry properties files
echo "2. Checking Sentry properties files..."
if [ -f "android/sentry.properties" ]; then
    echo -e "${GREEN}✅ android/sentry.properties exists${NC}"
    if grep -q "varsity-hub" android/sentry.properties; then
        echo -e "${GREEN}   ✅ Organization configured: varsity-hub${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Organization may not be configured correctly${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ android/sentry.properties NOT found${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "ios/sentry.properties" ]; then
    echo -e "${GREEN}✅ ios/sentry.properties exists${NC}"
else
    echo -e "${RED}❌ ios/sentry.properties NOT found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check 3: Sentry DSN configuration
echo "3. Checking Sentry DSN..."
if has_eas_env "EXPO_PUBLIC_SENTRY_DSN"; then
    echo -e "${GREEN}✅ EXPO_PUBLIC_SENTRY_DSN configured in EAS production env${NC}"
elif grep -q "EXPO_PUBLIC_SENTRY_DSN" .env 2>/dev/null; then
    DSN=$(grep "EXPO_PUBLIC_SENTRY_DSN" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'")
    if [[ "$DSN" == *"sentry.io"* ]] && [[ "$DSN" != *"your-key"* ]]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_SENTRY_DSN configured in .env${NC}"
        echo -e "   DSN: ${DSN:0:50}..."
    else
        echo -e "${YELLOW}⚠️  EXPO_PUBLIC_SENTRY_DSN may be a placeholder${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  EXPO_PUBLIC_SENTRY_DSN not found in .env${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Check 4: EAS configuration
echo "4. Checking EAS configuration..."
if grep -q "SENTRY_ORG" eas.json; then
    echo -e "${GREEN}✅ SENTRY_ORG configured in eas.json${NC}"
else
    echo -e "${RED}❌ SENTRY_ORG NOT found in eas.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "SENTRY_PROJECT" eas.json; then
    echo -e "${GREEN}✅ SENTRY_PROJECT configured in eas.json${NC}"
else
    echo -e "${RED}❌ SENTRY_PROJECT NOT found in eas.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check 5: Build configuration
echo "5. Checking build configuration..."
if grep -q "@sentry/react-native/expo" app.json && [ -f "app.config.js" ]; then
    echo -e "${GREEN}✅ Expo Sentry plugin configured via app.json/app.config.js${NC}"
else
    echo -e "${RED}❌ Expo Sentry plugin/config bridge not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

if has_eas_env "SENTRY_AUTH_TOKEN"; then
    echo -e "${GREEN}✅ SENTRY_AUTH_TOKEN present in EAS production env${NC}"
else
    echo -e "${YELLOW}⚠️  SENTRY_AUTH_TOKEN not visible in EAS production env${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# Check 6: Sentry initialization
echo "6. Checking Sentry initialization..."
if [ -f "src/utils/sentry.ts" ]; then
    echo -e "${GREEN}✅ src/utils/sentry.ts exists${NC}"
    if grep -q "initSentry" app/_layout.tsx 2>/dev/null; then
        echo -e "${GREEN}   ✅ Sentry initialized in app/_layout.tsx${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Sentry may not be initialized in app${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ src/utils/sentry.ts NOT found${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "server/src/lib/sentry.ts" ]; then
    echo -e "${GREEN}✅ server/src/lib/sentry.ts exists${NC}"
else
    echo -e "${RED}❌ server/src/lib/sentry.ts NOT found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check 7: EAS Secrets (requires manual check)
echo "7. EAS Secrets Status:"
echo -e "${YELLOW}⚠️  Manual verification required${NC}"
echo ""
echo "   To check if SENTRY_AUTH_TOKEN is set in EAS:"
echo "   Run: eas env:list --environment production"
echo ""
echo "   To set SENTRY_AUTH_TOKEN if missing:"
echo "   Run: eas env:create --name SENTRY_AUTH_TOKEN --value <your-token> --environment production --visibility sensitive"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Sentry is properly configured.${NC}"
    echo ""
    echo "⚠️  IMPORTANT: Verify SENTRY_AUTH_TOKEN is set in EAS secrets:"
    echo "   eas env:list --environment production | grep SENTRY_AUTH_TOKEN"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Configuration looks good, but there are $WARNINGS warning(s).${NC}"
    echo ""
    echo "⚠️  IMPORTANT: Verify SENTRY_AUTH_TOKEN is set in EAS secrets:"
    echo "   eas env:list --environment production | grep SENTRY_AUTH_TOKEN"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo ""
    echo "Please fix the errors above before building."
    exit 1
fi
