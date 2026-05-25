#!/bin/bash
# Comprehensive Build Readiness Verification
# This MUST pass before any EAS build to prevent wasted credits

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

source "$(cd "$(dirname "$0")" && pwd)/android-java-env.sh"

ERRORS=0
WARNINGS=0

# Treat key warnings as errors to avoid wasting build credits
STRICT_MODE="${STRICT_MODE:-1}"
REQUIRE_CLEAN_GIT="${REQUIRE_CLEAN_GIT:-0}"

mark_warning_or_error() {
    local message="$1"
    if [ "$STRICT_MODE" -eq 1 ]; then
        echo -e "${RED}❌ $message${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${YELLOW}⚠️  $message${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
}

EAS_ENV_CACHE=""
if command -v eas &> /dev/null; then
    EAS_ENV_CACHE=$(eas env:list --environment production 2>/dev/null || true)
fi

get_eas_env_value() {
    local key="$1"
    if [ -n "$EAS_ENV_CACHE" ] && echo "$EAS_ENV_CACHE" | grep -q "$key"; then
        echo "__EAS_ENV_PRESENT__"
    else
        echo ""
    fi
}

get_eas_json_env_value() {
    local key="$1"
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
      const value = config?.build?.production?.env?.['$key'] || '';
      process.stdout.write(value);
    " 2>/dev/null || true
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 BUILD READINESS VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Secret literal scan
echo -e "${BLUE}Step 0: Secret literal scan...${NC}"
if npm run verify:secrets >/dev/null 2>&1; then
    echo -e "${GREEN}✅ No tracked secret literals detected${NC}"
else
    echo -e "${RED}❌ Secret literal scan failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
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

# Step 4b: Git cleanliness (helps avoid accidentally shipping uncommitted changes)
echo -e "${BLUE}Step 4b: Git status check...${NC}"
if command -v git &> /dev/null; then
    if git diff --quiet && git diff --cached --quiet; then
        echo -e "${GREEN}✅ Git working tree clean${NC}"
    elif [ "$REQUIRE_CLEAN_GIT" -eq 1 ]; then
        mark_warning_or_error "Uncommitted changes detected - consider committing before build"
    else
        echo -e "${YELLOW}⚠️  Uncommitted changes detected - consider committing before build${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    mark_warning_or_error "Git not found - skipping status check"
fi
echo ""

# Sentry configuration
echo -e "${BLUE}Step 5: Sentry configuration...${NC}"

# Check app.json Sentry plugin configuration
APP_ORG=$(grep -o '"organization": "[^"]*"' app.json | head -1 | cut -d'"' -f4)
APP_PROJECT=$(grep -o '"project": "[^"]*"' app.json | head -1 | cut -d'"' -f4)

if [ -n "$APP_ORG" ] && [ -n "$APP_PROJECT" ]; then
    if [ "$APP_ORG" = "lime-productions" ] && [ "$APP_PROJECT" = "varsityhub" ]; then
        echo -e "${GREEN}✅ Sentry plugin configured in app.json (lime-productions / varsityhub)${NC}"
    else
        echo -e "${RED}❌ Sentry plugin has incorrect values in app.json${NC}"
        echo -e "${RED}   Found: org='$APP_ORG', project='$APP_PROJECT'${NC}"
        echo -e "${RED}   Expected: org='lime-productions', project='varsityhub'${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Sentry plugin not configured in app.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check eas.json does NOT define SENTRY_ORG / SENTRY_PROJECT.
# Root-cause fix: repo files are the only source of truth; env overrides caused native builds
# to upload source maps against the wrong Sentry project.
if grep -q '"SENTRY_ORG"' eas.json || grep -q '"SENTRY_PROJECT"' eas.json; then
    echo -e "${RED}❌ eas.json must not define SENTRY_ORG / SENTRY_PROJECT${NC}"
    echo -e "${RED}   Use app.json/app.config.js + ios/android sentry.properties as the single source of truth.${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ eas.json does not override Sentry org/project${NC}"
fi
echo ""

# Android build config
echo -e "${BLUE}Step 6: Android build configuration...${NC}"
if grep -q "namespace.*com.xsantcastx.varsityhub" android/app/build.gradle; then
    echo -e "${GREEN}✅ Android namespace configured${NC}"
else
    echo -e "${RED}❌ Android namespace missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if ensure_android_java 17; then
    echo -e "${GREEN}✅ Android tooling can run with JDK 17${NC}"
else
    echo -e "${RED}❌ Android tooling requires JDK 17 locally (current Java is incompatible)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Android Sentry configuration
if grep -q "defaults.org=lime-productions" android/sentry.properties && grep -q "defaults.project=varsityhub" android/sentry.properties; then
    echo -e "${GREEN}✅ Android Sentry org/project configured in android/sentry.properties${NC}"
else
    echo -e "${RED}❌ Android Sentry org/project missing in android/sentry.properties${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Verify SENTRY_AUTH_TOKEN exists in EAS (user confirmed it should already exist)
# Note: Tokens are typically stored as secrets, not environment variables
SENTRY_TOKEN_FOUND=0
if command -v eas &> /dev/null; then
    EAS_SECRET_CACHE=$(eas secret:list 2>/dev/null || true)
    EAS_ENV_TOKEN_CACHE=$(eas env:list --environment production 2>/dev/null || true)
    if [ -z "$EAS_SECRET_CACHE" ] && [ -z "$EAS_ENV_TOKEN_CACHE" ]; then
        echo -e "${YELLOW}⚠️  Could not verify SENTRY_AUTH_TOKEN from EAS in the current shell${NC}"
        WARNINGS=$((WARNINGS + 1))
    # Check if token exists as a secret (most common)
    elif echo "$EAS_SECRET_CACHE" | grep -q "SENTRY_AUTH_TOKEN"; then
        echo -e "${GREEN}✅ SENTRY_AUTH_TOKEN found in EAS secrets${NC}"
        SENTRY_TOKEN_FOUND=1
    # Fallback: check environment variables
    elif echo "$EAS_ENV_TOKEN_CACHE" | grep -q "SENTRY_AUTH_TOKEN"; then
        echo -e "${GREEN}✅ SENTRY_AUTH_TOKEN found in EAS production environment${NC}"
        SENTRY_TOKEN_FOUND=1
    else
        echo -e "${RED}❌ SENTRY_AUTH_TOKEN not found in EAS (secrets/env)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  EAS CLI not found - cannot verify SENTRY_AUTH_TOKEN${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Validate native Sentry source of truth matches expected values
ANDROID_SENTRY_ORG=$(grep -o 'defaults.org=.*' android/sentry.properties | head -1 | cut -d'=' -f2)
ANDROID_SENTRY_PROJECT=$(grep -o 'defaults.project=.*' android/sentry.properties | head -1 | cut -d'=' -f2)
IOS_SENTRY_ORG=$(grep -o 'defaults.org=.*' ios/sentry.properties | head -1 | cut -d'=' -f2)
IOS_SENTRY_PROJECT=$(grep -o 'defaults.project=.*' ios/sentry.properties | head -1 | cut -d'=' -f2)

if [ -n "$ANDROID_SENTRY_ORG" ] && [ -n "$ANDROID_SENTRY_PROJECT" ] && [ -n "$IOS_SENTRY_ORG" ] && [ -n "$IOS_SENTRY_PROJECT" ]; then
    if [ "$ANDROID_SENTRY_ORG" = "lime-productions" ] && [ "$ANDROID_SENTRY_PROJECT" = "varsityhub" ] && [ "$IOS_SENTRY_ORG" = "lime-productions" ] && [ "$IOS_SENTRY_PROJECT" = "varsityhub" ]; then
        echo -e "${GREEN}✅ Native Sentry org/project configured correctly (lime-productions / varsityhub)${NC}"
    else
        echo -e "${RED}❌ Native Sentry org/project mismatch!${NC}"
        echo -e "${RED}   Android: org='$ANDROID_SENTRY_ORG', project='$ANDROID_SENTRY_PROJECT'${NC}"
        echo -e "${RED}   iOS: org='$IOS_SENTRY_ORG', project='$IOS_SENTRY_PROJECT'${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Native Sentry org/project missing in sentry.properties${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Android Sentry Gradle integration
if grep -q "sentry.gradle" android/app/build.gradle 2>/dev/null; then
    echo -e "${GREEN}✅ Android Sentry Gradle integration configured${NC}"
else
    echo -e "${YELLOW}⚠️  Android Sentry Gradle integration may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# iOS configuration
echo -e "${BLUE}Step 7: iOS configuration...${NC}"
if [ -f "ios/Podfile" ] && [ -d "ios/VarsityHub.xcodeproj" ]; then
    echo -e "${GREEN}✅ iOS project structure present${NC}"
else
    mark_warning_or_error "iOS project structure missing (ios/Podfile or ios/VarsityHub.xcodeproj)"
fi

# Check iOS Sentry configuration
if grep -q "defaults.org=lime-productions" ios/sentry.properties && grep -q "defaults.project=varsityhub" ios/sentry.properties; then
    echo -e "${GREEN}✅ iOS Sentry org/project configured in ios/sentry.properties${NC}"
else
    echo -e "${RED}❌ iOS Sentry org/project missing in ios/sentry.properties${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check if Sentry script is in Xcode build phase
if grep -q "sentry-xcode.sh" ios/VarsityHub.xcodeproj/project.pbxproj 2>/dev/null; then
    echo -e "${GREEN}✅ Sentry Xcode script detected${NC}"
else
    echo -e "${YELLOW}⚠️  Sentry Xcode build script not found — source maps may not upload${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Final Sentry validation summary
if [ $SENTRY_TOKEN_FOUND -eq 1 ] && [ "$ANDROID_SENTRY_ORG" = "lime-productions" ] && [ "$ANDROID_SENTRY_PROJECT" = "varsityhub" ] && [ "$IOS_SENTRY_ORG" = "lime-productions" ] && [ "$IOS_SENTRY_PROJECT" = "varsityhub" ]; then
    echo -e "${GREEN}✅ Sentry configuration validated${NC}"
    echo -e "${BLUE}   Note: If builds fail with 'Project not found', verify:${NC}"
    echo -e "${BLUE}   1. Project 'varsityhub' exists in Sentry org 'lime-productions'${NC}"
    echo -e "${BLUE}   2. SENTRY_AUTH_TOKEN has 'project:write' and 'project:read' scopes${NC}"
    echo -e "${BLUE}   3. No stale SENTRY_ORG / SENTRY_PROJECT env overrides exist in EAS${NC}"
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

# Critical blockers check (from READINESS_CHECKLIST)
echo -e "${BLUE}Step 9: Critical blockers verification...${NC}"

# Google Maps API Key check (env-driven config supported)
MAPS_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '')" 2>/dev/null)
MAPS_KEY_FROM_EAS=0
if [ -z "$MAPS_KEY" ] || [ "$MAPS_KEY" = "" ]; then
    MAPS_KEY=$(get_eas_env_value "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY")
    if [ "$MAPS_KEY" = "__EAS_ENV_PRESENT__" ]; then
        MAPS_KEY_FROM_EAS=1
    fi
