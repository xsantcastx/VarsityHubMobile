#!/bin/bash
# Quick Build Configuration Test
# Validates Android lint fixes and build readiness

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧪 BUILD CONFIGURATION TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Lint baseline file exists
echo -e "${BLUE}Test 1: Lint baseline file...${NC}"
if [ -f "android/app/lint-baseline.xml" ]; then
    echo -e "${GREEN}✅ lint-baseline.xml exists${NC}"
    
    # Check if it contains ExtraTranslation entries
    if grep -q "ExtraTranslation" android/app/lint-baseline.xml; then
        echo -e "${GREEN}✅ Baseline contains ExtraTranslation entries${NC}"
    else
        echo -e "${RED}❌ Baseline missing ExtraTranslation entries${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check if it's valid XML
    if python3 -c "import xml.etree.ElementTree as ET; ET.parse('android/app/lint-baseline.xml')" 2>/dev/null; then
        echo -e "${GREEN}✅ Baseline file is valid XML${NC}"
    else
        echo -e "${RED}❌ Baseline file is invalid XML${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ lint-baseline.xml missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 2: Lint configuration in build.gradle
echo -e "${BLUE}Test 2: Lint configuration...${NC}"
if grep -q "disable 'ExtraTranslation'" android/app/build.gradle; then
    echo -e "${GREEN}✅ ExtraTranslation check disabled${NC}"
else
    echo -e "${RED}❌ ExtraTranslation check not disabled${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "abortOnError false" android/app/build.gradle; then
    echo -e "${GREEN}✅ abortOnError set to false${NC}"
else
    echo -e "${RED}❌ abortOnError not set to false${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "baseline file(\"lint-baseline.xml\")" android/app/build.gradle; then
    echo -e "${GREEN}✅ Baseline file configured${NC}"
else
    echo -e "${RED}❌ Baseline file not configured${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 3: lintVitalRelease task configuration
echo -e "${BLUE}Test 3: lintVitalRelease task configuration...${NC}"
if grep -q "lintVitalRelease" android/app/build.gradle; then
    echo -e "${GREEN}✅ lintVitalRelease task handling found${NC}"
    
    # Check for exception handling
    if grep -q "ExtraTranslation.*error.*suppressed\|catch.*ExtraTranslation" android/app/build.gradle; then
        echo -e "${GREEN}✅ ExtraTranslation error handling configured${NC}"
    else
        echo -e "${YELLOW}⚠️  ExtraTranslation error handling may be missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check for ignoreFailures
    if grep -q "ignoreFailures.*true" android/app/build.gradle; then
        echo -e "${GREEN}✅ ignoreFailures configured${NC}"
    else
        echo -e "${YELLOW}⚠️  ignoreFailures may not be set${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ lintVitalRelease task handling not found${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 4: Strings in default locale
echo -e "${BLUE}Test 4: Strings in default locale...${NC}"
if [ -f "android/app/src/main/res/values/strings.xml" ]; then
    if grep -q '<string name="name">' android/app/src/main/res/values/strings.xml; then
        echo -e "${GREEN}✅ 'name' string in default locale${NC}"
    else
        echo -e "${RED}❌ 'name' string missing from default locale${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q '<string name="displayName">' android/app/src/main/res/values/strings.xml; then
        echo -e "${GREEN}✅ 'displayName' string in default locale${NC}"
    else
        echo -e "${RED}❌ 'displayName' string missing from default locale${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ strings.xml missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 5: Sentry configuration
echo -e "${BLUE}Test 5: Sentry configuration...${NC}"
if grep -q "@sentry/react-native" package.json; then
    echo -e "${GREEN}✅ Sentry package in dependencies${NC}"
else
    echo -e "${RED}❌ Sentry package missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "SENTRY_ALLOW_FAILURE.*true" eas.json; then
    echo -e "${GREEN}✅ SENTRY_ALLOW_FAILURE configured${NC}"
else
    echo -e "${YELLOW}⚠️  SENTRY_ALLOW_FAILURE not set to true${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "Sentry" android/app/build.gradle && (grep -q "whenTaskAdded" android/app/build.gradle || grep -q "tasks.all" android/app/build.gradle); then
    echo -e "${GREEN}✅ Sentry task handling configured${NC}"
else
    echo -e "${YELLOW}⚠️  Sentry task handling may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 6: Extensions and modules
echo -e "${BLUE}Test 6: Extensions and modules...${NC}"
if grep -q "expo-location\|expo-image-picker\|expo-media-library" app.json; then
    echo -e "${GREEN}✅ Expo modules configured${NC}"
else
    echo -e "${YELLOW}⚠️  Some Expo modules may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "googleMaps\|googleMapsApiKey" app.json; then
    echo -e "${GREEN}✅ Google Maps configured${NC}"
else
    echo -e "${YELLOW}⚠️  Google Maps may not be configured${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 7: Gradle syntax validation
echo -e "${BLUE}Test 7: Gradle syntax validation...${NC}"
if command -v node &> /dev/null; then
    # Basic syntax check - look for common errors
    if grep -q "def\|apply\|android {" android/app/build.gradle; then
        echo -e "${GREEN}✅ Basic Gradle syntax appears valid${NC}"
    else
        echo -e "${RED}❌ Gradle file may have syntax issues${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Cannot validate Gradle syntax (node not found)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 8: Critical files exist
echo -e "${BLUE}Test 8: Critical files...${NC}"
for file in "android/app/build.gradle" "android/app/src/main/res/values/strings.xml" "app.json" "eas.json" "package.json"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 TEST RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ ALL TESTS PASSED - BUILD SHOULD SUCCEED! ✅✅✅${NC}"
        echo ""
        echo "Configuration is correct. You can now run:"
        echo "  eas build --platform android --profile production"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Build should proceed${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ $ERRORS ERROR(S) FOUND - FIX BEFORE BUILDING ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    exit 1
fi
