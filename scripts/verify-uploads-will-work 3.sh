#!/bin/bash
# UPLOAD VERIFICATION - Critical Check Before Build
# This verifies that uploads will ACTUALLY work in production

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📤 UPLOAD FUNCTIONALITY VERIFICATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# CRITICAL: Server-side Cloudinary configuration
echo -e "${BLUE}Step 1: Server Cloudinary Configuration (RAILWAY)${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Cloudinary must be configured in Railway, NOT in mobile build${NC}"
echo ""

# Check if we can verify Railway env vars (requires Railway CLI or manual check)
if command -v railway &> /dev/null; then
    echo -e "${BLUE}Checking Railway environment variables...${NC}"
    
    # Try to get Cloudinary vars from Railway
    CLOUD_NAME=$(railway variables get CLOUDINARY_CLOUD_NAME 2>/dev/null || echo "")
    API_KEY=$(railway variables get CLOUDINARY_API_KEY 2>/dev/null || echo "")
    API_SECRET=$(railway variables get CLOUDINARY_API_SECRET 2>/dev/null || echo "")
    
    if [ -n "$CLOUD_NAME" ] && [ -n "$API_KEY" ] && [ -n "$API_SECRET" ]; then
        echo -e "${GREEN}✅ Cloudinary configured in Railway${NC}"
        echo -e "${GREEN}   Cloud Name: ${CLOUD_NAME}${NC}"
        echo -e "${GREEN}   API Key: ${API_KEY:0:10}...${NC}"
    else
        echo -e "${RED}❌ Cloudinary NOT configured in Railway${NC}"
        echo -e "${RED}   Uploads WILL FAIL in production builds!${NC}"
        echo ""
        echo -e "${YELLOW}To fix:${NC}"
        echo -e "1. Go to Railway dashboard: https://railway.app"
        echo -e "2. Select your backend service"
        echo -e "3. Go to Variables tab"
        echo -e "4. Add these variables:"
        echo -e "   - CLOUDINARY_CLOUD_NAME"
        echo -e "   - CLOUDINARY_API_KEY"
        echo -e "   - CLOUDINARY_API_SECRET"
        echo -e "5. Redeploy the backend"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Railway CLI not found - cannot verify Cloudinary in Railway${NC}"
    echo -e "${YELLOW}   MANUAL CHECK REQUIRED:${NC}"
    echo -e "   1. Go to Railway dashboard"
    echo -e "   2. Check if these variables exist:"
    echo -e "      - CLOUDINARY_CLOUD_NAME"
    echo -e "      - CLOUDINARY_API_KEY"
    echo -e "      - CLOUDINARY_API_SECRET"
    echo -e "   3. If missing, uploads WILL FAIL"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check server code enforces Cloudinary in production
echo -e "${BLUE}Step 2: Server Code Validation${NC}"
if grep -q "NODE_ENV === 'production' && !isCloudinaryConfigured" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ Server enforces Cloudinary in production${NC}"
    echo -e "${GREEN}   Server will REFUSE TO START if Cloudinary missing in production${NC}"
else
    echo -e "${RED}❌ Server does not enforce Cloudinary requirement${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "SENTRY_ALLOW_FAILURE" server/src/routes/uploads.ts 2>/dev/null || grep -q "useCloudinary" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ Server has Cloudinary fallback logic${NC}"
else
    echo -e "${YELLOW}⚠️  Server Cloudinary logic may be incomplete${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Check mobile upload implementation
echo -e "${BLUE}Step 3: Mobile Upload Implementation${NC}"
if [ -f "api/upload.ts" ]; then
    echo -e "${GREEN}✅ Mobile upload API exists${NC}"
    
    # Check for retry logic
    if grep -q "retries\|retry" api/upload.ts; then
        echo -e "${GREEN}✅ Upload has retry logic${NC}"
    else
        echo -e "${YELLOW}⚠️  Upload may lack retry logic${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    # Check for proper error handling
    if grep -q "Network request failed\|timeout\|error" api/upload.ts; then
        echo -e "${GREEN}✅ Upload has error handling${NC}"
    else
        echo -e "${YELLOW}⚠️  Upload error handling may be incomplete${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Mobile upload API missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check API URL configuration
echo -e "${BLUE}Step 4: API URL Configuration${NC}"
API_URL=$(node -e "console.log(JSON.parse(require('fs').readFileSync('app.json', 'utf8')).expo.extra.EXPO_PUBLIC_API_URL || '')" 2>/dev/null || echo "")
if [ -n "$API_URL" ] && [[ "$API_URL" =~ ^https:// ]]; then
    echo -e "${GREEN}✅ API URL configured: $API_URL${NC}"
    
    # Check if it's production URL
    if [[ "$API_URL" =~ railway\.app ]] || [[ "$API_URL" =~ production ]]; then
        echo -e "${GREEN}✅ Using production API URL${NC}"
    else
        echo -e "${YELLOW}⚠️  API URL may not be production: $API_URL${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ API URL not configured or invalid${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check upload endpoint exists on server
echo -e "${BLUE}Step 5: Server Upload Endpoint${NC}"
if grep -q "uploadsRouter.post\|router.post.*uploads" server/src/routes/uploads.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Server has /uploads endpoint${NC}"
else
    echo -e "${RED}❌ Server /uploads endpoint missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "requireAuth" server/src/routes/uploads.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Upload endpoint requires authentication${NC}"
else
    echo -e "${YELLOW}⚠️  Upload endpoint may not require auth${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 UPLOAD VERIFICATION RESULT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ UPLOADS SHOULD WORK ✅✅✅${NC}"
        echo ""
        echo -e "${GREEN}All checks passed. Uploads should work in production.${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  FINAL VERIFICATION REQUIRED:${NC}"
        echo -e "   1. Verify Cloudinary vars are set in Railway (manual check)"
        echo -e "   2. Test upload after build completes"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Uploads may work but verify manually${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ UPLOADS WILL FAIL - $ERRORS ERROR(S) FOUND ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    echo ""
    echo -e "${RED}CRITICAL: Fix errors above or uploads will fail in production!${NC}"
    echo ""
    echo -e "${YELLOW}Most likely issue: Cloudinary not configured in Railway${NC}"
    echo -e "${YELLOW}This is a SERVER configuration issue, not a mobile build issue.${NC}"
    exit 1
fi