fi

ANDROID_PLACEHOLDER_OK=0
IOS_PLACEHOLDER_OK=0
if grep -q 'com.google.android.geo.API_KEY' android/app/src/main/AndroidManifest.xml 2>/dev/null && grep -q '\${GOOGLE_MAPS_API_KEY}' android/app/src/main/AndroidManifest.xml 2>/dev/null; then
    ANDROID_PLACEHOLDER_OK=1
fi
if grep -q 'GOOGLE_MAPS_API_KEY' ios/VarsityHub.xcodeproj/project.pbxproj 2>/dev/null && grep -q '\$(GOOGLE_MAPS_API_KEY)' ios/VarsityHub/Info.plist 2>/dev/null; then
    IOS_PLACEHOLDER_OK=1
fi

if [ "$MAPS_KEY_FROM_EAS" -eq 1 ] || [ -n "$MAPS_KEY" ] || { [ "$ANDROID_PLACEHOLDER_OK" -eq 1 ] && [ "$IOS_PLACEHOLDER_OK" -eq 1 ]; }; then
    echo -e "${GREEN}✅ Google Maps API key configured (env-driven)${NC}"
else
    mark_warning_or_error "Google Maps API key not configured (set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in EAS env/secrets)"
fi

# Apple submission info check
if grep -q '"appleId":' eas.json && grep -q '"ascAppId":' eas.json; then
    APPLE_ID=$(grep -o '"appleId": "[^"]*"' eas.json | cut -d'"' -f4)
    ASC_APP_ID=$(grep -o '"ascAppId": "[^"]*"' eas.json | cut -d'"' -f4)
    if [ -n "$APPLE_ID" ] && [ -n "$ASC_APP_ID" ] && [ "$APPLE_ID" != "your-email@gmail.com" ] && [ "$ASC_APP_ID" != "1234567890" ]; then
        echo -e "${GREEN}✅ Apple submission info configured (appleId, ascAppId)${NC}"
    else
        mark_warning_or_error "Apple submission info may contain placeholders"
    fi
