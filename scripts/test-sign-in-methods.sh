#!/bin/bash

# Test Sign-In Methods
# This script verifies that all sign-in methods are properly configured and working

echo "🧪 Testing Sign-In Methods"
echo "=========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Please run this script from the VarsityHubMobile root directory${NC}"
    exit 1
fi

echo "1️⃣  Checking sign-in code structure..."
echo ""

# Check sign-in.tsx exists and has all methods
if [ -f "app/sign-in.tsx" ]; then
    echo -e "${GREEN}✅ app/sign-in.tsx exists${NC}"
    
    # Check for email/password login
    if grep -q "onSubmit.*async" app/sign-in.tsx && grep -q "loginViaEmailPassword" app/sign-in.tsx; then
        echo -e "${GREEN}✅ Email/Password login method found${NC}"
    else
        echo -e "${RED}❌ Email/Password login method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for Google login
    if grep -q "handleGoogleLogin" app/sign-in.tsx && grep -q "signInWithGoogle" app/sign-in.tsx; then
        echo -e "${GREEN}✅ Google sign-in method found${NC}"
    else
        echo -e "${RED}❌ Google sign-in method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for Apple login
    if grep -q "handleAppleLogin" app/sign-in.tsx && grep -q "signInWithApple" app/sign-in.tsx; then
        echo -e "${GREEN}✅ Apple sign-in method found${NC}"
    else
        echo -e "${RED}❌ Apple sign-in method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    # Check for error handling
    if grep -q "setError" app/sign-in.tsx && grep -q "access_token" app/sign-in.tsx; then
        echo -e "${GREEN}✅ Error handling and token validation found${NC}"
    else
        echo -e "${YELLOW}⚠️  Error handling may be incomplete${NC}"
    fi
else
    echo -e "${RED}❌ app/sign-in.tsx not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "2️⃣  Checking API methods..."
echo ""

# Check auth.ts
if [ -f "api/auth.ts" ]; then
    echo -e "${GREEN}✅ api/auth.ts exists${NC}"
    
    if grep -q "login.*email.*password" api/auth.ts; then
        echo -e "${GREEN}✅ Email/password login API method found${NC}"
    else
        echo -e "${RED}❌ Email/password login API method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "loginWithGoogle" api/auth.ts; then
        echo -e "${GREEN}✅ Google login API method found${NC}"
    else
        echo -e "${RED}❌ Google login API method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "loginWithApple" api/auth.ts; then
        echo -e "${GREEN}✅ Apple login API method found${NC}"
    else
        echo -e "${RED}❌ Apple login API method missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ api/auth.ts not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "3️⃣  Checking hooks..."
echo ""

# Check Google auth hook
if [ -f "hooks/useGoogleAuth.ts" ]; then
    echo -e "${GREEN}✅ hooks/useGoogleAuth.ts exists${NC}"
    if grep -q "signInWithGoogle" hooks/useGoogleAuth.ts; then
        echo -e "${GREEN}✅ Google auth hook properly configured${NC}"
    else
        echo -e "${RED}❌ Google auth hook missing signInWithGoogle${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ hooks/useGoogleAuth.ts not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check Apple auth hook
if [ -f "hooks/useAppleAuth.ts" ]; then
    echo -e "${GREEN}✅ hooks/useAppleAuth.ts exists${NC}"
    if grep -q "signInWithApple" hooks/useAppleAuth.ts; then
        echo -e "${GREEN}✅ Apple auth hook properly configured${NC}"
    else
        echo -e "${RED}❌ Apple auth hook missing signInWithApple${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ hooks/useAppleAuth.ts not found${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "4️⃣  Checking error handling improvements..."
echo ""

# Check for improved error messages
if grep -q "Invalid email or password" app/sign-in.tsx; then
    echo -e "${GREEN}✅ User-friendly error messages found${NC}"
else
    echo -e "${YELLOW}⚠️  User-friendly error messages may be missing${NC}"
fi

# Check for access_token validation
if grep -q "access_token" app/sign-in.tsx | grep -q "response"; then
    echo -e "${GREEN}✅ Token validation found${NC}"
else
    echo -e "${YELLOW}⚠️  Token validation may be incomplete${NC}"
fi

# Check for logging
if grep -q "console.log.*sign-in" app/sign-in.tsx || grep -q "console.log.*\[sign-in\]" app/sign-in.tsx; then
    echo -e "${GREEN}✅ Debug logging found${NC}"
else
    echo -e "${YELLOW}⚠️  Debug logging may be missing${NC}"
fi

echo ""
echo "5️⃣  Checking backend endpoints..."
echo ""

# Check if server routes exist
if [ -d "server/src/routes" ] && [ -f "server/src/routes/auth.ts" ]; then
    echo -e "${GREEN}✅ Backend auth routes found${NC}"
    
    if grep -q "authRouter.post.*login" server/src/routes/auth.ts; then
        echo -e "${GREEN}✅ Email/password login endpoint found${NC}"
    else
        echo -e "${RED}❌ Email/password login endpoint missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "authRouter.post.*google" server/src/routes/auth.ts; then
        echo -e "${GREEN}✅ Google login endpoint found${NC}"
    else
        echo -e "${RED}❌ Google login endpoint missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    
    if grep -q "authRouter.post.*apple" server/src/routes/auth.ts; then
        echo -e "${GREEN}✅ Apple login endpoint found${NC}"
    else
        echo -e "${RED}❌ Apple login endpoint missing${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Backend routes not found (may be in different location)${NC}"
fi

echo ""
echo "=========================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All sign-in methods verified!${NC}"
    echo ""
    echo "📋 Manual Test Checklist:"
    echo ""
    echo "1. Email/Password Login:"
    echo "   - Try valid credentials → Should login successfully"
    echo "   - Try invalid password → Should show 'Invalid email or password'"
    echo "   - Try non-existent email → Should show 'Invalid email or password'"
    echo ""
    echo "2. Google Sign-In:"
    echo "   - Click 'Continue with Google' → Should open Google OAuth"
    echo "   - Complete OAuth → Should login successfully"
    echo "   - Cancel OAuth → Should not show error"
    echo ""
    echo "3. Apple Sign-In (iOS only):"
    echo "   - Click Apple sign-in button → Should open Apple auth"
    echo "   - Complete Apple auth → Should login successfully"
    echo "   - Cancel Apple auth → Should not show error"
    echo ""
    echo "4. Error Handling:"
    echo "   - Check console logs for debug messages"
    echo "   - Verify error messages are user-friendly"
    echo "   - Test network errors (airplane mode)"
    echo ""
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS issue(s)${NC}"
    echo ""
    echo "Please fix the issues above before testing."
    exit 1
fi
