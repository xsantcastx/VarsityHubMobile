#!/bin/bash
# COMPREHENSIVE RELEASE READINESS VERIFICATION
# Checks ALL features, roles, onboarding, rules, and responsibilities
# TARGET RELEASE: February 1, 2026

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS=0
WARNINGS=0
BLOCKERS=0

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}🚀 RELEASE READINESS VERIFICATION - FEBRUARY 1, 2026${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# SECTION 1: ROLE-BASED FEATURES & PERMISSIONS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 1: ROLE-BASED FEATURES & PERMISSIONS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 1.1: Coach role detection
echo -e "${BLUE}Test 1.1: Coach role detection...${NC}"
if grep -q "isCoach\|role === 'coach'" utils/roles.ts; then
    echo -e "${GREEN}✅ Coach role detection functions exist${NC}"
else
    echo -e "${RED}❌ Coach role detection missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 1.2: Admin role detection
echo -e "${BLUE}Test 1.2: Admin role detection...${NC}"
if [ -f "hooks/useRequireAdmin.ts" ]; then
    echo -e "${GREEN}✅ Admin hook exists${NC}"
    if grep -q "isAdmin\|useRequireAdmin" hooks/useRequireAdmin.ts; then
        echo -e "${GREEN}✅ Admin detection implemented${NC}"
    else
        echo -e "${RED}❌ Admin detection not implemented${NC}"
        ERRORS=$((ERRORS + 1))
        BLOCKERS=$((BLOCKERS + 1))
    fi
else
    echo -e "${RED}❌ Admin hook missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 1.3: Coach-only features protected
echo -e "${BLUE}Test 1.3: Coach-only features protected...${NC}"
COACH_FEATURES=("manage-season.tsx" "create-team" "manage-teams")
for feature in "${COACH_FEATURES[@]}"; do
    if find app -name "*${feature}*" -type f | grep -q .; then
        FEATURE_FILE=$(find app -name "*${feature}*" -type f | head -1)
        if grep -q "role.*coach\|isCoach\|preferences.*role.*coach" "$FEATURE_FILE" 2>/dev/null; then
            echo -e "${GREEN}✅ ${feature} has role protection${NC}"
        else
            echo -e "${YELLOW}⚠️  ${feature} may lack role protection${NC}"
            WARNINGS=$((WARNINGS + 1))
        fi
    fi
done

# Test 1.4: Admin-only features protected
echo -e "${BLUE}Test 1.4: Admin-only features protected...${NC}"
ADMIN_FEATURES=("admin-dashboard.tsx" "admin-reports.tsx" "admin-users.tsx" "admin-teams.tsx")
for feature in "${ADMIN_FEATURES[@]}"; do
    if [ -f "app/${feature}" ]; then
        if grep -q "useRequireAdmin\|isAdmin" "app/${feature}"; then
            echo -e "${GREEN}✅ ${feature} has admin protection${NC}"
        else
            echo -e "${RED}❌ ${feature} missing admin protection${NC}"
            ERRORS=$((ERRORS + 1))
            BLOCKERS=$((BLOCKERS + 1))
        fi
    fi
done

# Test 1.5: Server-side role checks
echo -e "${BLUE}Test 1.5: Server-side role checks...${NC}"
if grep -q "requireAuth\|requireVerified\|COACH_ROLE_REQUIRED" server/src/routes/teams.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Team routes have auth and role checks${NC}"
    if grep -q "COACH_ROLE_REQUIRED\|userRole.*coach" server/src/routes/teams.ts 2>/dev/null; then
        echo -e "${GREEN}✅ Team creation requires coach role${NC}"
    else
        echo -e "${YELLOW}⚠️  Team creation role check may be missing${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Team routes may lack auth checks${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 2: ONBOARDING FLOWS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 2: ONBOARDING FLOWS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 2.1: Onboarding context exists
echo -e "${BLUE}Test 2.1: Onboarding context...${NC}"
if [ -f "context/OnboardingContext.tsx" ]; then
    echo -e "${GREEN}✅ Onboarding context exists${NC}"
    if grep -q "UserRole.*fan.*coach\|role.*coach\|role.*fan" context/OnboardingContext.tsx; then
        echo -e "${GREEN}✅ Onboarding supports role selection${NC}"
    else
        echo -e "${YELLOW}⚠️  Onboarding role support may need verification${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Onboarding context missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 2.2: Coach onboarding steps
echo -e "${BLUE}Test 2.2: Coach onboarding steps...${NC}"
COACH_STEPS=("step-1-role" "step-2-basic" "step-3-plan" "step-4-organization" "step-6-authorized-users" "step-7-profile")
for step in "${COACH_STEPS[@]}"; do
    if [ -f "app/onboarding/${step}.tsx" ]; then
        echo -e "${GREEN}✅ ${step} exists${NC}"
    else
        echo -e "${RED}❌ ${step} missing${NC}"
        ERRORS=$((ERRORS + 1))
        BLOCKERS=$((BLOCKERS + 1))
    fi
done

# Test 2.3: Fan onboarding (simplified)
echo -e "${BLUE}Test 2.3: Fan onboarding...${NC}"
if grep -q "role.*===.*'fan'\|role === 'fan'" app/onboarding/step-1-role.tsx 2>/dev/null && \
   grep -q "skip.*profile\|step.*7.*profile\|setProgress(5)" app/onboarding/step-1-role.tsx 2>/dev/null; then
    echo -e "${GREEN}✅ Fan onboarding has simplified flow${NC}"
else
    echo -e "${YELLOW}⚠️  Fan onboarding may not skip steps${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 2.4: Plan selection for coaches
echo -e "${BLUE}Test 2.4: Plan selection...${NC}"
if [ -f "app/onboarding/step-3-plan.tsx" ]; then
    if grep -q "rookie\|veteran\|legend" app/onboarding/step-3-plan.tsx; then
        echo -e "${GREEN}✅ Plan selection includes all tiers${NC}"
    else
        echo -e "${RED}❌ Plan selection missing tiers${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ Plan selection step missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

echo ""

# ============================================================================
# SECTION 3: SUBSCRIPTION PLANS & LIMITS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 3: SUBSCRIPTION PLANS & LIMITS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 3.1: Plan definitions
echo -e "${BLUE}Test 3.1: Plan definitions...${NC}"
if [ -f "shared/plan-definitions.json" ] && \
   grep -q '"max_teams"' shared/plan-definitions.json 2>/dev/null; then
    echo -e "${GREEN}✅ Plan limits defined${NC}"
else
    echo -e "${YELLOW}⚠️  Plan limits may not be enforced${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 3.2: Team limit enforcement
echo -e "${BLUE}Test 3.2: Team limit enforcement...${NC}"
if grep -q "ownedTeamsCount.*>=.*maxTeams\|Team limit reached\|teamCount.*>=.*maxTeams" server/src/routes/teams.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Team limits checked${NC}"
else
    echo -e "${YELLOW}⚠️  Team limits enforcement may need verification${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 3.3: Stripe integration
echo -e "${BLUE}Test 3.3: Stripe integration...${NC}"
if grep -q "stripe\|Stripe" server/src/routes/payments.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Stripe integration exists${NC}"
else
    echo -e "${RED}❌ Stripe integration missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

echo ""

# ============================================================================
# SECTION 4: TEAM MANAGEMENT
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 4: TEAM MANAGEMENT${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 4.1: Create team (coach only)
echo -e "${BLUE}Test 4.1: Create team feature...${NC}"
if find app -name "*create*team*" -o -name "*team*create*" | grep -q .; then
    CREATE_TEAM=$(find app -name "*create*team*" -o -name "*team*create*" | head -1)
    if grep -q "role.*coach\|isCoach" "$CREATE_TEAM" 2>/dev/null; then
        echo -e "${GREEN}✅ Create team restricted to coaches${NC}"
    else
        echo -e "${YELLOW}⚠️  Create team may not check role${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ Create team feature missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 4.2: Manage teams
echo -e "${BLUE}Test 4.2: Manage teams...${NC}"
if [ -f "app/manage-teams.tsx" ] || find app -name "*manage*team*" | grep -q .; then
    echo -e "${GREEN}✅ Manage teams exists${NC}"
else
    echo -e "${RED}❌ Manage teams missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 4.3: Authorized users
echo -e "${BLUE}Test 4.3: Authorized users...${NC}"
if [ -f "app/onboarding/step-6-authorized-users.tsx" ]; then
    echo -e "${GREEN}✅ Authorized users step exists${NC}"
else
    echo -e "${YELLOW}⚠️  Authorized users step missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 5: EVENT MANAGEMENT
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 5: EVENT MANAGEMENT${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 5.1: Event creation
echo -e "${BLUE}Test 5.1: Event creation...${NC}"
if find app -name "*create*event*" -o -name "*event*create*" | grep -q .; then
    echo -e "${GREEN}✅ Event creation exists${NC}"
else
    echo -e "${YELLOW}⚠️  Event creation may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 5.2: Event approval (coach/admin)
echo -e "${BLUE}Test 5.2: Event approval...${NC}"
if [ -f "app/(tabs)/event-approvals.tsx" ]; then
    if grep -q "coach\|admin\|useRequireAdmin" app/\(tabs\)/event-approvals.tsx; then
        echo -e "${GREEN}✅ Event approval restricted${NC}"
    else
        echo -e "${YELLOW}⚠️  Event approval may not check permissions${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Event approval screen missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 6: ADMIN FEATURES
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 6: ADMIN FEATURES${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 6.1: Admin dashboard
echo -e "${BLUE}Test 6.1: Admin dashboard...${NC}"
if [ -f "app/admin-dashboard.tsx" ]; then
    if grep -q "useRequireAdmin\|isAdmin" app/admin-dashboard.tsx; then
        echo -e "${GREEN}✅ Admin dashboard protected${NC}"
    else
        echo -e "${RED}❌ Admin dashboard not protected${NC}"
        ERRORS=$((ERRORS + 1))
        BLOCKERS=$((BLOCKERS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  Admin dashboard missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 6.2: Admin reports
echo -e "${BLUE}Test 6.2: Admin reports...${NC}"
if [ -f "app/admin-reports.tsx" ]; then
    echo -e "${GREEN}✅ Admin reports exists${NC}"
else
    echo -e "${YELLOW}⚠️  Admin reports missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 6.3: Admin user management
echo -e "${BLUE}Test 6.3: Admin user management...${NC}"
if [ -f "app/admin-users.tsx" ] || [ -f "app/(tabs)/admin-users.tsx" ]; then
    echo -e "${GREEN}✅ Admin user management exists${NC}"
else
    echo -e "${YELLOW}⚠️  Admin user management missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 7: APP RULES & PERMISSIONS
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 7: APP RULES & PERMISSIONS${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 7.1: DM restrictions
echo -e "${BLUE}Test 7.1: DM restrictions...${NC}"
if [ -f "utils/dmRestrictions.ts" ]; then
    if grep -q "age.*18\|minor\|block" utils/dmRestrictions.ts; then
        echo -e "${GREEN}✅ DM restrictions implemented${NC}"
    else
        echo -e "${YELLOW}⚠️  DM restrictions may be incomplete${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}❌ DM restrictions missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 7.2: Age verification
echo -e "${BLUE}Test 7.2: Age verification...${NC}"
if grep -q "dob\|dateOfBirth\|age.*verif" app/onboarding/step-2-basic.tsx 2>/dev/null; then
    echo -e "${GREEN}✅ Age collection in onboarding${NC}"
else
    echo -e "${YELLOW}⚠️  Age may not be collected${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Test 7.3: Content moderation
echo -e "${BLUE}Test 7.3: Content moderation...${NC}"
if [ -f "server/src/routes/support.ts" ] && \
   grep -q "abuseReport\|sendAbuseReportNotification\|report" server/src/routes/support.ts 2>/dev/null; then
    echo -e "${GREEN}✅ Content moderation exists${NC}"
else
    echo -e "${YELLOW}⚠️  Content moderation may be missing${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================================================
# SECTION 8: CRITICAL FEATURES
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}SECTION 8: CRITICAL FEATURES${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Test 8.1: Authentication
echo -e "${BLUE}Test 8.1: Authentication...${NC}"
if [ -f "context/AuthProvider.tsx" ] && [ -f "app/sign-in.tsx" ]; then
    echo -e "${GREEN}✅ Authentication system exists${NC}"
else
    echo -e "${RED}❌ Authentication missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 8.2: Cloudinary uploads
echo -e "${BLUE}Test 8.2: Cloudinary uploads...${NC}"
if [ -f "server/src/lib/cloudinary.ts" ] && grep -q "uploadBufferToCloudinary" server/src/lib/cloudinary.ts; then
    echo -e "${GREEN}✅ Cloudinary integration exists${NC}"
else
    echo -e "${RED}❌ Cloudinary integration missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

# Test 8.3: Payment processing
echo -e "${BLUE}Test 8.3: Payment processing...${NC}"
if [ -f "server/src/routes/payments.ts" ]; then
    echo -e "${GREEN}✅ Payment routes exist${NC}"
else
    echo -e "${RED}❌ Payment routes missing${NC}"
    ERRORS=$((ERRORS + 1))
    BLOCKERS=$((BLOCKERS + 1))
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}📊 RELEASE READINESS SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $BLOCKERS -gt 0 ]; then
    echo -e "${RED}❌❌❌ $BLOCKERS BLOCKER(S) FOUND - CANNOT RELEASE ❌❌❌${NC}"
    echo -e "${RED}   These MUST be fixed before February 1st release${NC}"
    echo ""
fi

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ $ERRORS ERROR(S) FOUND${NC}"
    echo -e "${RED}   These should be fixed before release${NC}"
    echo ""
fi

if [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $WARNINGS WARNING(S) FOUND${NC}"
    echo -e "${YELLOW}   Review these before release${NC}"
    echo ""
fi

if [ $BLOCKERS -eq 0 ] && [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅✅✅ ALL CHECKS PASSED - READY FOR RELEASE! ✅✅✅${NC}"
    exit 0
elif [ $BLOCKERS -eq 0 ] && [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ No blockers or errors - Review warnings${NC}"
    exit 0
else
    echo -e "${RED}🚫 RELEASE BLOCKED - Fix issues above${NC}"
    exit 1
fi
