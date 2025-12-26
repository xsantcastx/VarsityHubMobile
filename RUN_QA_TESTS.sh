#!/bin/bash
# VarsityHub Pre-Launch QA Checklist
# Run this script to perform critical pre-submission tests

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  VarsityHub iOS - Pre-Launch QA Testing Guide${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to prompt for manual test verification
check_manual() {
  local test_name="$1"
  local instructions="$2"
  
  echo -e "\n${YELLOW}▶ ${test_name}${NC}"
  echo -e "   ${instructions}"
  echo -n "   Did this test PASS? (y/n): "
  read -r response
  
  if [[ "$response" =~ ^[Yy]$ ]]; then
    echo -e "   ${GREEN}✅ PASSED${NC}"
    return 0
  else
    echo -e "   ${RED}❌ FAILED${NC}"
    echo -n "   Add notes (optional): "
    read -r notes
    if [ -n "$notes" ]; then
      echo "      Notes: $notes" >> qa-failures.log
    fi
    return 1
  fi
}

# Initialize counters
PASSED=0
FAILED=0
TOTAL=0

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 1: TEAM LIMITS (CRITICAL)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 1: Team Limits (Plan Enforcement) ━━━${NC}"

if check_manual "1.1 Rookie Plan - 2 Team Cap" \
  "1. Sign up as coach with Rookie plan\n   2. Create 1st team → Should succeed\n   3. Create 2nd team → Should succeed\n   4. Try creating 3rd team → Should show 'Limit reached' warning + disabled button"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "1.2 Veteran Plan - Team Limits Display" \
  "1. Upgrade to Veteran plan\n   2. Go to create-team page\n   3. Plan summary card should show: 'Veteran' badge + current team count + remaining slots\n   4. Create button should be enabled"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "1.3 Legend Plan - Unlimited Message" \
  "1. Upgrade to Legend plan\n   2. Go to create-team page\n   3. Plan summary should show 'Unlimited teams' message\n   4. No limit warnings should appear"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "1.4 Paywall Link Navigation" \
  "1. As Rookie with 2 teams created\n   2. Go to create-team\n   3. Click 'View plans' link in warning banner\n   4. Should navigate to /subscription-paywall screen"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 2: PAYMENT FLOW (CRITICAL)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 2: Payment & Billing ━━━${NC}"

if check_manual "2.1 Veteran Subscription Checkout" \
  "1. Go to subscription-paywall or onboarding step-3\n   2. Select Veteran plan (\\$1.50/month per team)\n   3. Click subscribe → Stripe Checkout should open\n   4. Use test card: 4242 4242 4242 4242, any future date, any CVC\n   5. Complete payment → Should redirect to payment-success page"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "2.2 Legend One-Time Payment Checkout" \
  "1. Go to subscription-paywall or onboarding step-3\n   2. Select Legend plan (\\$19.99/year)\n   3. Checkout should show: 'Pay \\$19.99' (NOT '\\$1.66/month billed annually')\n   4. Complete payment with test card\n   5. Should redirect to payment-success"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "2.3 Payment Success - Retry Logic" \
  "1. After completing payment, stay on payment-success page\n   2. Watch for 'Verifying...' message (retries up to 5 times, 2s intervals)\n   3. User.plan should update within 10 seconds\n   4. Should auto-navigate to next step or dashboard"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "2.4 Billing Screen - Plan Display" \
  "1. After payment success, go to /billing\n   2. Should show active plan (Veteran or Legend)\n   3. Plan description should be visible\n   4. For Legend: Should show '\\$19.99/year unlimited' (not subscription ID)"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 3: EMAIL VERIFICATION (CRITICAL)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 3: Email Verification Flow ━━━${NC}"

if check_manual "3.1 Signup - Code Delivery" \
  "1. Sign up with real email address\n   2. Check inbox within 10 seconds\n   3. Email should arrive from noreply@varsityhub.app\n   4. Code should be 6 digits\n   5. Template should render correctly (no {{variables}})"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "3.2 Code Entry - Success" \
  "1. On verify-email screen, enter 6-digit code from email\n   2. Should accept code and verify account\n   3. Coach → should redirect to onboarding step-1\n   4. Fan → should redirect to feed"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "3.3 Rate Limiting - 30 Second Cooldown" \
  "1. On verify-email screen, click 'Resend Code'\n   2. Button should disable for 30 seconds\n   3. Try clicking again → Should show '30 seconds' countdown\n   4. After 30s, button should re-enable"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "3.4 Rate Limiting - 5 Per Hour" \
  "1. Send verification code 5 times (wait 30s between each)\n   2. On 6th attempt, should show error: 'Too many attempts'\n   3. Should lock out for remaining hour"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "3.5 Code Expiration - 30 Minutes" \
  "1. Request verification code\n   2. Wait 31 minutes (or manually expire via database)\n   3. Try entering expired code\n   4. Should show error: 'Code expired' or 'Invalid code'"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 4: ONBOARDING FLOW (CRITICAL)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 4: Onboarding Completion ━━━${NC}"

if check_manual "4.1 Step Progression (Coach)" \
  "1. Complete email verification as coach\n   2. Should navigate through: step-1 → step-2 → step-3 → step-4\n   3. After step-4 (org creation), should proceed to step-6 (authorized users)\n   4. Step-5 should be SKIPPED (removed from flow)"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "4.2 Optional Steps - Skip Without Blocking" \
  "1. On step-6 (authorized users), click Next WITHOUT adding users\n   2. Should proceed to step-7 (interests)\n   3. Skip interests → should proceed to step-8\n   4. Skip features → should proceed to step-10 (confirmation)"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "4.3 Confirmation Screen - All Steps Complete" \
  "1. Reach step-10-confirmation\n   2. All checkboxes should show green checkmarks (even if skipped)\n   3. 'Complete Setup' button should be enabled\n   4. Click button → should mark onboarding complete"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "4.4 Post-Onboarding - Correct Destination" \
  "1. Complete onboarding as coach → Should redirect to /create-team or /my-team\n   2. Complete onboarding as fan → Should redirect to /feed\n   3. Should NOT see onboarding screens again on app restart"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 5: UI/UX IMPROVEMENTS (HIGH PRIORITY)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 5: Recent UI Enhancements ━━━${NC}"

if check_manual "5.1 Input Contrast - White Background" \
  "1. Go to any onboarding step with text inputs (step-6, step-4)\n   2. Input fields should have WHITE background (#fff)\n   3. Text should be BLACK (#111827)\n   4. Border should be BLACK\n   5. Easy to read in both light and dark mode"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "5.2 Email Autocomplete Disabled" \
  "1. On iOS device, tap email input field\n   2. Should NOT show autocomplete suggestion popup above keyboard\n   3. Still allows typing, but no floating suggestions"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "5.3 Team Assignment Field Positioning" \
  "1. On step-6 (authorized users), add new user flow:\n   2. Email field should be first\n   3. Role picker should be second\n   4. Team assignment field should be AFTER role picker\n   5. Logical top-to-bottom flow"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "5.4 Profile Stats - No Duplicates" \
  "1. Navigate to user-profile page\n   2. Should see ONE stats row: POSTS | FOLLOWERS | FOLLOWING\n   3. Stats should NOT be clickable (plain View, not Pressable)\n   4. No duplicate stats below profile identity"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "5.5 Plan Card Icons - Color Coding" \
  "1. On step-3-plan (plan selection), view 3 plan cards\n   2. Rookie icon: Bronze color (#CD7F32)\n   3. Veteran icon: Silver color (#9CA3AF)\n   4. Legend icon: Gold color (#F59E0B)\n   5. Side buttons match icon colors"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 6: BACKEND INTEGRATION (HIGH PRIORITY)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 6: Backend & API ━━━${NC}"

if check_manual "6.1 Production API Health Check" \
  "1. Open browser: https://api-production-8ac3.up.railway.app/health\n   2. Should return JSON: {\"status\":\"ok\",\"timestamp\":\"...\"}\n   3. Response time should be < 500ms"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "6.2 Geocoding Autocomplete - Client Fallback" \
  "1. On step-4 (organization), enter location search\n   2. Type 'New York' in location field\n   3. Should show autocomplete suggestions (from Google Maps client-side)\n   4. Should NOT see 404 errors in console (api/geocoding/autocomplete)"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "6.3 Auth Rate Limiter - Failed Attempts Only" \
  "1. Try logging in with CORRECT credentials 10 times\n   2. Should NOT get rate limited (skipSuccessfulRequests=true)\n   3. Try logging in with WRONG credentials 5 times\n   4. Should get rate limited after 5 failed attempts"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "6.4 Stripe Webhook Processing" \
  "1. Complete a payment (Veteran or Legend)\n   2. Check Railway logs: railway logs --tail 50\n   3. Should see webhook event: 'checkout.session.completed'\n   4. User preferences should update within 5 seconds\n   5. No 500 errors in logs"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SECTION 7: ERROR HANDLING (MEDIUM PRIORITY)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━ SECTION 7: Error Handling & Recovery ━━━${NC}"

if check_manual "7.1 Network Error Recovery" \
  "1. Enable Airplane Mode on device\n   2. Try loading feed or profile\n   3. Should show graceful error message (not crash)\n   4. Disable Airplane Mode\n   5. App should recover and load data"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "7.2 Sentry Error Tracking" \
  "1. Check Sentry dashboard: https://sentry.io/organizations/varsity-hub/projects/varsityhubmobile/\n   2. Should see recent sessions tracked\n   3. No critical errors in last 24 hours\n   4. If errors exist, verify they're known/handled"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

if check_manual "7.3 Payment Failure Handling" \
  "1. Use declined test card: 4000 0000 0000 0002\n   2. Try completing payment\n   3. Should show error message from Stripe\n   4. Should NOT mark plan as upgraded\n   5. User can retry with valid card"; then
  ((PASSED++))
else
  ((FAILED++))
fi
((TOTAL++))

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RESULTS SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}                   TEST RESULTS SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "   Total Tests:    ${TOTAL}"
echo -e "   ${GREEN}Passed:         ${PASSED}${NC}"
echo -e "   ${RED}Failed:         ${FAILED}${NC}"
echo ""

PASS_RATE=$((PASSED * 100 / TOTAL))

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED! Ready for App Store submission.${NC}"
  echo ""
  echo -e "${BLUE}Next Steps:${NC}"
  echo "1. Ensure SendGrid environment variables are set in Railway"
  echo "2. Verify production API is running: curl https://api-production-8ac3.up.railway.app/health"
  echo "3. Run: eas submit --platform ios --latest"
  echo ""
  exit 0
elif [ $PASS_RATE -ge 90 ]; then
  echo -e "${YELLOW}⚠️  ${FAILED} tests failed, but pass rate is ${PASS_RATE}%. Review failures before submission.${NC}"
  echo ""
  echo "Review failure log: cat qa-failures.log"
  echo ""
  exit 1
else
  echo -e "${RED}❌ ${FAILED} tests failed (${PASS_RATE}% pass rate). Fix critical issues before submission.${NC}"
  echo ""
  echo "Review failure log: cat qa-failures.log"
  echo ""
  exit 1
fi
