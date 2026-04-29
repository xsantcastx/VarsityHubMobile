#!/usr/bin/env bash
# =============================================================================
# Railway Environment Verification Script
# =============================================================================
# Run this to verify your Railway deployment has the correct env vars.
# The /health endpoint returns full integration status (no auth needed).
#
# Usage:
#   ./scripts/verify-railway-env.sh
# =============================================================================

set -e
API_URL="${API_URL:-https://api-production-8ac3.up.railway.app}"

echo "=== Railway Environment Verification ==="
echo "API URL: $API_URL"
echo ""

# Health check (returns full integration status)
echo "1. Health check..."
HEALTH=$(curl -s "${API_URL}/health")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "   ✅ Server is responding"
else
  echo "   ❌ Server not responding or unhealthy"
  echo "   Response: $HEALTH"
  exit 1
fi

# Display integration status
if echo "$HEALTH" | grep -q '"integrations"'; then
  echo ""
  echo "2. Integrations:"
  echo "$HEALTH" | jq -r '
    .integrations | to_entries[] |
    "   \(if .value then "✅" else "❌" end) \(.key): \(.value)"
  ' 2>/dev/null || echo "$HEALTH"
  echo ""
  echo "   Warnings:"
  echo "$HEALTH" | jq -r '.warnings[]? // empty' 2>/dev/null | sed 's/^/   - /' || echo "   (none)"
  echo ""
  echo "   Missing email templates:"
  echo "$HEALTH" | jq -r '.metadata.missingEmailTemplates[]? // empty' 2>/dev/null | sed 's/^/   - /' || echo "   (none)"
else
  echo "   ⚠️  Unexpected response format"
  echo "   Response: $(echo "$HEALTH" | head -c 300)"
fi

echo ""
echo "=== Railway Checklist (verify in dashboard) ==="
echo ""
echo "REQUIRED:"
echo "  [ ] DATABASE_URL          (Railway provides automatically)"
echo "  [ ] JWT_SECRET            (≥32 chars)"
echo "  [ ] ADMIN_EMAILS          (include support@varsityhub.app)"
echo "  [ ] STRIPE_SECRET_KEY     (sk_live_... or sk_test_...)"
echo "  [ ] STRIPE_WEBHOOK_SECRET (whsec_...)"
echo "  [ ] CLOUDINARY_CLOUD_NAME"
echo "  [ ] CLOUDINARY_API_KEY"
echo "  [ ] CLOUDINARY_API_SECRET"
echo "  [ ] SENDGRID_API_KEY"
echo "  [ ] GOOGLE_OAUTH_CLIENT_IDS"
echo "  [ ] GOOGLE_MAPS_API_KEY"
echo ""
echo "AD APPROVAL (SendGrid templates):"
echo "  [ ] SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID"
echo "  [ ] SENDGRID_AD_APPROVED_TEMPLATE_ID"
echo "  [ ] SENDGRID_AD_REJECTED_TEMPLATE_ID"
echo ""
echo "IAP (iOS):"
echo "  [ ] APPLE_IAP_SHARED_SECRET"
echo "  [ ] APPLE_BUNDLE_ID        (com.varsithub.varsityhub-ios)"
echo "  [ ] APPLE_CLIENT_ID        (com.varsithub.varsityhub-ios)"
echo ""
echo "RECOMMENDED:"
echo "  [ ] ALLOWED_ORIGINS        (https://varsityhub.app,...)"
echo "  [ ] APP_BASE_URL           (https://api-production-8ac3.up.railway.app)"
echo "  [ ] API_BASE_URL           (same as APP_BASE_URL for league approval emails)"
echo "  [ ] SENTRY_DSN"
echo ""