else
    echo -e "${RED}❌ Apple submission info missing in eas.json${NC}"
    echo -e "${RED}   Required for App Store submission${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Android service account key check
if grep -q '"serviceAccountKeyPath":' eas.json; then
    SERVICE_ACCOUNT_PATH=$(grep -o '"serviceAccountKeyPath": "[^"]*"' eas.json | cut -d'"' -f4)
    if [ -n "$SERVICE_ACCOUNT_PATH" ] && [ -f "$SERVICE_ACCOUNT_PATH" ]; then
        echo -e "${GREEN}✅ Android service account key file exists${NC}"
        if node scripts/verify-play-service-account.js >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Android Play submit service account has Android Publisher access${NC}"
        else
            mark_warning_or_error "Android service account is present but cannot access Android Publisher for com.xsantcastx.varsityhub"
        fi
    else
        echo -e "${YELLOW}⚠️  Android service account key file not found at: $SERVICE_ACCOUNT_PATH (only needed for Play Store submission)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Android service account key path not configured (only needed for Play Store submission)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Apple Team ID check
if grep -q '"appleTeamId":' app.json; then
    APPLE_TEAM_ID=$(grep -o '"appleTeamId": "[^"]*"' app.json | cut -d'"' -f4)
    if [ -n "$APPLE_TEAM_ID" ] && [ "$APPLE_TEAM_ID" != "YOUR_TEAM_ID" ]; then
        echo -e "${GREEN}✅ Apple Team ID configured${NC}"
    else
        mark_warning_or_error "Apple Team ID may be placeholder"
    fi
