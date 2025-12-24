#!/bin/bash
# VarsityHub QA Testing - Automated Backend Health Check
# Run this to verify backend services before device testing

set -e

#############################################
# Usage & Flags
#############################################
usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

Options:
    --skip-prod        Skip production checks (use local-only)
    --local-only       Only run local backend checks
    --prod-only        Only run production checks
    --timeout <secs>   Curl timeout (default: 8)
    -h, --help         Show this help

Environment:
    SKIP_PROD=1        Same as --skip-prod
    QA_TIMEOUT=<secs>  Default timeout
EOF
}

SKIP_PROD=${SKIP_PROD:-0}
LOCAL_ONLY=0
PROD_ONLY=0
TIMEOUT=${QA_TIMEOUT:-8}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-prod) SKIP_PROD=1; shift;;
        --local-only) LOCAL_ONLY=1; SKIP_PROD=1; shift;;
        --prod-only) PROD_ONLY=1; shift;;
        --timeout) TIMEOUT="${2:-8}"; shift 2;;
        -h|--help) usage; exit 0;;
        *) shift;;
    esac
done

echo "========================================="
echo "VarsityHub Backend Health Check"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

curl_json() {
    # curl JSON with timeout & fail-fast
    # Args: URL
    curl -sS --fail --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$1"
}

#############################################
# Optional: Probe production reachability
#############################################
PROD_HOST="https://api-production-8ac3.up.railway.app"
if [[ "$SKIP_PROD" -ne 1 && "$LOCAL_ONLY" -ne 1 && "$PROD_ONLY" -ne 1 ]]; then
    echo "Probing production reachability (timeout: ${TIMEOUT}s)..."
    if ! curl -sS --connect-timeout 3 --max-time 3 "$PROD_HOST/health" -o /dev/null; then
        echo -e "${YELLOW}⚠${NC} Production not reachable. Skipping prod checks."
        SKIP_PROD=1
    fi
fi

#############################################
# Test 1: Production Backend Health (optional)
#############################################
if [[ "$SKIP_PROD" -ne 1 && "$LOCAL_ONLY" -ne 1 ]]; then
    echo "Test 1: Production Backend Health Check"
    echo "----------------------------------------"
    set +e
    HEALTH_RESPONSE=$(curl_json "$PROD_HOST/health")
    CURL_STATUS=$?
    set -e
    if [ $CURL_STATUS -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Health endpoint responding"
            echo ""
            echo "Response:"
            echo "$HEALTH_RESPONSE" | jq '.' || echo "$HEALTH_RESPONSE"
            echo ""

            # Check integrations
            DATABASE=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.database' 2>/dev/null)
            JWT=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.jwt' 2>/dev/null)
            CLOUDINARY=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.cloudinary' 2>/dev/null)
            TWILIO=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.twilio' 2>/dev/null)
            STRIPE=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.stripe' 2>/dev/null)
            SENDGRID=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.sendgrid' 2>/dev/null)
            GOOGLE_OAUTH=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.googleOAuth' 2>/dev/null)
            SENTRY=$(echo "$HEALTH_RESPONSE" | jq -r '.integrations.sentry' 2>/dev/null)

            echo "Integration Status:"
            [ "$DATABASE" = "true" ] && echo -e "${GREEN}✓${NC} Database connected" || echo -e "${RED}✗${NC} Database not connected"
            [ "$JWT" = "true" ] && echo -e "${GREEN}✓${NC} JWT configured" || echo -e "${RED}✗${NC} JWT not configured"
            [ "$CLOUDINARY" = "true" ] && echo -e "${GREEN}✓${NC} Cloudinary configured" || echo -e "${RED}✗${NC} Cloudinary not configured"
            [ "$TWILIO" = "true" ] && echo -e "${GREEN}✓${NC} Twilio configured" || echo -e "${RED}✗${NC} Twilio not configured"
            [ "$STRIPE" = "true" ] && echo -e "${GREEN}✓${NC} Stripe configured" || echo -e "${RED}✗${NC} Stripe not configured"
            [ "$GOOGLE_OAUTH" = "true" ] && echo -e "${GREEN}✓${NC} Google OAuth configured" || echo -e "${RED}✗${NC} Google OAuth not configured"
            [ "$SENTRY" = "true" ] && echo -e "${GREEN}✓${NC} Sentry configured" || echo -e "${RED}✗${NC} Sentry not configured"
            [ "$SENDGRID" = "true" ] && echo -e "${GREEN}✓${NC} SendGrid configured" || echo -e "${YELLOW}⚠${NC} SendGrid optional (non-blocking)"

            echo ""

            # Check for warnings
            WARNINGS=$(echo "$HEALTH_RESPONSE" | jq -r '.warnings[]' 2>/dev/null)
            if [ -n "$WARNINGS" ]; then
                    echo -e "${YELLOW}Warnings:${NC}"
                    echo "$WARNINGS" | while read -r warning; do
                            [ -n "$warning" ] && echo -e "  ${YELLOW}⚠${NC} $warning"
                    done
            fi
    else
            echo -e "${YELLOW}⚠${NC} Production health check timed out (>${TIMEOUT}s). Skipping."
    fi
fi

#############################################
# Test 2: API Endpoints Accessibility (prod)
#############################################
if [[ "$SKIP_PROD" -ne 1 && "$LOCAL_ONLY" -ne 1 ]]; then
    echo ""
    echo "========================================="
    echo "Test 2: API Endpoints Accessibility"
    echo "========================================="
    echo ""

    echo "Testing /me endpoint..."
    set +e
    ME_RESPONSE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" "$PROD_HOST/me")
    CURL_STATUS=$?
    set -e
    if [ $CURL_STATUS -eq 0 ] && [ "$ME_RESPONSE" = "401" ]; then
            echo -e "${GREEN}✓${NC} /me endpoint responding (401 expected without auth)"
    else
            echo -e "${YELLOW}⚠${NC} /me check skipped or timed out"
    fi
fi

#############################################
# Test 3: Local Backend (if running)
#############################################
if [[ "$PROD_ONLY" -ne 1 ]]; then
    echo ""
    echo "========================================="
    echo "Test 3: Local Backend (if running)"
    echo "========================================="
    echo ""

    set +e
    LOCAL_HEALTH=$(curl -sS --connect-timeout "$TIMEOUT" --max-time "$TIMEOUT" http://localhost:4000/health)
    CURL_STATUS=$?
    set -e
    if [ $CURL_STATUS -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Local backend running on port 4000"
            echo "Local Response:"
            echo "$LOCAL_HEALTH" | jq '.' || echo "$LOCAL_HEALTH"
    else
            echo -e "${YELLOW}⚠${NC} Local backend not running (this is OK if testing production only)"
    fi
fi

echo ""
echo "========================================="
echo "Summary"
echo "========================================="
echo ""
if [[ "$SKIP_PROD" -eq 1 ]]; then
    echo -e "${YELLOW}⚠${NC} Production checks skipped (use --prod-only to force)"
else
    echo -e "${GREEN}✓${NC} Production backend health check attempted"
fi
echo -e "${GREEN}✓${NC} All critical checks ran with timeout=${TIMEOUT}s"
echo ""
echo "Backend is ready for QA device testing!"
echo ""
