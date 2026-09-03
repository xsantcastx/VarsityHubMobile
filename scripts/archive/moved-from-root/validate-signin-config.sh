#!/bin/bash
#
# Google & Apple Sign-In Configuration Validator
# Verifies all OAuth configuration is correct before testing
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo "${CYAN}  Google & Apple Sign-In Configuration Validator${NC}"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Check file exists
check_file() {
    if [ -f "$1" ]; then
        check_pass "File found: $1"
        return 0
    else
        check_fail "File missing: $1"
        return 1
    fi
}

# Check environment variable
check_env() {
    local var_name=$1
    local required=$2
    local value=$(printenv "$var_name" || echo "")
    
    if [ -n "$value" ]; then
        check_pass "Environment variable set: $var_name"
        return 0
    else
        if [ "$required" = "true" ]; then
            check_fail "Environment variable required: $var_name"
        else
            check_warn "Environment variable not set (optional): $var_name"
        fi
        return 1
    fi
}

# Check URL accessibility
check_url() {
    local url=$1
    local expected_code=$2
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_code" ]; then
        check_pass "URL accessible: $url (HTTP $response)"
        return 0
    else
        check_warn "URL returned HTTP $response (expected $expected_code): $url"
        return 1
    fi
}

# ==============================================================================
# SECTION 1: File Structure
# ==============================================================================
echo "${MAGENTA}📁 SECTION 1: File Structure${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

ROOT_DIR="/Users/varsityhub/Desktop/CODE/VarsityHubMobile"

check_file "$ROOT_DIR/.env"
check_file "$ROOT_DIR/.env.production"
check_file "$ROOT_DIR/app.json"
check_file "$ROOT_DIR/server/src/routes/auth.ts"
check_file "$ROOT_DIR/hooks/useGoogleAuth.ts"
check_file "$ROOT_DIR/hooks/useAppleAuth.ts"
check_file "$ROOT_DIR/api/auth.ts"

echo ""

# ==============================================================================
# SECTION 2: Frontend Configuration
# ==============================================================================
echo "${MAGENTA}📱 SECTION 2: Frontend Configuration${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

# Check app.json for Google config
if [ -f "$ROOT_DIR/app.json" ]; then
    if grep -q "EXPO_PUBLIC_GOOGLE" "$ROOT_DIR/app.json"; then
        check_pass "Google OAuth configuration found in app.json"
    else
        check_fail "Google OAuth configuration missing from app.json"
    fi
    
    if grep -q "EXPO_PUBLIC_APPLE" "$ROOT_DIR/app.json" || grep -q "apple" "$ROOT_DIR/app.json"; then
        check_pass "Apple configuration found in app.json"
    else
        check_warn "Apple configuration not found in app.json (may be set via env)"
    fi
fi

# Check environment variables
check_env "EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID" "true"
check_env "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" "true"
check_env "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" "true"
check_env "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" "true"
check_env "EXPO_PUBLIC_API_URL" "true"

echo ""

# ==============================================================================
# SECTION 3: Backend Configuration
# ==============================================================================
echo "${MAGENTA}🔧 SECTION 3: Backend Configuration${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

check_env "GOOGLE_ALLOWED_AUDIENCES" "false"
check_env "NODE_ENV" "false"
check_env "DATABASE_URL" "true"
check_env "JWT_SECRET" "true"

# Check backend auth.ts has both endpoints
if [ -f "$ROOT_DIR/server/src/routes/auth.ts" ]; then
    if grep -q "authRouter.post('/google'" "$ROOT_DIR/server/src/routes/auth.ts"; then
        check_pass "POST /auth/google endpoint found"
    else
        check_fail "POST /auth/google endpoint missing"
    fi
    
    if grep -q "authRouter.post('/apple'" "$ROOT_DIR/server/src/routes/auth.ts"; then
        check_pass "POST /auth/apple endpoint found"
    else
        check_fail "POST /auth/apple endpoint missing"
    fi
fi

echo ""

# ==============================================================================
# SECTION 4: Database Configuration
# ==============================================================================
echo "${MAGENTA}🗄️  SECTION 4: Database Configuration${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