else
    mark_warning_or_error "Apple Team ID not found in app.json"
fi
echo ""

# Step 10: Expo Doctor & Dependency checks
echo -e "${BLUE}Step 10: Expo Doctor & Dependency checks...${NC}"

# 1) Invalid app.json properties for Expo SDK 54
INVALID_PROPS=0
for prop in "homepage" "privacy" "supportURL"; do
    if grep -q "\"$prop\":" app.json; then
        echo -e "${RED}❌ Invalid property '$prop' in app.json (not supported in Expo SDK 54)${NC}"
        INVALID_PROPS=$((INVALID_PROPS + 1))
        ERRORS=$((ERRORS + 1))
    fi
done
if [ $INVALID_PROPS -eq 0 ]; then
    echo -e "${GREEN}✅ No invalid app.json properties found${NC}"
fi

# 2) Duplicate dependency check: react-native-safe-area-context
if command -v npm &> /dev/null; then
    SAFE_AREA_TREE=$(npm ls react-native-safe-area-context --all 2>&1 || true)
    if echo "$SAFE_AREA_TREE" | grep -q "deduped"; then
        echo -e "${GREEN}✅ react-native-safe-area-context is deduped${NC}"
    elif echo "$SAFE_AREA_TREE" | grep -q "react-native-safe-area-context@"; then
        VERSION_COUNT=$(echo "$SAFE_AREA_TREE" | grep -o "react-native-safe-area-context@" | wc -l | tr -d ' ')
        if [ "$VERSION_COUNT" -gt 1 ]; then
            mark_warning_or_error "Multiple react-native-safe-area-context versions detected (run: npm dedupe react-native-safe-area-context)"
        else
            echo -e "${GREEN}✅ No duplicate react-native-safe-area-context dependency found${NC}"
        fi
    else
        mark_warning_or_error "react-native-safe-area-context not found in npm tree"
    fi
else
    mark_warning_or_error "npm not found - cannot check duplicates"
fi

# 3) Package version alignment with Expo SDK 54
if command -v npx &> /dev/null; then
    echo -n "Checking Expo package versions... "
    EXPO_CHECK_OUTPUT=$(npx expo install --check -- --dry-run 2>&1 || true)
    if echo "$EXPO_CHECK_OUTPUT" | grep -q "Dependencies are up to date" || echo "$EXPO_CHECK_OUTPUT" | grep -q "All dependencies are up to date"; then
        echo -e "${GREEN}✅${NC}"
    else
        echo -e "${YELLOW}⚠️${NC}"
        mark_warning_or_error "Some packages may be out of sync with Expo SDK (run: npx expo install --check)"
        echo "$EXPO_CHECK_OUTPUT" | head -10
    fi
else
    mark_warning_or_error "Cannot check package versions (npx not found)"
fi

# 3a) Expo Doctor (use expo-doctor CLI)
if command -v npx &> /dev/null; then
    EXPO_DOCTOR_OUTPUT=$(npx expo-doctor 2>&1 || true)
    if [ -z "$EXPO_DOCTOR_OUTPUT" ]; then
        mark_warning_or_error "Expo Doctor produced no output (unexpected)"
    elif echo "$EXPO_DOCTOR_OUTPUT" | grep -qi "No issues found"; then
        echo -e "${GREEN}✅ Expo Doctor reports no issues${NC}"
    elif echo "$EXPO_DOCTOR_OUTPUT" | grep -qi "No issues detected"; then
        echo -e "${GREEN}✅ Expo Doctor reports no issues${NC}"
    elif echo "$EXPO_DOCTOR_OUTPUT" | grep -qi "found 0 issues"; then
        echo -e "${GREEN}✅ Expo Doctor reports no issues${NC}"
    else
        mark_warning_or_error "Expo Doctor reported issues"
        echo "$EXPO_DOCTOR_OUTPUT" | head -20
    fi
else
    mark_warning_or_error "Cannot run Expo Doctor (npx not found)"
fi

# 3b) Verify Sentry package is actually installed (not just in package.json)
if [ -d "node_modules/@sentry/react-native" ]; then
    echo -e "${GREEN}✅ @sentry/react-native package installed in node_modules${NC}"
elif [ -d "node_modules/sentry" ]; then
    mark_warning_or_error "Found node_modules/sentry (unexpected - should be @sentry/react-native)"
elif grep -q "@sentry/react-native" package.json; then
    echo -e "${RED}❌ @sentry/react-native in package.json but not installed in node_modules${NC}"
    echo -e "${RED}   Run: npm install${NC}"
    ERRORS=$((ERRORS + 1))
else
    mark_warning_or_error "Sentry package check skipped (not in package.json)"
fi

# 4) Dependency sync: ensure node_modules matches package-lock.json
if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
    if npm ci --dry-run 2>/dev/null | grep -q "would install"; then
        mark_warning_or_error "node_modules may be out of sync with package-lock.json (run: npm ci)"
    else
        echo -e "${GREEN}✅ node_modules matches package-lock.json${NC}"
    fi
