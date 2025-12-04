#!/bin/bash

# Email Verification Testing Script
# Tests email and SMS sending, registration flow, and verification endpoints
# Usage: ./scripts/email-verification-test.sh

set -e

API_URL="${API_URL:-http://localhost:4000}"
TEST_EMAIL="${TEST_EMAIL:-test-$(date +%s)@varsityhub.app}"
TEST_PASSWORD="TestPassword123!"

echo "🧪 VarsityHub Email & SMS Verification Tests"
echo "=============================================="
echo ""
echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${BLUE}[1/6] Health Check${NC}"
echo "Testing: GET $API_URL/health"
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
echo "$HEALTH_RESPONSE" | jq .

SENDGRID_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.sendgrid')
TWILIO_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.twilio')

if [ "$SENDGRID_STATUS" = "true" ]; then
  echo -e "${GREEN}✅ SendGrid configured${NC}"
else
  echo -e "${YELLOW}⚠️  SendGrid not configured - email will not send${NC}"
fi

if [ "$TWILIO_STATUS" = "true" ]; then
  echo -e "${GREEN}✅ Twilio configured${NC}"
else
  echo -e "${YELLOW}⚠️  Twilio not configured - SMS will not send${NC}"
fi
echo ""

# Test 2: Test Email Endpoint
if [ "$SENDGRID_STATUS" = "true" ]; then
  echo -e "${BLUE}[2/6] Test Email Endpoint${NC}"
  echo "Testing: POST $API_URL/auth/test-email"
  TEST_EMAIL_RESPONSE=$(curl -s -X POST "$API_URL/auth/test-email" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\"}")
  echo "$TEST_EMAIL_RESPONSE" | jq .
  
  TEST_EMAIL_SUCCESS=$(echo "$TEST_EMAIL_RESPONSE" | jq -r '.success // .error')
  if [[ "$TEST_EMAIL_SUCCESS" == "true" ]]; then
    echo -e "${GREEN}✅ Test email sent successfully${NC}"
  else
    echo -e "${RED}❌ Test email failed${NC}"
  fi
  echo ""
else
  echo -e "${YELLOW}⚠️  Skipping test email (SendGrid not configured)${NC}"
  echo ""
fi

# Test 3: Registration
echo -e "${BLUE}[3/6] User Registration${NC}"
echo "Testing: POST $API_URL/auth/register"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\":\"$TEST_EMAIL\",
    \"password\":\"$TEST_PASSWORD\",
    \"display_name\":\"Test User\",
    \"role\":\"fan\"
  }")
echo "$REGISTER_RESPONSE" | jq .

ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.access_token // empty')
DEV_CODE=$(echo "$REGISTER_RESPONSE" | jq -r '.dev_verification_code // empty')
USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id // empty')

if [ -n "$ACCESS_TOKEN" ]; then
  echo -e "${GREEN}✅ Registration successful${NC}"
  if [ -n "$DEV_CODE" ]; then
    echo -e "${BLUE}   Dev Code: $DEV_CODE${NC}"
  fi
else
  echo -e "${RED}❌ Registration failed${NC}"
  exit 1
fi
echo ""

# Test 4: Request New Verification Code
echo -e "${BLUE}[4/6] Request Verification Code (Resend)${NC}"
echo "Testing: POST $API_URL/auth/verify/request"
RESEND_RESPONSE=$(curl -s -X POST "$API_URL/auth/verify/request" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$RESEND_RESPONSE" | jq .

RESEND_CODE=$(echo "$RESEND_RESPONSE" | jq -r '.dev_verification_code // empty')
if [ -n "$RESEND_CODE" ]; then
  echo -e "${BLUE}   Resend Dev Code: $RESEND_CODE${NC}"
  DEV_CODE="$RESEND_CODE"  # Use most recent code
fi
echo ""

# Test 5: Verify Email with Code
if [ -n "$DEV_CODE" ]; then
  echo -e "${BLUE}[5/6] Verify Email with Code${NC}"
  echo "Testing: POST $API_URL/auth/verify/confirm with code=$DEV_CODE"
  VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/auth/verify/confirm" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "{\"code\":\"$DEV_CODE\"}")
  echo "$VERIFY_RESPONSE" | jq .
  
  VERIFY_OK=$(echo "$VERIFY_RESPONSE" | jq -r '.ok // empty')
  if [ "$VERIFY_OK" = "true" ]; then
    echo -e "${GREEN}✅ Email verified successfully${NC}"
  else
    echo -e "${RED}❌ Email verification failed${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping verification (no dev code available)${NC}"
fi
echo ""

# Test 6: Rate Limiting (Resend more than 5 times)
echo -e "${BLUE}[6/6] Rate Limiting Test${NC}"
echo "Testing: Resending code 6 times to trigger 429"
for i in {1..6}; do
  RATE_TEST=$(curl -s -X POST "$API_URL/auth/verify/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/auth/verify/request" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  
  if [ "$HTTP_CODE" = "429" ]; then
    echo -e "${GREEN}✅ Rate limit triggered on attempt $i (HTTP 429)${NC}"
    break
  elif [ $i -eq 6 ]; then
    echo -e "${YELLOW}⚠️  Rate limit not triggered after 6 attempts${NC}"
  else
    echo "  Attempt $i: HTTP $HTTP_CODE"
  fi
done
echo ""

# Summary
echo "=============================================="
echo -e "${GREEN}✅ Email Verification Test Complete${NC}"
echo ""
echo "Next Steps:"
if [ "$SENDGRID_STATUS" = "true" ]; then
  echo "1. ✅ SendGrid is configured - emails should be sending"
  echo "2. Check your inbox for verification emails"
  echo "3. Monitor SendGrid dashboard for delivery status"
else
  echo "1. ⚠️  SendGrid needs configuration - add to server/.env:"
  echo "   SENDGRID_API_KEY=SG.xxxxx"
  echo "   SENDGRID_VERIFICATION_TEMPLATE_ID=d-xxxxx"
fi

if [ "$TWILIO_STATUS" = "true" ]; then
  echo "4. ✅ Twilio is configured - SMS verification available"
else
  echo "4. ⚠️  Twilio is optional - add to server/.env for SMS:"
  echo "   TWILIO_ACCOUNT_SID=ACxxxxx"
  echo "   TWILIO_AUTH_TOKEN=xxxxx"
  echo "   TWILIO_FROM_PHONE=+1234567890"
fi
echo ""
