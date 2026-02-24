#!/bin/bash
# Quick Email Test Script
# Tests email configuration and sends test emails

cd "$(dirname "$0")/../server" || exit 1

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              📧 EMAIL SYSTEM QUICK TEST                        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
  echo "❌ ERROR: server/.env file not found"
  exit 1
fi

# Load .env variables
export $(grep -v '^#' .env | xargs)

echo "🔧 STEP 1: CHECKING EMAIL CONFIGURATION"
echo "─────────────────────────────────────────────────────────────────"

# Check SendGrid API Key
if [ -z "$SENDGRID_API_KEY" ]; then
  echo "❌ SENDGRID_API_KEY: NOT SET"
else
  MASKED_KEY="${SENDGRID_API_KEY:0:8}...${SENDGRID_API_KEY: -4}"
  echo "✅ SENDGRID_API_KEY: Configured ($MASKED_KEY)"
fi

# Check Email From
EMAIL_FROM="${EMAIL_FROM:-${FROM_EMAIL:-noreply@varsityhub.app}}"
echo "📧 EMAIL_FROM: $EMAIL_FROM"

# Check Template IDs
echo ""
echo "📋 CHECKING TEMPLATE IDs:"
TEMPLATES=(
  "VERIFICATION:SENDGRID_VERIFICATION_TEMPLATE_ID"
  "PASSWORD_RESET:SENDGRID_PASSWORD_RESET_TEMPLATE_ID"
  "TEAM_INVITE:SENDGRID_TEAM_INVITE_TEMPLATE_ID"
  "ORG_INVITE:SENDGRID_ORG_INVITE_TEMPLATE_ID"
)

MISSING_TEMPLATES=()
for TEMPLATE in "${TEMPLATES[@]}"; do
  IFS=':' read -r NAME VAR <<< "$TEMPLATE"
  VAR_VALUE=$(eval echo \$$VAR)
  if [ -z "$VAR_VALUE" ]; then
    echo "  ❌ $NAME: NOT SET"
    MISSING_TEMPLATES+=("$NAME")
  else
    echo "  ✅ $NAME: Configured"
  fi
done

echo ""
echo "🔗 STEP 2: TESTING API ENDPOINTS"
echo "─────────────────────────────────────────────────────────────────"

# Get API URL
API_URL="${API_BASE_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:3001}}"
TEST_EMAIL="${TEST_EMAIL:-emilmancero@gmail.com}"

echo "API URL: $API_URL"
echo "Test Email: $TEST_EMAIL"
echo ""

# Check if server is running
if curl -s -f "$API_URL/health" > /dev/null 2>&1; then
  echo "✅ Server is running at $API_URL"
  echo ""
  
  # Test verification email endpoint
  echo "📤 Testing Verification Email Endpoint..."
  RESPONSE=$(curl -s -X POST "$API_URL/test-emails/verification" \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"$TEST_EMAIL\", \"token\": \"TEST123456\", \"name\": \"Test User\"}")
  
  if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "  ✅ Verification email sent successfully"
  else
    echo "  ❌ Verification email failed"
    echo "  Response: $RESPONSE"
  fi
  
  echo ""
  
  # Test password reset endpoint
  echo "📤 Testing Password Reset Email Endpoint..."
  RESPONSE=$(curl -s -X POST "$API_URL/test-emails/password-reset" \
    -H "Content-Type: application/json" \
    -d "{\"to\": \"$TEST_EMAIL\", \"code\": \"RESET789\"}")
  
  if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "  ✅ Password reset email sent successfully"
  else
    echo "  ❌ Password reset email failed"
    echo "  Response: $RESPONSE"
  fi
  
else
  echo "❌ Server is not running at $API_URL"
  echo "   Start server with: cd server && npm run dev"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      📊 TEST SUMMARY                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ -z "$SENDGRID_API_KEY" ]; then
  echo "⚠️  WARNING: SENDGRID_API_KEY not configured"
  echo "   Emails will not be sent. Configure in server/.env"
  echo ""
fi

if [ ${#MISSING_TEMPLATES[@]} -gt 0 ]; then
  echo "⚠️  WARNING: Missing template IDs:"
  for TEMPLATE in "${MISSING_TEMPLATES[@]}"; do
    echo "   - $TEMPLATE"
  done
  echo ""
  echo "   Configure template IDs in server/.env"
  echo ""
fi

echo "📧 Check your email inbox ($TEST_EMAIL) for test emails"
echo "📋 Check SendGrid dashboard: https://app.sendgrid.com"
echo ""
echo "✅ Email test complete!"