elif [ ! -f "package-lock.json" ]; then
    mark_warning_or_error "package-lock.json missing - run: npm install"
elif [ ! -d "node_modules" ]; then
    echo -e "${RED}❌ node_modules missing - run: npm install${NC}"
    ERRORS=$((ERRORS + 1))
fi

# 5) .easignore presence to avoid large uploads
if [ -f ".easignore" ]; then
    echo -e "${GREEN}✅ .easignore exists${NC}"
else
    mark_warning_or_error ".easignore not found (may cause large uploads)"
fi

# 6) Large files that could slow EAS uploads (>50MB)
if command -v find &> /dev/null; then
    LARGE_FILES_LIST=$(find . -type f -size +50M \
        -not -path "./node_modules/*" \
        -not -path "./.git/*" \
        -not -path "./.claude/*" \
        -not -path "./ios/build/*" \
        -not -path "./android/build/*" \
        -not -path "./android/.gradle/*" \
        -not -path "./android/app/build/*" \
        -not -path "./android/app/.cxx/*" \
        -not -path "./ios/Pods/*" \
        -not -path "./server/*" \
        -not -path "./.snyk-cache/*" \
        -not -name "*.tar.gz" \
        -not -name "*.tar" \
        -not -name "*.tgz" \
        2>/dev/null | sort)
    LARGE_FILES=$(echo "$LARGE_FILES_LIST" | sed '/^$/d' | wc -l | tr -d ' ')
    if [ "$LARGE_FILES" -gt 0 ]; then
        mark_warning_or_error "Found $LARGE_FILES large file(s) (>50MB) that may slow uploads"
        echo -e "${YELLOW}   Top offenders:${NC}"
        echo "$LARGE_FILES_LIST" | head -10 | sed 's/^/   - /'
    else
        echo -e "${GREEN}✅ No unusually large files detected (excluding .easignore patterns)${NC}"
    fi
fi
echo ""

# Step 11: Environment Variables Validation
echo -e "${BLUE}Step 11: Environment variables validation...${NC}"

# Check EXPO_PUBLIC_SENTRY_DSN (check both app.json and .env)
SENTRY_DSN="${EXPO_PUBLIC_SENTRY_DSN:-}"
SENTRY_DSN_FROM_EAS=0
if [ -z "$SENTRY_DSN" ] || [ "$SENTRY_DSN" = "" ]; then
    SENTRY_DSN=$(get_eas_json_env_value "EXPO_PUBLIC_SENTRY_DSN")
fi
if [ -z "$SENTRY_DSN" ] || [ "$SENTRY_DSN" = "" ]; then
    SENTRY_DSN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_SENTRY_DSN || '')" 2>/dev/null)
