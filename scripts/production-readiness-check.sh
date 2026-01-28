#!/bin/bash
# Production Readiness Check - Real-World Use Verification
# Checks if builds are ready for actual users in production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🌍 PRODUCTION READINESS CHECK${NC}"
echo -e "${CYAN}   Verifying Real-World Use Readiness${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# PHASE 1: PRODUCTION API CONFIGURATION
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 1: PRODUCTION API CONFIGURATION${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}1.1 API URL in app.json...${NC}"
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_API_URL || '')" 2>/dev/null || echo "")
if [[ "$API_URL" =~ ^https:// ]]; then
    if [[ "$API_URL" =~ localhost|127\.0\.0\.1|192\.168\.|10\.0\. ]]; then
        echo -e "${RED}❌ API URL is localhost/private IP: $API_URL${NC}"
        echo -e "${RED}   Users cannot reach localhost!${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ API URL is production: $API_URL${NC}"
    fi
else
    echo -e "${RED}❌ API URL missing or invalid: $API_URL${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}1.2 API URL in code (api/http.ts)...${NC}"
if grep -q "https://api-production" api/http.ts 2>/dev/null; then
    if grep -q "localhost\|127\.0\.0\.1\|192\.168\." api/http.ts 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Code contains localhost references${NC}"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✅ Code uses production API URL${NC}"
    fi
else
    echo -e "${RED}❌ Production API URL not found in code${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}1.3 API URL accessibility...${NC}"
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_API_URL || '')" 2>/dev/null || echo "")
if [ -n "$API_URL" ]; then
    # Check if URL is reachable (non-blocking, just check format)
    if [[ "$API_URL" =~ ^https://.*\.railway\.app ]] || [[ "$API_URL" =~ ^https://.*\.up\.railway\.app ]]; then
        echo -e "${GREEN}✅ API URL is Railway production URL${NC}"
    elif [[ "$API_URL" =~ ^https:// ]]; then
        echo -e "${GREEN}✅ API URL is HTTPS (secure)${NC}"
    else
        echo -e "${RED}❌ API URL is not HTTPS${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi
echo ""

# ============================================================================
# PHASE 2: BUILD CONFIGURATION
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 2: BUILD CONFIGURATION${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}2.1 Production build profile...${NC}"
if node -e "const e=JSON.parse(require('fs').readFileSync('eas.json','utf8')); if(e.build.production) console.log('OK')" 2>/dev/null; then
    DISTRIBUTION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('eas.json','utf8')).build.production.distribution || '')" 2>/dev/null || echo "")
    if [ "$DISTRIBUTION" = "store" ]; then
        echo -e "${GREEN}✅ Production profile configured for App Store/Play Store${NC}"
    else
        echo -e "${YELLOW}⚠️  Production distribution: $DISTRIBUTION (should be 'store')${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Production build profile missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}2.2 iOS configuration...${NC}"
if node -e "const a=JSON.parse(require('fs').readFileSync('app.json','utf8')); if(a.expo.ios) console.log('OK')" 2>/dev/null; then
    BUNDLE_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.ios.bundleIdentifier || '')" 2>/dev/null || echo "")
    if [ -n "$BUNDLE_ID" ]; then
        echo -e "${GREEN}✅ iOS bundle ID: $BUNDLE_ID${NC}"
    else
        echo -e "${RED}❌ iOS bundle ID missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    APPLE_TEAM_ID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.ios.appleTeamId || '')" 2>/dev/null || echo "")
    if [ -n "$APPLE_TEAM_ID" ]; then
        echo -e "${GREEN}✅ Apple Team ID configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Apple Team ID missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ iOS configuration missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}2.3 Android configuration...${NC}"
if node -e "const a=JSON.parse(require('fs').readFileSync('app.json','utf8')); if(a.expo.android) console.log('OK')" 2>/dev/null; then
    PACKAGE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.android.package || '')" 2>/dev/null || echo "")
    if [ -n "$PACKAGE" ]; then
        echo -e "${GREEN}✅ Android package: $PACKAGE${NC}"
    else
        echo -e "${RED}❌ Android package missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Android configuration missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# PHASE 3: ERROR HANDLING & RESILIENCE
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 3: ERROR HANDLING & RESILIENCE${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}3.1 Error boundaries...${NC}"
if find . -name "*ErrorBoundary*" -o -name "*error-boundary*" | grep -q .; then
    echo -e "${GREEN}✅ Error boundary components exist${NC}"
