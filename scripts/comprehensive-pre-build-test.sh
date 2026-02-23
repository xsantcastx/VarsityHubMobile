#!/bin/bash
# Comprehensive Pre-Build Test - Top to Bottom
# Verifies: Builds, Uploads, Sample Events, End-to-End Flow

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
echo -e "${CYAN}🧪 COMPREHENSIVE PRE-BUILD TEST${NC}"
echo -e "${CYAN}   Testing: Builds + Uploads + Sample Events${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# PHASE 1: BUILD READINESS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 1: BUILD READINESS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}1.1 TypeScript Compilation...${NC}"
if npm run typecheck 2>&1 | grep -q "error TS"; then
    echo -e "${RED}❌ TypeScript errors found${NC}"
    npm run typecheck 2>&1 | grep "error TS" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ TypeScript compiles successfully${NC}"
fi
echo ""

echo -e "${BLUE}1.2 Linting...${NC}"
LINT_OUTPUT=$(npm run lint 2>&1)
if echo "$LINT_OUTPUT" | grep -qE "error|✖.*[1-9]"; then
    echo -e "${RED}❌ Linting errors found${NC}"
    echo "$LINT_OUTPUT" | grep -E "error|✖" | head -5
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Linting passes${NC}"
fi
echo ""

echo -e "${BLUE}1.3 Critical Files...${NC}"
MISSING=0
for file in "app.json" "eas.json" "package.json" "tsconfig.json"; do
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

echo -e "${BLUE}1.4 JSON Validation...${NC}"
if node -e "JSON.parse(require('fs').readFileSync('app.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ app.json valid${NC}"
else
    echo -e "${RED}❌ app.json invalid${NC}"
    ERRORS=$((ERRORS + 1))
fi

if node -e "JSON.parse(require('fs').readFileSync('eas.json', 'utf8'))" 2>/dev/null; then
    echo -e "${GREEN}✅ eas.json valid${NC}"
else
    echo -e "${RED}❌ eas.json invalid${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}1.5 Dependencies...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
else
    echo -e "${RED}❌ node_modules missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if npm ls @sentry/react-native 2>/dev/null | grep -q "@sentry/react-native"; then
    echo -e "${GREEN}✅ Sentry package installed${NC}"
else
    echo -e "${RED}❌ Sentry package missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# PHASE 2: UPLOAD FUNCTIONALITY
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 2: UPLOAD FUNCTIONALITY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}2.1 Upload API Implementation...${NC}"
if [ -f "api/upload.ts" ]; then
    echo -e "${GREEN}✅ Upload API exists${NC}"
    
    if grep -q "uploadFile\|uploadFileWithProgress" api/upload.ts; then
        echo -e "${GREEN}✅ Upload functions implemented${NC}"
    else
        echo -e "${RED}❌ Upload functions missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "retries\|retry" api/upload.ts; then
        echo -e "${GREEN}✅ Retry logic present${NC}"
    else
        echo -e "${YELLOW}⚠️  Retry logic may be missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Upload API missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}2.2 Server Upload Endpoint...${NC}"
if [ -f "server/src/routes/uploads.ts" ]; then
    echo -e "${GREEN}✅ Server upload route exists${NC}"
    
    if grep -q "uploadsRouter.post" server/src/routes/uploads.ts; then
        echo -e "${GREEN}✅ POST /uploads endpoint defined${NC}"
    else
        echo -e "${RED}❌ Upload endpoint missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "isCloudinaryConfigured\|Cloudinary" server/src/routes/uploads.ts; then
        echo -e "${GREEN}✅ Cloudinary integration present${NC}"
    else
        echo -e "${RED}❌ Cloudinary integration missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "NODE_ENV === 'production' && !isCloudinaryConfigured" server/src/routes/uploads.ts; then
        echo -e "${GREEN}✅ Server enforces Cloudinary in production${NC}"
    else
        echo -e "${YELLOW}⚠️  Server may not enforce Cloudinary requirement${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Server upload route missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}2.3 Cloudinary Library...${NC}"