fi
if [ -z "$SENTRY_DSN" ] || [ "$SENTRY_DSN" = "" ]; then
    # Fallback to .env file
    if [ -f ".env" ]; then
        SENTRY_DSN=$(grep "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
    fi
fi
if [ -z "$SENTRY_DSN" ] || [ "$SENTRY_DSN" = "" ]; then
    SENTRY_DSN=$(get_eas_env_value "EXPO_PUBLIC_SENTRY_DSN")
    if [ "$SENTRY_DSN" = "__EAS_ENV_PRESENT__" ]; then
        SENTRY_DSN_FROM_EAS=1
    fi
fi

if [ -n "$SENTRY_DSN" ] && [ "$SENTRY_DSN" != "" ]; then
    if [ "$SENTRY_DSN_FROM_EAS" -eq 1 ]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_SENTRY_DSN is set in EAS env${NC}"
    elif [[ "$SENTRY_DSN" =~ ^https://.*@.*\.ingest\..*sentry\.io ]]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_SENTRY_DSN is configured and valid format${NC}"
    else
        mark_warning_or_error "EXPO_PUBLIC_SENTRY_DSN format may be invalid"
    fi
else
    mark_warning_or_error "EXPO_PUBLIC_SENTRY_DSN is empty (checked app.json and .env)"
fi

# Check EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (check both app.json and .env)
STRIPE_KEY="${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
STRIPE_KEY_FROM_EAS=0
if [ -z "$STRIPE_KEY" ] || [ "$STRIPE_KEY" = "" ]; then
    STRIPE_KEY=$(get_eas_json_env_value "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY")
fi
if [ -z "$STRIPE_KEY" ] || [ "$STRIPE_KEY" = "" ]; then
    STRIPE_KEY=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')" 2>/dev/null)
fi
if [ -z "$STRIPE_KEY" ] || [ "$STRIPE_KEY" = "" ]; then
    # Fallback to .env file
    if [ -f ".env" ]; then
        STRIPE_KEY=$(grep "^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo "")
    fi
fi
if [ -z "$STRIPE_KEY" ] || [ "$STRIPE_KEY" = "" ]; then
    STRIPE_KEY=$(get_eas_env_value "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    if [ "$STRIPE_KEY" = "__EAS_ENV_PRESENT__" ]; then
        STRIPE_KEY_FROM_EAS=1
    fi
fi

if [ -n "$STRIPE_KEY" ] && [ "$STRIPE_KEY" != "" ]; then
    if [ "$STRIPE_KEY_FROM_EAS" -eq 1 ]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is set in EAS env${NC}"
    elif [[ "$STRIPE_KEY" =~ ^pk_(test|live)_ ]]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is configured${NC}"
        if [[ "$STRIPE_KEY" =~ ^pk_test_ ]]; then
            mark_warning_or_error "Stripe key is TEST mode - switch to live for production"
        fi
    else
        mark_warning_or_error "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY format may be invalid"
    fi
else
    if [ -n "$CI" ]; then
        echo -e "${YELLOW}⚠️  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not visible to CI (checked workflow env, eas.json, app.json, and .env)${NC}"
        echo -e "${YELLOW}   Verify it exists in the actual EAS/GitHub build environment before shipping a store build.${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        mark_warning_or_error "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is empty (checked app.json and .env)"
    fi
fi

# Check API URL is configured
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_API_URL || '')" 2>/dev/null)
API_URL_FROM_EAS=0
if [ -z "$API_URL" ] || [ "$API_URL" = "" ]; then
    API_URL=$(get_eas_env_value "EXPO_PUBLIC_API_URL")
    if [ "$API_URL" = "__EAS_ENV_PRESENT__" ]; then
        API_URL_FROM_EAS=1
    fi
fi
if [ -n "$API_URL" ] && [ "$API_URL" != "" ]; then
    if [ "$API_URL_FROM_EAS" -eq 1 ]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_API_URL is set in EAS env${NC}"
    elif [[ "$API_URL" =~ ^https:// ]]; then
        echo -e "${GREEN}✅ EXPO_PUBLIC_API_URL is configured (HTTPS)${NC}"
    else
        mark_warning_or_error "EXPO_PUBLIC_API_URL is not HTTPS - may cause issues"
    fi
else
    echo -e "${RED}❌ EXPO_PUBLIC_API_URL is empty - app will not function${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Google Client IDs are configured
GOOGLE_ANDROID_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '')" 2>/dev/null)
GOOGLE_IOS_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '')" 2>/dev/null)
if [ -n "$GOOGLE_ANDROID_ID" ] && [ -n "$GOOGLE_IOS_ID" ]; then
    if [[ "$GOOGLE_ANDROID_ID" =~ \.apps\.googleusercontent\.com$ ]] && [[ "$GOOGLE_IOS_ID" =~ \.apps\.googleusercontent\.com$ ]]; then
        echo -e "${GREEN}✅ Google OAuth Client IDs configured (Android & iOS)${NC}"
    else
        mark_warning_or_error "Google Client ID format may be invalid"
    fi
else
    mark_warning_or_error "Google OAuth Client IDs may be missing"
fi
echo ""

# Step 12: Email Format Validation
echo -e "${BLUE}Step 12: Email format validation...${NC}"

# Validate Apple ID email
APPLE_ID_EMAIL=$(grep -o '"appleId": "[^"]*"' eas.json | cut -d'"' -f4)
if [ -n "$APPLE_ID_EMAIL" ]; then
    if [[ "$APPLE_ID_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        echo -e "${GREEN}✅ Apple ID email format valid: $APPLE_ID_EMAIL${NC}"
    else
        echo -e "${RED}❌ Apple ID email format invalid: $APPLE_ID_EMAIL${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Apple ID email not found in eas.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Validate Admin emails
ADMIN_EMAILS=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_ADMIN_EMAILS || '')" 2>/dev/null)
if [ -n "$ADMIN_EMAILS" ] && [ "$ADMIN_EMAILS" != "" ]; then
    INVALID_EMAILS=0
    # Split by comma and validate each email
    IFS=',' read -ra EMAIL_ARRAY <<< "$ADMIN_EMAILS"
    for email in "${EMAIL_ARRAY[@]}"; do
        # Trim whitespace using parameter expansion
        email="${email#"${email%%[![:space:]]*}"}"
        email="${email%"${email##*[![:space:]]}"}"
        if [ -n "$email" ] && [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            mark_warning_or_error "Admin email format may be invalid: $email"
            INVALID_EMAILS=$((INVALID_EMAILS + 1))
        fi
    done
    if [ $INVALID_EMAILS -eq 0 ]; then
        echo -e "${GREEN}✅ Admin emails format valid: $ADMIN_EMAILS${NC}"
    else
        :
    fi
else
    mark_warning_or_error "EXPO_PUBLIC_ADMIN_EMAILS is empty"
fi
echo ""

# Step 13: Asset Files Verification
echo -e "${BLUE}Step 13: Asset files verification...${NC}"
MISSING_ASSETS=0

# Check icon
ICON_PATH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.icon || '')" 2>/dev/null)
if [ -n "$ICON_PATH" ] && [ -f "$ICON_PATH" ]; then
    echo -e "${GREEN}✅ App icon exists: $ICON_PATH${NC}"
else
    echo -e "${RED}❌ App icon missing: $ICON_PATH${NC}"
    MISSING_ASSETS=$((MISSING_ASSETS + 1))
fi

# Check splash screen
SPLASH_PATH=$(node -e "const c=JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.plugins; const s=c.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen'); console.log(s?s[1].image:'')" 2>/dev/null)
if [ -n "$SPLASH_PATH" ] && [ -f "$SPLASH_PATH" ]; then
    echo -e "${GREEN}✅ Splash screen exists: $SPLASH_PATH${NC}"
else
    echo -e "${RED}❌ Splash screen missing: $SPLASH_PATH${NC}"
    MISSING_ASSETS=$((MISSING_ASSETS + 1))
fi

# Check adaptive icon (Android)
ADAPTIVE_ICON=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.android.adaptiveIcon.foregroundImage || '')" 2>/dev/null)
if [ -n "$ADAPTIVE_ICON" ] && [ -f "$ADAPTIVE_ICON" ]; then
    echo -e "${GREEN}✅ Android adaptive icon exists: $ADAPTIVE_ICON${NC}"
else
    mark_warning_or_error "Android adaptive icon missing: $ADAPTIVE_ICON"
fi

# Check favicon
FAVICON_PATH=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.web.favicon || '')" 2>/dev/null)
if [ -n "$FAVICON_PATH" ] && [ -f "$FAVICON_PATH" ]; then
    echo -e "${GREEN}✅ Web favicon exists: $FAVICON_PATH${NC}"
else
    mark_warning_or_error "Web favicon missing: $FAVICON_PATH"
fi

if [ $MISSING_ASSETS -gt 0 ]; then
    ERRORS=$((ERRORS + MISSING_ASSETS))
fi
echo ""

# Step 14: Version Consistency
echo -e "${BLUE}Step 14: Version consistency check...${NC}"
APP_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.version || '')" 2>/dev/null)
RUNTIME_VERSION=$(node -e "
const v = JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.runtimeVersion;
if (!v) { console.log(''); }
else if (typeof v === 'string') { console.log(v); }
else if (v && v.policy) { console.log('__POLICY__:' + v.policy); }
else { console.log(''); }
" 2>/dev/null)
PKG_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version || '')" 2>/dev/null)

if [ -n "$APP_VERSION" ]; then
    echo -e "${GREEN}✅ App version: $APP_VERSION${NC}"
else
    echo -e "${RED}❌ App version not set in app.json${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -n "$RUNTIME_VERSION" ]; then
    case "$RUNTIME_VERSION" in
        __POLICY__:appVersion)
            echo -e "${GREEN}✅ Runtime version policy = appVersion (auto-derives from $APP_VERSION)${NC}"
            ;;
        __POLICY__:*)
            echo -e "${GREEN}✅ Runtime version policy = ${RUNTIME_VERSION#__POLICY__:}${NC}"
            ;;
        "$APP_VERSION")
            echo -e "${GREEN}✅ Runtime version matches app version: $RUNTIME_VERSION${NC}"
            ;;
        *)
            mark_warning_or_error "Runtime version ($RUNTIME_VERSION) differs from app version ($APP_VERSION)"
            ;;
    esac
