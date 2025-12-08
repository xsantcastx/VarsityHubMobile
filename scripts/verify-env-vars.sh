#!/bin/bash

# Environment Variables Verification Script
# Validates all required production env vars are set

echo "🔍 VarsityHub Production Environment Verification"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

MISSING=0
PLACEHOLDER=0

check_var() {
  local var_name=$1
  local var_value="${!var_name}"
  local is_required=$2
  local placeholder_pattern=$3
  
  if [ -z "$var_value" ]; then
    if [ "$is_required" = "required" ]; then
      echo -e "${RED}❌ $var_name${NC} - MISSING (required)"
      MISSING=$((MISSING + 1))
    else
      echo -e "${YELLOW}⚠️  $var_name${NC} - Not set (optional)"
    fi
  elif [[ "$var_value" =~ $placeholder_pattern ]]; then
    echo -e "${YELLOW}⚠️  $var_name${NC} - Contains placeholder value"
    PLACEHOLDER=$((PLACEHOLDER + 1))
  else
    echo -e "${GREEN}✅ $var_name${NC} - Set"
  fi
}

# Load env file helper (preserves exports)
load_env_file() {
  local file_path="$1"
  if [ -f "$file_path" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$file_path"
    set +a
  fi
}

# Load mobile and server env files if present
load_env_file ".env"
load_env_file "server/.env"

echo "📱 Mobile App Environment Variables"
echo "-----------------------------------"
check_var "EXPO_PUBLIC_SENTRY_DSN" "required" "your-key-here|example"
check_var "EXPO_PUBLIC_API_URL" "required" "localhost|example"
check_var "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID" "required" "your-|example"
check_var "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID" "required" "your-|example"
check_var "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID" "required" "your-|example"
check_var "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" "required" "pk_test|your-"
check_var "EXPO_PUBLIC_ADMIN_EMAILS" "required" ""

echo ""
echo "🖥️  Server Environment Variables (Railway)"
echo "----------------------------------------"
check_var "DATABASE_URL" "required" "postgres|mysql|mongodb"
check_var "JWT_SECRET" "required" "changeme|example"
check_var "SENDGRID_API_KEY" "required" "SG\\.|example"
check_var "SENDGRID_VERIFICATION_TEMPLATE_ID" "required" "d-"
check_var "SENDGRID_PASSWORD_RESET_TEMPLATE_ID" "required" "d-"
check_var "SENDGRID_TEAM_INVITE_TEMPLATE_ID" "required" "d-"
check_var "SENDGRID_ORG_INVITE_TEMPLATE_ID" "optional" "d-"
check_var "SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID" "optional" "d-"
check_var "SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID" "optional" "d-"
check_var "SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID" "optional" "d-"
check_var "CLOUDINARY_CLOUD_NAME" "required" ""
check_var "CLOUDINARY_API_KEY" "required" "1234"
check_var "CLOUDINARY_API_SECRET" "required" ""
check_var "STRIPE_SECRET_KEY" "required" "sk_test|example"
check_var "STRIPE_WEBHOOK_SECRET" "required" ""
check_var "TWILIO_ACCOUNT_SID" "required" "AC"
check_var "TWILIO_AUTH_TOKEN" "required" ""
check_var "TWILIO_PHONE_NUMBER" "optional" "\\+1"
check_var "TWILIO_VERIFY_SERVICE_SID" "required" "VA"
check_var "ALLOWED_ORIGINS" "required" "\\*"
check_var "APPLE_BUNDLE_ID" "optional" ""
check_var "APPLE_TEAM_ID" "optional" ""
check_var "APPLE_KEY_ID" "optional" ""
check_var "SENTRY_DSN" "optional" "https://"
check_var "STRIPE_PRICE_VETERAN" "optional" ""
check_var "STRIPE_PRICE_LEGEND" "optional" ""
check_var "CUSTOMER_SERVICE_EMAIL" "optional" "@"
check_var "FROM_EMAIL" "optional" "@"

echo "=================================================="
echo "Summary:"
if [ $MISSING -gt 0 ]; then
  echo -e "${RED}❌ $MISSING required variables missing${NC}"
  exit 1
elif [ $PLACEHOLDER -gt 0 ]; then
  echo -e "${YELLOW}⚠️  $PLACEHOLDER variables have placeholder values${NC}"
  echo "   Review and update before production deployment"
  exit 0
else
  echo -e "${GREEN}✅ All mobile environment variables configured${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Verify server vars in Railway dashboard"
  echo "2. Run: eas build --platform ios --profile production"
  echo "3. Submit to TestFlight: eas submit --platform ios --latest"
  exit 0
fi
