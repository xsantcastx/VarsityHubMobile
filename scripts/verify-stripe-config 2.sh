#!/bin/bash

# Stripe Configuration Verification Script
# Compares Stripe configuration in code/environment against provided values

set -euo pipefail

cd /Users/varsityhub/VarsityHubMobile

echo "========================================"
echo "Stripe Configuration Verification"
echo "========================================"
echo ""

# Expected values from the image
EXPECTED_VETERAN="price_1SVco4GJt8CsPE1EBNN1HYPB"
EXPECTED_LEGEND="price_1SK081GJt8CsPE1E7RmXJblX"
EXPECTED_AD_WEEKDAY="price_1SNFWzGJt8CsPE1EIikRsZif"
EXPECTED_AD_WEEKEND="price_1SdlmiGJt8CsPE1EKPHETCVY"

echo "📋 Expected Price IDs (from Stripe Dashboard):"
echo "  VETERAN:    $EXPECTED_VETERAN"
echo "  LEGEND:     $EXPECTED_LEGEND"
echo "  AD_WEEKDAY: $EXPECTED_AD_WEEKDAY"
echo "  AD_WEEKEND: $EXPECTED_AD_WEEKEND"
echo ""

# Check environment files
ENV_FILES=(
  "server/.env"
  ".env"
  "server/.env.example"
)