else
    mark_warning_or_error "Runtime version not set (OTA updates may have issues)"
fi

if [ -n "$PKG_VERSION" ]; then
    if [ "$APP_VERSION" = "$PKG_VERSION" ]; then
        echo -e "${GREEN}✅ package.json version matches: $PKG_VERSION${NC}"
    else
        mark_warning_or_error "package.json version ($PKG_VERSION) differs from app.json ($APP_VERSION)"
    fi
fi
echo ""

# Step 15: EAS Project ID Validation
echo -e "${BLUE}Step 15: EAS Project ID validation...${NC}"
EAS_PROJECT_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.eas.projectId || '')" 2>/dev/null)
if [ -n "$EAS_PROJECT_ID" ]; then
    # UUID format: 8-4-4-4-12 hex characters
    if [[ "$EAS_PROJECT_ID" =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]; then
        echo -e "${GREEN}✅ EAS Project ID is valid UUID: $EAS_PROJECT_ID${NC}"
    else
        echo -e "${RED}❌ EAS Project ID format invalid: $EAS_PROJECT_ID${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ EAS Project ID not found in app.json${NC}"
    echo -e "${RED}   Run: eas init${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Validate owner matches Expo account
EXPO_OWNER=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.owner || '')" 2>/dev/null)
if [ -n "$EXPO_OWNER" ]; then
    echo -e "${GREEN}✅ Expo owner configured: $EXPO_OWNER${NC}"
else
    mark_warning_or_error "Expo owner not set in app.json"