# Check prisma schema
if [ -f "$ROOT_DIR/server/prisma/schema.prisma" ]; then
    if grep -q "google_id" "$ROOT_DIR/server/prisma/schema.prisma"; then
        check_pass "google_id field found in User model"
    else
        check_fail "google_id field missing from User model"
    fi
    
    if grep -q "apple_id" "$ROOT_DIR/server/prisma/schema.prisma"; then
        check_pass "apple_id field found in User model"
    else
        check_fail "apple_id field missing from User model"
    fi
else
    check_warn "Prisma schema not found at expected location"
fi

echo ""

# ==============================================================================
# SECTION 5: Google OAuth Setup
# ==============================================================================
echo "${MAGENTA}🔐 SECTION 5: Google OAuth Setup${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

GOOGLE_WEB_CLIENT=$(printenv EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || echo "")

if [ -n "$GOOGLE_WEB_CLIENT" ]; then
    check_pass "Google Web Client ID configured"
    
    # Validate format (should be numeric-*.apps.googleusercontent.com)
    if echo "$GOOGLE_WEB_CLIENT" | grep -q "googleusercontent.com"; then
        check_pass "Google Web Client ID appears valid (contains googleusercontent.com)"
    else
        check_warn "Google Web Client ID format unexpected (should contain googleusercontent.com)"
    fi
    
    # Check Google APIs accessibility
    check_url "https://oauth2.googleapis.com/tokeninfo" "400"
else
    check_fail "Google Web Client ID not configured"
fi

GOOGLE_IOS_CLIENT=$(printenv EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || echo "")
if [ -n "$GOOGLE_IOS_CLIENT" ]; then
    check_pass "Google iOS Client ID configured"
else
    check_warn "Google iOS Client ID not configured"
fi

GOOGLE_ANDROID_CLIENT=$(printenv EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || echo "")
if [ -n "$GOOGLE_ANDROID_CLIENT" ]; then
    check_pass "Google Android Client ID configured"
else
    check_warn "Google Android Client ID not configured"
fi

echo ""

# ==============================================================================
# SECTION 6: Apple Sign-In Setup
# ==============================================================================
echo "${MAGENTA}🍎 SECTION 6: Apple Sign-In Setup${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

check_env "APPLE_TEAM_ID" "false"
check_env "APPLE_KEY_ID" "false"
check_env "APPLE_BUNDLE_ID" "false"

# Check for Apple key file
APPLE_KEY_FILE=$(printenv APPLE_KEY_FILE || echo "")
if [ -n "$APPLE_KEY_FILE" ]; then
    if [ -f "$APPLE_KEY_FILE" ]; then
        check_pass "Apple private key file found: $APPLE_KEY_FILE"
        
        # Check key file permissions
        perms=$(stat -f %A "$APPLE_KEY_FILE" 2>/dev/null || echo "unknown")
        if [ "$perms" = "600" ] || [ "$perms" = "400" ]; then
            check_pass "Apple key file has secure permissions: $perms"
        else
            check_warn "Apple key file permissions may be too open: $perms (should be 600 or 400)"
        fi
    else
        check_fail "Apple private key file not found: $APPLE_KEY_FILE"
    fi
else
    check_warn "APPLE_KEY_FILE environment variable not set"
fi

echo ""

# ==============================================================================
# SECTION 7: Dependencies
# ==============================================================================
echo "${MAGENTA}📦 SECTION 7: Dependencies${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

# Check frontend dependencies
if [ -f "$ROOT_DIR/package.json" ]; then
    if grep -q "expo-auth-session" "$ROOT_DIR/package.json"; then
        check_pass "expo-auth-session installed (required for Google OAuth)"
    else
        check_fail "expo-auth-session missing from package.json"
    fi
    
    if grep -q "expo-apple-authentication" "$ROOT_DIR/package.json"; then
        check_pass "expo-apple-authentication installed (required for Apple Sign-In)"
    else
        check_fail "expo-apple-authentication missing from package.json"
    fi
fi

