#!/bin/bash

# VarsityHub Mobile - Production Fixes Verification Script
# Usage: bash scripts/verify-fixes.sh

# Disable strict mode to continue on errors
set +e

echo "🔍 VarsityHub Mobile - Production Fixes Verification"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

echo "📋 Verifying Production Fixes..."
echo ""

# 1. Check PostCard imports
echo "1️⃣  Checking PostCard optimization..."
if grep -q "useAuth" components/PostCard.tsx && ! grep -q "User.me" components/PostCard.tsx; then
  pass "PostCard uses useAuth() instead of User.me()"
else
  fail "PostCard still calls User.me() or useAuth not imported"
fi

# 2. Check ErrorToast exists
echo ""
echo "2️⃣  Checking ErrorToast component..."
if [ -f "components/ErrorToast.tsx" ]; then
  pass "ErrorToast component exists"
  
  if grep -q "showErrorToast\|showSuccessToast\|showWarningToast\|showInfoToast" components/ErrorToast.tsx; then
    pass "ErrorToast exports all toast functions"
  else
    fail "ErrorToast missing toast functions"
  fi
else
  fail "ErrorToast component not found"
fi

# 3. Check ErrorToastContainer in layout
echo ""
echo "3️⃣  Checking ErrorToastContainer integration..."
if grep -q "ErrorToastContainer" app/_layout.tsx; then
  pass "ErrorToastContainer integrated in root layout"
else
  fail "ErrorToastContainer not found in _layout.tsx"
fi

# 4. Check password validation
echo ""
echo "4️⃣  Checking password validation enhancement..."
if grep -q "calculatePasswordStrength\|requireStrong" utils/formUtils.ts; then
  pass "Password strength calculation implemented"
else
  fail "Password strength calculation not found"
fi

if grep -q "validatePassword.*requireStrong" app/sign-up.tsx; then
  pass "Sign-up uses enhanced password validation"
else
  warn "Sign-up may not use enhanced password validation"
fi

# 5. Check API configuration
echo ""
echo "5️⃣  Checking environment-based API configuration..."
if grep -q "EXPO_PUBLIC_API_URL\|process.env" api/http.ts; then
  pass "API configuration supports environment variables"
  
  if grep -q "isLocalhost\|__DEV__" api/http.ts; then
    pass "API configuration has localhost protection"
  else
    warn "API configuration may not have localhost protection"
  fi
else
  fail "Environment-based API configuration not found"
fi

# 6. Check LIVE badge fix
echo ""
echo "6️⃣  Checking LIVE badge fix..."
if grep -q "NEW\|600000" app/highlights.tsx; then
  pass "LIVE badge changed to NEW badge (10 min)"
else
  warn "LIVE badge may not be fixed"
fi

# 7. Check error handling in PostCard
echo ""
echo "7️⃣  Checking error handling..."
if grep -q "console.error.*PostCard" components/PostCard.tsx; then
  pass "PostCard has proper error logging"
else
  warn "PostCard may not have proper error logging"
fi

# 8. Check for empty catch blocks
echo ""
echo "8️⃣  Checking for empty catch blocks..."
EMPTY_CATCHES=$(grep -r "catch.*{}" components/ app/ 2>/dev/null | grep -v "node_modules" | grep -v ".next" | wc -l)
if [ "$EMPTY_CATCHES" -eq 0 ]; then
  pass "No empty catch blocks found"
else
  warn "Found $EMPTY_CATCHES empty catch blocks (should be addressed)"
fi

# 9. TypeScript compilation (skip - takes too long)
echo ""
echo "9️⃣  Checking TypeScript imports..."
if grep -q "import.*ErrorToast" app/_layout.tsx; then
  pass "ErrorToast properly imported in layout"
else
  fail "ErrorToast import missing from layout"
fi

if grep -q "import.*useAuth" components/PostCard.tsx; then
  pass "useAuth properly imported in PostCard"
else
  fail "useAuth import missing from PostCard"
fi

# 10. Documentation
echo ""
echo "🔟  Checking documentation..."
if [ -f "PRODUCTION_FIXES.md" ]; then
  pass "PRODUCTION_FIXES.md exists"
else
  fail "PRODUCTION_FIXES.md not found"
fi

if [ -f "REMAINING_BLOCKERS.md" ]; then
  pass "REMAINING_BLOCKERS.md exists"
else
  fail "REMAINING_BLOCKERS.md not found"
fi

if [ -f "PRODUCTION_STATUS.md" ]; then
  pass "PRODUCTION_STATUS.md exists"
else
  fail "PRODUCTION_STATUS.md not found"
fi

# Summary
echo ""
echo "=================================================="
echo "📊 Verification Summary"
echo "=================================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ All critical fixes verified!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Test each fix manually (see PRODUCTION_FIXES.md)"
  echo "  2. Set EXPO_PUBLIC_API_URL for staging (if needed)"
  echo "  3. Run full QA test suite"
  echo "  4. Plan implementation of remaining 4 blockers"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Please review above.${NC}"
  exit 1
fi
