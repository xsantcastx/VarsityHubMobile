#!/bin/bash

# VarsityHub Smoke Test
# Quick validation of critical production components

set -e

API_URL="${API_URL:-https://api-production-8ac3.up.railway.app}"

echo "═══════════════════════════════════════════════════════════"
echo "  VarsityHub Production Smoke Test"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "API URL: $API_URL"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_check() {
  local test_name="$1"
  local command="$2"
  
  echo "TEST: $test_name"
  echo "─────────────────────────────────────────────────────────"
  
  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: $test_name"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: $test_name"
    ((FAIL_COUNT++))
  fi
  echo ""
}

# Test 1: API Health Check
echo "═══════════════════════════════════════════════════════════"
echo "  Section 1: API Health & Connectivity"
echo "═══════════════════════════════════════════════════════════"
echo ""

test_check "API is reachable" "curl -s --connect-timeout 5 '$API_URL/health' | jq -e '.status == \"ok\"'"

# Test 2: Integrations Check
echo "═══════════════════════════════════════════════════════════"
echo "  Section 2: Core Integrations"
echo "═══════════════════════════════════════════════════════════"
echo ""

HEALTH_JSON=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")

test_check "Stripe configured" "echo '$HEALTH_JSON' | jq -e '.integrations.stripe == true'"
test_check "SendGrid configured" "echo '$HEALTH_JSON' | jq -e '.integrations.sendgrid == true'"
test_check "Database connected" "echo '$HEALTH_JSON' | jq -e '.integrations.database == true'"
test_check "JWT configured" "echo '$HEALTH_JSON' | jq -e '.integrations.jwt == true'"

# Test 3: Critical Endpoints
echo "═══════════════════════════════════════════════════════════"
echo "  Section 3: Critical Endpoints"
echo "═══════════════════════════════════════════════════════════"
echo ""

test_check "Health endpoint responds" "curl -s --connect-timeout 5 '$API_URL/health' | jq -e '.status'"
test_check "Health endpoint has timestamp" "curl -s --connect-timeout 5 '$API_URL/health' | jq -e '.timestamp'"

# Test 4: Transaction Reporting (Code Verification)
echo "═══════════════════════════════════════════════════════════"
echo "  Section 4: Transaction Reporting"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Check if transaction logger functions exist
if [ -f "server/src/lib/transactionLogger.ts" ]; then
  if grep -q "getEndOfDayReport" server/src/lib/transactionLogger.ts; then
    echo -e "${GREEN}✅ PASS${NC}: Transaction report function exists"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Transaction report function missing"
    ((FAIL_COUNT++))
  fi
  echo ""
  
  if grep -q "sendEndOfDayTransactionReport" server/src/lib/email.ts 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Transaction report email function exists"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Transaction report email function missing"
    ((FAIL_COUNT++))
  fi
  echo ""
  
  if grep -q "end-of-day-transaction-report" server/src/jobs/scheduler.ts 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}: Transaction report scheduled job configured"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Transaction report scheduled job missing"
    ((FAIL_COUNT++))
  fi
  echo ""
else
  echo -e "${RED}❌ FAIL${NC}: Transaction logger file not found"
  ((FAIL_COUNT++))
  echo ""
fi

# Test 5: Email Configuration
echo "═══════════════════════════════════════════════════════════"
echo "  Section 5: Email Configuration"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ -f "server/src/lib/email.ts" ]; then
  if grep -q "noreply@varsityhub.app" server/src/lib/email.ts; then
    echo -e "${GREEN}✅ PASS${NC}: Email FROM address configured (noreply@varsityhub.app)"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Email FROM address not configured"
    ((FAIL_COUNT++))
  fi
  echo ""
else
  echo -e "${RED}❌ FAIL${NC}: Email service file not found"
  ((FAIL_COUNT++))
  echo ""
fi

# Test 6: Stripe Integration (Code Verification)
echo "═══════════════════════════════════════════════════════════"
echo "  Section 6: Stripe Integration"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ -f "server/src/routes/payments.ts" ]; then
  if grep -q "logTransaction" server/src/routes/payments.ts; then
    echo -e "${GREEN}✅ PASS${NC}: Transaction logging integrated in payments"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Transaction logging not integrated"
    ((FAIL_COUNT++))
  fi
  echo ""
  
  if grep -q "finalizeFromSession" server/src/routes/payments.ts; then
    echo -e "${GREEN}✅ PASS${NC}: Payment finalization function exists"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Payment finalization missing"
    ((FAIL_COUNT++))
  fi
  echo ""
  
  if grep -q "checkout.session.completed" server/src/routes/payments.ts; then
    echo -e "${GREEN}✅ PASS${NC}: Webhook handler for checkout.session.completed"
    ((PASS_COUNT++))
  else
    echo -e "${RED}❌ FAIL${NC}: Webhook handler missing"
    ((FAIL_COUNT++))
  fi
  echo ""
else
  echo -e "${RED}❌ FAIL${NC}: Payments route file not found"
  ((FAIL_COUNT++))
  echo ""
fi

# Summary
echo "═══════════════════════════════════════════════════════════"
echo "  Smoke Test Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $((PASS_COUNT + FAIL_COUNT))"
echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  echo ""
  echo "System is operational and ready for production use!"
  exit 0
else
  echo -e "${YELLOW}⚠️  SOME TESTS FAILED${NC}"
  echo ""
  echo "Review failed tests above and verify configuration."
  exit 1
fi
