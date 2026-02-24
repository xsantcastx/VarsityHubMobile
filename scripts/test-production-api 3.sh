#!/bin/bash
# VarsityHub Production API Test Script
# Run: chmod +x scripts/test-production-api.sh && ./scripts/test-production-api.sh

API_URL="https://api-production-8ac3.up.railway.app"

echo "=========================================="
echo "VarsityHub Production API Health Check"
echo "$(date)"
echo "=========================================="
echo ""

# 1. Health check
echo "1. Checking /health endpoint..."
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH" | jq '.' 2>/dev/null || echo "$HEALTH"
echo ""

# 2. Integrations status
echo "2. Integration status:"
echo "$HEALTH" | jq '.integrations' 2>/dev/null
echo ""

# 3. Stripe config status  
echo "3. Checking Stripe configuration (/payments/config-status)..."
STRIPE_STATUS=$(curl -s "$API_URL/payments/config-status" 2>/dev/null)
if echo "$STRIPE_STATUS" | grep -q "stripe_configured"; then
  echo "$STRIPE_STATUS" | jq '.'
elif echo "$STRIPE_STATUS" | grep -q "Cannot GET"; then
  echo "⚠️  Endpoint not found - server may need redeployment"
else
  echo "Response: $STRIPE_STATUS"
fi
echo ""

# 4. Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "❌ Missing (need to add in Railway):"
echo "$HEALTH" | jq -r '.integrations | to_entries[] | select(.value == false) | "   - \(.key)"' 2>/dev/null
echo ""
echo "✅ Configured:"
echo "$HEALTH" | jq -r '.integrations | to_entries[] | select(.value == true) | "   - \(.key)"' 2>/dev/null
echo ""

# 5. Next steps
echo "=========================================="
echo "Next Steps"
echo "=========================================="
echo ""
echo "If Stripe shows false:"
echo "  1. Add STRIPE_SECRET_KEY in Railway Dashboard"
echo "  2. Add STRIPE_WEBHOOK_SECRET"
echo "  3. Add STRIPE_PRICE_VETERAN and STRIPE_PRICE_LEGEND"
echo "  4. Redeploy the service"
echo "  5. Run this script again"
echo ""
echo "To test ad checkout after Stripe is configured:"
echo "  curl -X POST $API_URL/payments/ads/checkout \\"
echo "    -H 'Authorization: Bearer YOUR_JWT_TOKEN' \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"ad_id\": \"xxx\", \"dates\": [\"2025-12-01\"]}'"
echo ""