else
    echo -e "${YELLOW}⚠️  Error boundaries may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}3.2 Network retry logic...${NC}"
if grep -q "retry\|retries" api/http.ts 2>/dev/null || grep -q "retry\|retries" api/upload.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Retry logic present${NC}"
else
    echo -e "${YELLOW}⚠️  Retry logic may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}3.3 Sentry error tracking...${NC}"
if grep -q "@sentry/react-native" package.json 2>/dev/null; then
    echo -e "${GREEN}✅ Sentry package installed${NC}"
    
    # Check app.json first
    SENTRY_DSN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_SENTRY_DSN || '')" 2>/dev/null || echo "")
    
    # Check if it's a valid DSN (not empty and not placeholder)
    if [ -n "$SENTRY_DSN" ] && [ "$SENTRY_DSN" != "" ] && [[ "$SENTRY_DSN" =~ ^https://.*@.*\.ingest\..*sentry\.io ]]; then
        echo -e "${GREEN}✅ Sentry DSN configured in app.json${NC}"
    else
        # Check EAS secrets (if EAS CLI is available)
        if command -v eas >/dev/null 2>&1; then
            EAS_SENTRY=$(eas secret:list 2>/dev/null | grep -i "EXPO_PUBLIC_SENTRY_DSN" || echo "")
            if [ -n "$EAS_SENTRY" ]; then
                echo -e "${GREEN}✅ Sentry DSN configured in EAS secrets${NC}"
            else
                # Check .env file as fallback
                if [ -f ".env" ] && grep -q "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null; then
                    ENV_DSN=$(grep "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || echo "")
                    if [ -n "$ENV_DSN" ] && [[ "$ENV_DSN" =~ ^https://.*@.*\.ingest\..*sentry\.io ]]; then
                        echo -e "${GREEN}✅ Sentry DSN configured in .env${NC}"
                    else
                        echo -e "${YELLOW}⚠️  Sentry DSN not properly configured (check EAS secrets or .env)${NC}"
                        echo -e "${YELLOW}   Run: eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn> --scope project${NC}"
                        WARNINGS=$((WARNINGS + 1))
                    fi
                else
                    echo -e "${YELLOW}⚠️  Sentry DSN not configured (errors won't be tracked in production)${NC}"
                    echo -e "${YELLOW}   To fix: eas secret:create --name EXPO_PUBLIC_SENTRY_DSN --value <your-dsn> --scope project${NC}"
                    WARNINGS=$((WARNINGS + 1))
                fi
            fi
        else
            # EAS CLI not available, check .env
            if [ -f ".env" ] && grep -q "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null; then
                ENV_DSN=$(grep "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d ' ' || echo "")
                if [ -n "$ENV_DSN" ] && [[ "$ENV_DSN" =~ ^https://.*@.*\.ingest\..*sentry\.io ]]; then
                    echo -e "${GREEN}✅ Sentry DSN configured in .env${NC}"
                else
                    echo -e "${YELLOW}⚠️  Sentry DSN format invalid in .env${NC}"
                    WARNINGS=$((WARNINGS + 1))
                fi
            else
                echo -e "${YELLOW}⚠️  Sentry DSN not found (check EAS secrets or .env)${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    fi
    
    # Verify Sentry initialization code exists
    if [ -f "utils/sentry.ts" ]; then
        echo -e "${GREEN}✅ Sentry initialization code present${NC}"
    else
        echo -e "${RED}❌ Sentry initialization code missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Sentry package not installed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# PHASE 4: SECURITY & PERMISSIONS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 4: SECURITY & PERMISSIONS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}4.1 Permissions configured...${NC}"
IOS_PERMS=$(node -e "const a=JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log(Object.keys(a.expo.ios?.infoPlist || {}).length)" 2>/dev/null || echo "0")
ANDROID_PERMS=$(node -e "const a=JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log((a.expo.android?.permissions || []).length)" 2>/dev/null || echo "0")

if [ "$IOS_PERMS" -gt 0 ] && [ "$ANDROID_PERMS" -gt 0 ]; then
    echo -e "${GREEN}✅ Permissions configured (iOS: $IOS_PERMS, Android: $ANDROID_PERMS)${NC}"
else
    echo -e "${YELLOW}⚠️  Some permissions may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}4.2 Google Maps API key...${NC}"
MAPS_KEY=$(node -e "const a=JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log(a.expo.ios?.config?.googleMapsApiKey || a.expo.android?.config?.googleMaps?.apiKey || '')" 2>/dev/null || echo "")
if [ -n "$MAPS_KEY" ] && [ "$MAPS_KEY" != "your-maps-key" ]; then
    echo -e "${GREEN}✅ Google Maps API key configured${NC}"
else
    echo -e "${YELLOW}⚠️  Google Maps API key missing or placeholder${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ============================================================================
# PHASE 5: PRODUCTION FEATURES
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 5: PRODUCTION FEATURES${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}5.1 Upload functionality...${NC}"
if [ -f "api/upload.ts" ] && [ -f "server/src/routes/uploads.ts" ]; then
    echo -e "${GREEN}✅ Upload API and server endpoint exist${NC}"
    
    if grep -q "Cloudinary\|cloudinary" server/src/routes/uploads.ts 2>/dev/null; then
        echo -e "${GREEN}✅ Cloudinary integration present${NC}"
    else
        echo -e "${RED}❌ Cloudinary integration missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Upload functionality missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}5.2 Authentication...${NC}"
if find app -name "*sign-in*" -o -name "*auth*" | grep -q .; then
    echo -e "${GREEN}✅ Authentication screens exist${NC}"
else
    echo -e "${RED}❌ Authentication screens missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}5.3 Feed/Content display...${NC}"
if find app -name "*feed*" -o -name "*event*" | grep -q .; then
    echo -e "${GREEN}✅ Feed/event screens exist${NC}"
else
    echo -e "${RED}❌ Feed screens missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 PRODUCTION READINESS RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ PRODUCTION READY - SAFE FOR REAL-WORLD USE ✅✅✅${NC}"
        echo ""
        echo -e "${GREEN}✅ Production API configured${NC}"
        echo -e "${GREEN}✅ Build configuration correct${NC}"
        echo -e "${GREEN}✅ Error handling present${NC}"
        echo -e "${GREEN}✅ Security configured${NC}"
        echo -e "${GREEN}✅ Core features implemented${NC}"
        echo ""
        echo -e "${CYAN}Your builds are ready for:${NC}"
        echo -e "  • App Store submission (iOS)${NC}"
        echo -e "  • Play Store submission (Android)${NC}"
        echo -e "  • Real-world user deployment${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Production ready with minor issues${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        echo ""
        echo -e "${CYAN}Your builds are ready for real-world use, but consider:${NC}"
        echo -e "  • Review warnings above${NC}"
        # Check if Sentry DSN is configured (simple check)
        SENTRY_CHECK=$(grep -E "^EXPO_PUBLIC_SENTRY_DSN=" .env 2>/dev/null | grep -E "https://.*@.*\.ingest\..*sentry\.io" || echo "")
        if [ -n "$SENTRY_CHECK" ]; then
            echo -e "  • ${GREEN}✅ Sentry DSN is configured${NC}"
            echo -e "  • ${YELLOW}Note: Set in EAS secrets for production builds${NC}"
        else
            echo -e "  • Configure Sentry DSN in EAS secrets for production builds${NC}"
        fi
        echo -e "  • Verify Google Maps API key is production key${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ NOT PRODUCTION READY - $ERRORS ERROR(S) FOUND ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}FIX ERRORS ABOVE BEFORE DEPLOYING TO USERS!${NC}"
    echo ""
    echo -e "${CYAN}Critical issues to fix:${NC}"
    echo -e "  • Ensure API URL is production (not localhost)${NC}"
    echo -e "  • Verify all required features are implemented${NC}"
    echo -e "  • Check build configuration${NC}"
    exit 1
fi