# Check backend dependencies
if [ -f "$ROOT_DIR/server/package.json" ]; then
    if grep -q "zod" "$ROOT_DIR/server/package.json"; then
        check_pass "zod installed (validation)"
    else
        check_fail "zod missing from server/package.json"
    fi
    
    if grep -q "prisma" "$ROOT_DIR/server/package.json"; then
        check_pass "prisma installed (database ORM)"
    else
        check_fail "prisma missing from server/package.json"
    fi
fi

echo ""

# ==============================================================================
# SECTION 8: Code Implementation
# ==============================================================================
echo "${MAGENTA}⚙️  SECTION 8: Code Implementation${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

# Check useGoogleAuth hook
if [ -f "$ROOT_DIR/hooks/useGoogleAuth.ts" ]; then
    if grep -q "function useGoogleAuth" "$ROOT_DIR/hooks/useGoogleAuth.ts"; then
        check_pass "useGoogleAuth hook implemented"
    else
        check_fail "useGoogleAuth hook not properly implemented"
    fi
    
    if grep -q "signInWithGoogle" "$ROOT_DIR/hooks/useGoogleAuth.ts"; then
        check_pass "signInWithGoogle function exported"
    else
        check_fail "signInWithGoogle function not found"
    fi
else
    check_fail "useGoogleAuth.ts not found"
fi

# Check useAppleAuth hook
if [ -f "$ROOT_DIR/hooks/useAppleAuth.ts" ]; then
    if grep -q "function useAppleAuth" "$ROOT_DIR/hooks/useAppleAuth.ts"; then
        check_pass "useAppleAuth hook implemented"
    else
        check_fail "useAppleAuth hook not properly implemented"
    fi
    
    if grep -q "signInWithApple" "$ROOT_DIR/hooks/useAppleAuth.ts"; then
        check_pass "signInWithApple function exported"
    else
        check_fail "signInWithApple function not found"
    fi
else
    check_fail "useAppleAuth.ts not found"
fi

# Check auth API client
if [ -f "$ROOT_DIR/api/auth.ts" ]; then
    if grep -q "loginWithGoogle" "$ROOT_DIR/api/auth.ts"; then
        check_pass "loginWithGoogle API method implemented"
    else
        check_fail "loginWithGoogle API method not found"
    fi
    
    if grep -q "loginWithApple" "$ROOT_DIR/api/auth.ts"; then
        check_pass "loginWithApple API method implemented"
    else
        check_fail "loginWithApple API method not found"
    fi
else
    check_fail "api/auth.ts not found"
fi

echo ""

# ==============================================================================
# SECTION 9: Testing & Documentation
# ==============================================================================
echo "${MAGENTA}🧪 SECTION 9: Testing & Documentation${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

check_file "$ROOT_DIR/server/tests/auth-signin.integration.test.ts"
check_file "$ROOT_DIR/E2E_SIGNIN_TEST_SCENARIOS.md"
check_file "$ROOT_DIR/SIGNIN_FIX_GUIDE.md"
check_file "$ROOT_DIR/run-signin-tests.sh"

echo ""

# ==============================================================================
# SECTION 10: Summary & Recommendations
# ==============================================================================
echo "${MAGENTA}📊 SECTION 10: Summary${NC}"
echo "────────────────────────────────────────────────────────────────────────────────"

TOTAL=$((PASSED + FAILED + WARNINGS))

echo ""
echo "Results:"
echo "  ${GREEN}✓ Passed: $PASSED${NC}"
echo "  ${YELLOW}⚠ Warnings: $WARNINGS${NC}"
echo "  ${RED}✗ Failed: $FAILED${NC}"
echo "  ─────────────────"
echo "  Total Checks: $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review warnings above (if any)"
    echo "  2. Run integration tests: npm test -- auth-signin.integration.test.ts"
    echo "  3. Follow E2E_SIGNIN_TEST_SCENARIOS.md for manual testing"
    echo "  4. Check server logs for any errors: tail -f logs/server.log"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Configuration incomplete - please fix errors above${NC}"
    echo ""
    echo "Errors found:"
    echo "  • Review all ${RED}✗${NC} items above"
    echo "  • Check SIGNIN_FIX_GUIDE.md for configuration instructions"
    echo "  • Verify all environment variables are set"
    echo "  • Ensure database is migrated with apple_id and google_id fields"
    echo ""
    exit 1
fi