fi
echo ""

# Step 16: Custom Plugins Verification
echo -e "${BLUE}Step 16: Custom plugins verification...${NC}"
MISSING_PLUGINS=0

for plugin in "plugins/withAndroidManifestCleanup" "plugins/withAndroidBuildConfig" "plugins/withGoogleMaps"; do
    # Check for .js or /index.js
    if [ -f "./$plugin.js" ] || [ -f "./$plugin/index.js" ]; then
        echo -e "${GREEN}✅ Plugin exists: $plugin${NC}"
    else
        echo -e "${RED}❌ Custom plugin missing: $plugin${NC}"
        MISSING_PLUGINS=$((MISSING_PLUGINS + 1))
    fi
done

if [ $MISSING_PLUGINS -gt 0 ]; then
    ERRORS=$((ERRORS + MISSING_PLUGINS))
fi
echo ""

# Step 17: Locale Files Verification
echo -e "${BLUE}Step 17: Locale files verification...${NC}"
LOCALES=$(node -e "const l=JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.locales; if(l){Object.entries(l).forEach(([k,v])=>console.log(v))}" 2>/dev/null)
if [ -n "$LOCALES" ]; then
    MISSING_LOCALES=0
    while IFS= read -r locale_file; do
        if [ -f "$locale_file" ]; then
            echo -e "${GREEN}✅ Locale file exists: $locale_file${NC}"
        else
            echo -e "${RED}❌ Locale file missing: $locale_file${NC}"
            MISSING_LOCALES=$((MISSING_LOCALES + 1))
        fi
    done <<< "$LOCALES"
    if [ $MISSING_LOCALES -gt 0 ]; then
        ERRORS=$((ERRORS + MISSING_LOCALES))
    fi
else
    echo -e "${YELLOW}⚠️  No locales configured (optional)${NC}"
fi
echo ""

# Step 18: API Connectivity Check (Optional - can be slow)
echo -e "${BLUE}Step 18: API connectivity check...${NC}"
if [ -n "$API_URL" ] && [ "$API_URL_FROM_EAS" -eq 1 ]; then
    mark_warning_or_error "API URL set in EAS env - cannot verify connectivity locally"
elif [ -n "$API_URL" ]; then
    # Quick health check with 5 second timeout
    if curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null | grep -q "200\|204\|301\|302"; then
        echo -e "${GREEN}✅ API server is reachable: $API_URL${NC}"
    elif curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$API_URL" 2>/dev/null | grep -qE "^[23]"; then
        echo -e "${GREEN}✅ API server is reachable: $API_URL${NC}"
    else
        mark_warning_or_error "Could not reach API server: $API_URL"
    fi
else
    mark_warning_or_error "Skipping API check - no URL configured"
fi
echo ""

# Step 19: Release Readiness Check (Roles, Onboarding, Rules)
echo -e "${BLUE}Step 19: Release readiness verification...${NC}"
if bash scripts/verify-release-readiness.sh 2>&1 | grep -q "BLOCKER\|ERROR"; then
    echo -e "${RED}❌ Release readiness check found blockers or errors${NC}"
    echo -e "${RED}   Run: bash scripts/verify-release-readiness.sh for details${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Release readiness checks passed${NC}"
fi
echo ""

# Step 20: Bundle ID Consistency Check
echo -e "${BLUE}Step 20: Bundle ID consistency check...${NC}"
IOS_BUNDLE_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.ios.bundleIdentifier || '')" 2>/dev/null)
ANDROID_PACKAGE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.android.package || '')" 2>/dev/null)

if [ -n "$IOS_BUNDLE_ID" ] && [ -n "$ANDROID_PACKAGE" ]; then
    # iOS 'com.varsithub.varsityhub-ios' and Android 'com.xsantcastx.varsityhub' are intentionally
    # different — the iOS ID is registered with Apple (legacy spelling). Validate each individually.
    if [ "$IOS_BUNDLE_ID" = "com.varsithub.varsityhub-ios" ]; then
        echo -e "${GREEN}✅ iOS bundle ID correct: $IOS_BUNDLE_ID${NC}"
    else
        echo -e "${RED}❌ iOS bundle ID unexpected: $IOS_BUNDLE_ID (expected com.varsithub.varsityhub-ios)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    if [ "$ANDROID_PACKAGE" = "com.xsantcastx.varsityhub" ]; then
        echo -e "${GREEN}✅ Android package correct: $ANDROID_PACKAGE${NC}"
    else
        echo -e "${RED}❌ Android package unexpected: $ANDROID_PACKAGE (expected com.xsantcastx.varsityhub)${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    if [ -z "$IOS_BUNDLE_ID" ]; then
        echo -e "${RED}❌ iOS bundleIdentifier not set${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    if [ -z "$ANDROID_PACKAGE" ]; then
        echo -e "${RED}❌ Android package not set${NC}"
        ERRORS=$((ERRORS + 1))
    fi
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
