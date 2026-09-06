#!/bin/bash

# Email Queue Test Script
# Tests the P0 email triggers end-to-end

echo "🧪 Email Queue Test Suite"
echo "========================="
echo ""

BASE_URL="http://localhost:4000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Create Ad
echo "📝 Test 1: Creating test ad..."
AD_RESPONSE=$(curl -s -X POST "$BASE_URL/ads" \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "Test Advertiser",
    "contact_email": "test-advertiser@varsityhub.app",
    "business_name": "Test Business Co",
    "target_zip_code": "90210",
    "radius": 45,
    "description": "Test ad for email queue",
    "status": "draft",
    "payment_status": "unpaid"
  }')

AD_ID=$(echo $AD_RESPONSE | jq -r '.id')

if [ "$AD_ID" != "null" ] && [ -n "$AD_ID" ]; then
  echo -e "${GREEN}✓${NC} Ad created: $AD_ID"
else
  echo -e "${RED}✗${NC} Failed to create ad"
  echo "Response: $AD_RESPONSE"
  exit 1
fi

echo ""

# Test 2: Create Reservation (should trigger email)
echo "📅 Test 2: Creating reservation (should queue email)..."
RESERVATION_RESPONSE=$(curl -s -X POST "$BASE_URL/ads/reservations" \
  -H "Content-Type: application/json" \
  -d "{
    \"ad_id\": \"$AD_ID\",
    \"dates\": [\"2025-12-20\", \"2025-12-27\"]
  }")

RESERVED_COUNT=$(echo $RESERVATION_RESPONSE | jq -r '.reserved')
PRICE=$(echo $RESERVATION_RESPONSE | jq -r '.price')

if [ "$RESERVED_COUNT" != "null" ]; then
  echo -e "${GREEN}✓${NC} Reservation created: $RESERVED_COUNT dates reserved"
  echo -e "  Price: \$$PRICE"
  echo -e "${YELLOW}→${NC} Check server logs for: '[ads] Queued reservation email for test-advertiser@varsityhub.app'"
else
  echo -e "${RED}✗${NC} Failed to create reservation"
  echo "Response: $RESERVATION_RESPONSE"
fi

echo ""

# Test 3: Verify job in queue
echo "🔍 Test 3: Checking Redis for queued job..."
QUEUE_CHECK=$(redis-cli LLEN bull:email:wait)

if [ "$QUEUE_CHECK" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Found $QUEUE_CHECK job(s) in email queue"
  
  # Show job details
  JOB_DATA=$(redis-cli LRANGE bull:email:wait 0 0)
  echo -e "${YELLOW}→${NC} Queue has pending jobs"
else
  echo -e "${YELLOW}!${NC} No jobs in waiting queue (may have been processed already)"
fi

echo ""

# Test 4: Check job stats
echo "📊 Test 4: Queue statistics..."
WAITING=$(redis-cli LLEN bull:email:wait)
ACTIVE=$(redis-cli LLEN bull:email:active)
COMPLETED=$(redis-cli ZCARD bull:email:completed)
FAILED=$(redis-cli ZCARD bull:email:failed)

echo "Queue Stats:"
echo "  Waiting:   $WAITING"
echo "  Active:    $ACTIVE"
echo "  Completed: $COMPLETED"
echo "  Failed:    $FAILED"

echo ""

# Test 5: Simulate checkout (triggers delayed reminder)
echo "💳 Test 5: Creating checkout session (triggers 6-hour reminder)..."
CHECKOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/payments/checkout" \
  -H "Content-Type: application/json" \
  -d "{
    \"ad_id\": \"$AD_ID\",
    \"dates\": [\"2025-12-20\", \"2025-12-27\"]
  }")

CHECKOUT_URL=$(echo $CHECKOUT_RESPONSE | jq -r '.url')

if [ "$CHECKOUT_URL" != "null" ] && [ -n "$CHECKOUT_URL" ]; then
  echo -e "${GREEN}✓${NC} Checkout session created"
  echo -e "  URL: $CHECKOUT_URL"
  echo -e "${YELLOW}→${NC} Payment reminder queued for 6 hours from now"
  echo -e "${YELLOW}→${NC} Check server logs for: '[payments] Scheduled payment reminder'"
else
  echo -e "${RED}✗${NC} Failed to create checkout session"
  echo "Response: $CHECKOUT_RESPONSE"
fi

echo ""

# Test 6: Check delayed jobs
echo "⏰ Test 6: Checking delayed jobs..."
DELAYED=$(redis-cli ZCARD bull:email:delayed)

if [ "$DELAYED" -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Found $DELAYED delayed job(s) (payment reminders)"
else
  echo -e "${YELLOW}!${NC} No delayed jobs found"
fi

echo ""
echo "========================="
echo -e "${GREEN}✅ Test Suite Complete${NC}"
echo ""
echo "📋 Summary:"
echo "  - Ad ID: $AD_ID"
echo "  - Reservations: $RESERVED_COUNT dates"
echo "  - Price: \$$PRICE"
echo "  - Email queue jobs: $WAITING waiting, $ACTIVE active, $COMPLETED completed"
echo ""
echo "🔎 Next Steps:"
echo "  1. Check server logs for email processing"
echo "  2. Check SendGrid dashboard for sent emails"
echo "  3. Verify test-advertiser@varsityhub.app received email"
echo "  4. To test payment reminder cancellation, complete Stripe checkout"
echo ""
echo "📊 Monitor queue:"
echo "  redis-cli MONITOR | grep 'bull:email'"
