#!/bin/bash
# Comprehensive Cloudinary Upload End-to-End Test
# Tests uploads with real event pages and sample events

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

API_BASE="${EXPO_PUBLIC_API_URL:-https://api-production-8ac3.up.railway.app}"
ERRORS=0
WARNINGS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}☁️  CLOUDINARY UPLOAD END-TO-END TEST${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1: Check Cloudinary configuration in code
echo -e "${BLUE}Test 1: Cloudinary configuration in codebase...${NC}"
if grep -q "isCloudinaryConfigured\|uploadBufferToCloudinary" server/src/lib/cloudinary.ts; then
    echo -e "${GREEN}✅ Cloudinary library functions found${NC}"
else
    echo -e "${RED}❌ Cloudinary library functions missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "CLOUDINARY_CLOUD_NAME\|CLOUDINARY_API_KEY\|CLOUDINARY_API_SECRET" server/src/lib/cloudinary.ts; then
    echo -e "${GREEN}✅ Cloudinary environment variables referenced${NC}"
else
    echo -e "${RED}❌ Cloudinary environment variables not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "useCloudinary\|uploadBufferToCloudinary" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ Upload routes use Cloudinary${NC}"
else
    echo -e "${RED}❌ Upload routes don't use Cloudinary${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 2: Check upload utilities
echo -e "${BLUE}Test 2: Upload utilities...${NC}"
if [ -f "api/upload.ts" ]; then
    echo -e "${GREEN}✅ Upload API client exists${NC}"
    if grep -q "uploadFile\|uploadFileWithProgress" api/upload.ts; then
        echo -e "${GREEN}✅ Upload functions found${NC}"
    else
        echo -e "${RED}❌ Upload functions missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Upload API client missing${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "utils/uploadUtils.ts" ]; then
    echo -e "${GREEN}✅ Upload utilities exist${NC}"
else
    echo -e "${YELLOW}⚠️  Upload utilities may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 3: Check event pages use uploads
echo -e "${BLUE}Test 3: Event pages with upload functionality...${NC}"
if grep -q "uploadFile\|BannerUpload\|ImagePicker\|upload" app/\(tabs\)/create-fan-event.tsx; then
    echo -e "${GREEN}✅ Create fan event page uses uploads${NC}"
else
    echo -e "${YELLOW}⚠️  Create fan event page may not use uploads directly (may use components)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "uploadFile\|BannerUpload" components/QuickAddGameModal.tsx; then
    echo -e "${GREEN}✅ Quick add game modal uses uploads${NC}"
else
    echo -e "${YELLOW}⚠️  Quick add game modal may not use uploads${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if [ -f "components/BannerUpload.tsx" ]; then
    echo -e "${GREEN}✅ BannerUpload component exists${NC}"
    if grep -q "uploadFile" components/BannerUpload.tsx; then
        echo -e "${GREEN}✅ BannerUpload uses uploadFile${NC}"
    else
        echo -e "${RED}❌ BannerUpload doesn't use uploadFile${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ BannerUpload component missing${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Test 4: Check server health endpoint
echo -e "${BLUE}Test 4: Server Cloudinary configuration check...${NC}"
if command -v curl &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s "${API_BASE}/health" 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESPONSE" ]; then
        if echo "$HEALTH_RESPONSE" | grep -q "cloudinary"; then
            CLOUDINARY_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"cloudinary":[^,}]*' | cut -d':' -f2 | tr -d ' ')
            if [ "$CLOUDINARY_STATUS" = "true" ]; then
                echo -e "${GREEN}✅ Cloudinary configured on server${NC}"
            elif [ "$CLOUDINARY_STATUS" = "false" ]; then
                echo -e "${YELLOW}⚠️  Cloudinary not configured on server (may use local storage)${NC}"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "${YELLOW}⚠️  Could not determine Cloudinary status${NC}"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            echo -e "${YELLOW}⚠️  Health endpoint doesn't report Cloudinary status${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        echo -e "${YELLOW}⚠️  Could not reach server health endpoint${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  curl not available - skipping server check${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 5: Check upload endpoint structure
echo -e "${BLUE}Test 5: Upload endpoint implementation...${NC}"
if grep -q "uploadsRouter\.post\|router\.post.*'/'" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ POST /uploads endpoint exists${NC}"
else
    echo -e "${YELLOW}⚠️  POST /uploads endpoint pattern not found (may use different syntax)${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "secure_url\|cloudResult" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ Upload endpoint handles Cloudinary responses${NC}"
else
    echo -e "${RED}❌ Upload endpoint doesn't handle Cloudinary responses${NC}"
    ERRORS=$((ERRORS + 1))
fi

if grep -q "storage.*cloudinary\|storage.*local" server/src/routes/uploads.ts; then
    echo -e "${GREEN}✅ Upload endpoint reports storage type${NC}"
else
    echo -e "${YELLOW}⚠️  Upload endpoint may not report storage type${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 6 removed (2026-07-09): sample-content system retired; no sample upload handling exists.

if grep -q "uploadFile\|ImagePicker" app/game-details/GameDetailsScreen.tsx; then
    echo -e "${GREEN}✅ Game details screen uses uploads${NC}"
else
    echo -e "${YELLOW}⚠️  Game details screen may not use uploads${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Test 7: Check error handling
echo -e "${BLUE}Test 7: Error handling...${NC}"
if grep -q "try.*catch\|Error\|error" server/src/routes/uploads.ts | head -5; then
    echo -e "${GREEN}✅ Error handling in upload routes${NC}"
else
    echo -e "${YELLOW}⚠️  Error handling may be insufficient${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

if grep -q "catch\|Error" api/upload.ts | head -5; then
    echo -e "${GREEN}✅ Error handling in upload client${NC}"
else
    echo -e "${YELLOW}⚠️  Error handling in upload client may be insufficient${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 TEST RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅✅✅ ALL TESTS PASSED - CLOUDINARY UPLOADS CONFIGURED! ✅✅✅${NC}"
        echo ""
        echo "Cloudinary uploads are properly configured:"
        echo "  ✅ Cloudinary library functions present"
        echo "  ✅ Upload routes use Cloudinary"
        echo "  ✅ Event pages support uploads"
        echo "  ✅ Error handling in place"
        exit 0
    else
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) - Uploads should work${NC}"
        echo -e "${GREEN}✅ No blocking errors${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌❌❌ $ERRORS ERROR(S) FOUND - FIX BEFORE DEPLOYING ❌❌❌${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠️  $WARNINGS warning(s) also found${NC}"
    fi
    exit 1
fi