FOUND_VARS=()
for env_file in "${ENV_FILES[@]}"; do
  if [ -f "$env_file" ]; then
    echo "📁 Checking: $env_file"
    
    # Extract Stripe vars
    if grep -q "STRIPE_PRICE_VETERAN" "$env_file"; then
      ACTUAL_VETERAN=$(grep "^STRIPE_PRICE_VETERAN=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
      if [ -n "$ACTUAL_VETERAN" ]; then
        FOUND_VARS+=("VETERAN:$ACTUAL_VETERAN")
        if [ "$ACTUAL_VETERAN" == "$EXPECTED_VETERAN" ]; then
          echo "  ✅ STRIPE_PRICE_VETERAN matches: $ACTUAL_VETERAN"
        else
          echo "  ⚠️  STRIPE_PRICE_VETERAN mismatch:"
          echo "     Expected: $EXPECTED_VETERAN"
          echo "     Found:    $ACTUAL_VETERAN"
        fi
      fi
    fi
    
    if grep -q "STRIPE_PRICE_LEGEND" "$env_file"; then
      ACTUAL_LEGEND=$(grep "^STRIPE_PRICE_LEGEND=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
      if [ -n "$ACTUAL_LEGEND" ]; then
        FOUND_VARS+=("LEGEND:$ACTUAL_LEGEND")
        if [ "$ACTUAL_LEGEND" == "$EXPECTED_LEGEND" ]; then
          echo "  ✅ STRIPE_PRICE_LEGEND matches: $ACTUAL_LEGEND"
        else
          echo "  ⚠️  STRIPE_PRICE_LEGEND mismatch:"
          echo "     Expected: $EXPECTED_LEGEND"
          echo "     Found:    $ACTUAL_LEGEND"
        fi
      fi
    fi
    
    if grep -q "STRIPE_PRICE_AD_WEEKDAY" "$env_file"; then
      ACTUAL_AD_WEEKDAY=$(grep "^STRIPE_PRICE_AD_WEEKDAY=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
      if [ -n "$ACTUAL_AD_WEEKDAY" ]; then
        FOUND_VARS+=("AD_WEEKDAY:$ACTUAL_AD_WEEKDAY")
        if [ "$ACTUAL_AD_WEEKDAY" == "$EXPECTED_AD_WEEKDAY" ]; then
          echo "  ✅ STRIPE_PRICE_AD_WEEKDAY matches: $ACTUAL_AD_WEEKDAY"
        else
          echo "  ⚠️  STRIPE_PRICE_AD_WEEKDAY mismatch:"
          echo "     Expected: $EXPECTED_AD_WEEKDAY"
          echo "     Found:    $ACTUAL_AD_WEEKDAY"
        fi
      fi
    else
      echo "  ⚠️  STRIPE_PRICE_AD_WEEKDAY not found in $env_file"
    fi
    
    if grep -q "STRIPE_PRICE_AD_WEEKEND" "$env_file"; then
      ACTUAL_AD_WEEKEND=$(grep "^STRIPE_PRICE_AD_WEEKEND=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
      if [ -n "$ACTUAL_AD_WEEKEND" ]; then
        FOUND_VARS+=("AD_WEEKEND:$ACTUAL_AD_WEEKEND")
        if [ "$ACTUAL_AD_WEEKEND" == "$EXPECTED_AD_WEEKEND" ]; then
          echo "  ✅ STRIPE_PRICE_AD_WEEKEND matches: $ACTUAL_AD_WEEKEND"
        else
          echo "  ⚠️  STRIPE_PRICE_AD_WEEKEND mismatch:"
          echo "     Expected: $EXPECTED_AD_WEEKEND"
          echo "     Found:    $ACTUAL_AD_WEEKEND"
        fi
      fi
    else
      echo "  ⚠️  STRIPE_PRICE_AD_WEEKEND not found in $env_file"
    fi
    
    # Check secret keys
    if grep -q "STRIPE_SECRET_KEY" "$env_file"; then
      SECRET_KEY=$(grep "^STRIPE_SECRET_KEY=" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" || echo "")
      if [ -n "$SECRET_KEY" ]; then
        if [[ "$SECRET_KEY" == sk_live_* ]]; then
          echo "  ✅ STRIPE_SECRET_KEY: LIVE key detected (sk_live_...)"
        elif [[ "$SECRET_KEY" == sk_test_* ]]; then
          echo "  ⚠️  STRIPE_SECRET_KEY: TEST key detected (sk_test_...)"
        else
          echo "  ⚠️  STRIPE_SECRET_KEY: Format unclear"
        fi
      fi
    fi
    
    if grep -q "STRIPE_PUBLISHABLE_KEY" "$env_file"; then
      PUBLISHABLE_KEY=$(grep "^STRIPE_PUBLISHABLE_KEY\|^EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$env_file" | cut -d'=' -f2 | tr -d '"' | tr -d "'" | head -1 || echo "")
      if [ -n "$PUBLISHABLE_KEY" ]; then
        if [[ "$PUBLISHABLE_KEY" == pk_live_* ]]; then
          echo "  ✅ STRIPE_PUBLISHABLE_KEY: LIVE key detected (pk_live_...)"
        elif [[ "$PUBLISHABLE_KEY" == pk_test_* ]]; then
          echo "  ⚠️  STRIPE_PUBLISHABLE_KEY: TEST key detected (pk_test_...)"
        else
          echo "  ⚠️  STRIPE_PUBLISHABLE_KEY: Format unclear"
        fi
      fi
    fi
    
    echo ""
  fi
done

echo "========================================"
echo "Code Implementation Check"
echo "========================================"
echo ""

# Check how prices are used in code
echo "📝 Checking code implementation..."

# Check payments.ts
if [ -f "server/src/routes/payments.ts" ]; then
  echo ""
  echo "File: server/src/routes/payments.ts"
  
  # Check if STRIPE_PRICE_VETERAN is used
  if grep -q "STRIPE_PRICE_VETERAN" "server/src/routes/payments.ts"; then
    echo "  ✅ Uses STRIPE_PRICE_VETERAN env var"
  else
    echo "  ❌ Does NOT use STRIPE_PRICE_VETERAN env var"
  fi
  
  # Check if STRIPE_PRICE_LEGEND is used
  if grep -q "STRIPE_PRICE_LEGEND" "server/src/routes/payments.ts"; then
    echo "  ✅ Uses STRIPE_PRICE_LEGEND env var"
  else
    echo "  ❌ Does NOT use STRIPE_PRICE_LEGEND env var"
  fi
  
  # Check if ad price IDs are used
  if grep -q "STRIPE_PRICE_AD_WEEKDAY\|STRIPE_PRICE_AD_WEEKEND" "server/src/routes/payments.ts"; then
    echo "  ✅ Uses STRIPE_PRICE_AD_WEEKDAY/AD_WEEKEND env vars"
  else
    echo "  ⚠️  Does NOT use STRIPE_PRICE_AD_WEEKDAY/AD_WEEKEND env vars"
    echo "     (Currently uses calculatePriceCents() with hardcoded values)"
  fi
  
  # Check ad pricing values
  if grep -q "weekdayPrice = 800\|WEEKDAY.*800" "server/src/routes/payments.ts" || grep -q "WEEKDAY_BLOCK_PRICE_CENTS = 500" "server/src/utils/adPricing.ts" 2>/dev/null; then
    echo "  ℹ️  Ad pricing: Uses dynamic calculation (not Price IDs)"
  fi
fi

# Check billing.ts for inconsistencies
if [ -f "server/src/routes/billing.ts" ]; then
  echo ""
  echo "File: server/src/routes/billing.ts"
  
  # Check for different env var names
  if grep -q "STRIPE_VETERAN_PRICE_ID\|STRIPE_LEGEND_PRICE_ID" "server/src/routes/billing.ts"; then
    echo "  ⚠️  WARNING: Uses different env var names:"
    grep -n "STRIPE.*PRICE" "server/src/routes/billing.ts" | head -5 | sed 's/^/     /'
    echo "     Should use: STRIPE_PRICE_VETERAN and STRIPE_PRICE_LEGEND"
  fi
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo ""
echo "✅ To verify everything matches your Stripe dashboard:"
echo "   1. Check that environment variables match expected values above"
echo "   2. Verify STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are LIVE keys"
echo "   3. Note: Ad pricing currently uses dynamic calculation, not Price IDs"
echo ""
echo "📝 Recommendations:"
echo "   • Ensure server/.env has correct Price IDs"
echo "   • If using billing.ts, update env var names to match payments.ts"
echo "   • Consider updating ad pricing to use Price IDs for centralized management"
echo ""