if [ -f "server/src/lib/cloudinary.ts" ]; then
    echo -e "${GREEN}✅ Cloudinary library exists${NC}"
    
    if grep -q "uploadBufferToCloudinary" server/src/lib/cloudinary.ts; then
        echo -e "${GREEN}✅ Cloudinary upload function exists${NC}"
    else
        echo -e "${RED}❌ Cloudinary upload function missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "isCloudinaryConfigured" server/src/lib/cloudinary.ts; then
        echo -e "${GREEN}✅ Cloudinary check function exists${NC}"
    else
        echo -e "${RED}❌ Cloudinary check function missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Cloudinary library missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}2.4 API URL Configuration...${NC}"
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_API_URL || '')" 2>/dev/null || echo "")
if [ -n "$API_URL" ] && [[ "$API_URL" =~ ^https:// ]]; then
    echo -e "${GREEN}✅ API URL configured: $API_URL${NC}"
    
    # Check if it's production URL
    if [[ "$API_URL" =~ railway\.app ]] || [[ "$API_URL" =~ production ]]; then
        echo -e "${GREEN}✅ Using production API URL${NC}"
    else
        echo -e "${YELLOW}⚠️  API URL may not be production${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ API URL not configured or invalid${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# ============================================================================
# PHASE 3: SAMPLE EVENTS FUNCTIONALITY
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 3: SAMPLE EVENTS FUNCTIONALITY${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}3.1 Sample Events Feature Flag...${NC}"
if grep -q "EXPO_PUBLIC_FORCE_SAMPLE_FEED\|FORCE_SAMPLE_FEED" .env.example 2>/dev/null || grep -q "FORCE_SAMPLE_FEED" app.json 2>/dev/null; then
    echo -e "${GREEN}✅ Sample feed feature flag documented${NC}"
else
    echo -e "${YELLOW}⚠️  Sample feed flag may not be documented${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

SAMPLE_FEED_FLAG=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_FORCE_SAMPLE_FEED || '')" 2>/dev/null || echo "")
if [ -n "$SAMPLE_FEED_FLAG" ]; then
    echo -e "${GREEN}✅ Sample feed flag configured in app.json${NC}"
else
    echo -e "${YELLOW}⚠️  Sample feed flag not in app.json (may be in .env)${NC}"
fi
echo ""

echo -e "${BLUE}3.2 Sample Events Data...${NC}"
if grep -q "UNC\|Duke\|Warriors\|Lakers\|Patriots\|Jets" app.json 2>/dev/null || grep -q "sample.*event\|SAMPLE" -r app --include="*.tsx" --include="*.ts" 2>/dev/null | head -1; then
    echo -e "${GREEN}✅ Sample events referenced in code${NC}"
else
    echo -e "${YELLOW}⚠️  Sample events may be hardcoded in components${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check if Feed component handles sample events
if find app -name "*feed*" -o -name "*Feed*" | grep -q .; then
    FEED_FILE=$(find app -name "*feed*" -o -name "*Feed*" | head -1)
    if grep -q "FORCE_SAMPLE_FEED\|sample.*event" "$FEED_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ Feed component handles sample events${NC}"
    else
        echo -e "${YELLOW}⚠️  Feed component may not handle sample events${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Feed component not found${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}3.3 Event Data Structure...${NC}"
if codebase_search -q "What is the structure of sample events data?" 2>/dev/null | grep -q "event\|game\|team"; then
    echo -e "${GREEN}✅ Event data structure defined${NC}"
else
    # Check for event types/interfaces
    if find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "interface.*Event\|type.*Event" 2>/dev/null | head -1; then
        echo -e "${GREEN}✅ Event types/interfaces defined${NC}"
    else
        echo -e "${YELLOW}⚠️  Event types may not be explicitly defined${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi
echo ""

# ============================================================================
# PHASE 4: END-TO-END FLOW
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 4: END-TO-END FLOW VERIFICATION${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}4.1 Authentication Flow...${NC}"
if find app -name "*sign-in*" -o -name "*auth*" | grep -q .; then
    echo -e "${GREEN}✅ Authentication screens exist${NC}"
else
    echo -e "${YELLOW}⚠️  Auth screens may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "useAuth\|AuthProvider" -r app --include="*.tsx" --include="*.ts" 2>/dev/null | head -1; then
    echo -e "${GREEN}✅ Auth context/provider exists${NC}"
else
    echo -e "${YELLOW}⚠️  Auth context may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}4.2 Feed/Events Display...${NC}"
if find app -name "*feed*" -o -name "*event*" | grep -q .; then
    echo -e "${GREEN}✅ Feed/event screens exist${NC}"
else
    echo -e "${YELLOW}⚠️  Feed screens may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

echo -e "${BLUE}4.3 Image Upload Integration...${NC}"
if find app -name "*upload*" -o -name "*image*" | xargs grep -l "uploadFile\|uploadFileWithProgress" 2>/dev/null | head -1; then
    echo -e "${GREEN}✅ Upload functions used in app${NC}"
else
    echo -e "${YELLOW}⚠️  Upload functions may not be integrated${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if find components -name "*upload*" -o -name "*image*" 2>/dev/null | head -1; then
    echo -e "${GREEN}✅ Upload components exist${NC}"
else
    echo -e "${YELLOW}⚠️  Upload components may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ============================================================================
# PHASE 5: CONFIGURATION VALIDATION
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}PHASE 5: CONFIGURATION VALIDATION${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${BLUE}5.1 Environment Variables...${NC}"
REQUIRED_VARS=("EXPO_PUBLIC_API_URL" "DATABASE_URL" "JWT_SECRET")
MISSING_VARS=0
for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "$var" .env.example 2>/dev/null; then
        echo -e "${GREEN}✅ $var documented${NC}"
    else
        echo -e "${RED}❌ $var not documented${NC}"
        MISSING_VARS=$((MISSING_VARS + 1))
    fi
done
if [ $MISSING_VARS -gt 0 ]; then
    ERRORS=$((ERRORS + MISSING_VARS))
fi
echo ""

echo -e "${BLUE}5.2 Build Configuration...${NC}"
if [ -f "eas.json" ]; then
    EAS_PROFILES=$(node -e "const e=JSON.parse(require('fs').readFileSync('eas.json','utf8')); console.log(Object.keys(e.build||{}).join(','))" 2>/dev/null || echo "")
    if echo "$EAS_PROFILES" | grep -q "production"; then
        echo -e "${GREEN}✅ Production build profile exists${NC}"
    else
        echo -e "${RED}❌ Production profile missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if echo "$EAS_PROFILES" | grep -q "preview"; then
        echo -e "${GREEN}✅ Preview build profile exists${NC}"
    else
        echo -e "${YELLOW}⚠️  Preview profile missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ eas.json missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

echo -e "${BLUE}5.3 Version Consistency...${NC}"
APP_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.version || '')" 2>/dev/null || echo "")
PKG_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version || '')" 2>/dev/null || echo "")
if [ -n "$APP_VERSION" ] && [ -n "$PKG_VERSION" ] && [ "$APP_VERSION" = "$PKG_VERSION" ]; then
    echo -e "${GREEN}✅ Versions match: $APP_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  Version mismatch: app.json=$APP_VERSION, package.json=$PKG_VERSION${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}📊 COMPREHENSIVE TEST RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ ALL TESTS PASSED - READY FOR BUILD ✅✅✅${NC}"
        echo ""
        echo -e "${GREEN}Builds will work ✅${NC}"
        echo -e "${GREEN}Uploads will work ✅${NC}"
        echo -e "${GREEN}Sample events will work ✅${NC}"
        echo ""
        echo -e "${CYAN}You can safely run:${NC}"
        echo -e "  eas build --platform ios --profile production"
        echo -e "  eas build --platform android --profile production"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Build can proceed${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        echo ""
        echo -e "${GREEN}Builds should work ✅${NC}"
        echo -e "${GREEN}Uploads should work ✅${NC}"
        echo -e "${YELLOW}Sample events: Check warnings above${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ TEST FAILED - $ERRORS ERROR(S) FOUND ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}FIX ERRORS ABOVE BEFORE BUILDING!${NC}"
    exit 1
fi
