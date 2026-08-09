#!/bin/bash

# Day 0-1 Verification Script
# Purpose: Verify all monitoring, observability, and integration setup

set -e

echo "======================================"
echo "VarsityHub Mobile - Day 0-1 Verification"
echo "======================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify .env variables
echo "Step 1: Environment Variables"
echo "------------------------------"

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.example"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌${NC} No .env or .env.example file found"
  exit 1
fi

echo "Using $ENV_FILE"

if grep -q "EXPO_PUBLIC_SENTRY_DSN=https://" "$ENV_FILE"; then
  echo -e "${GREEN}✅${NC} EXPO_PUBLIC_SENTRY_DSN configured"
else
  echo -e "${RED}❌${NC} EXPO_PUBLIC_SENTRY_DSN missing"
  exit 1
fi

if grep -q "EXPO_PUBLIC_API_URL=https://api-production" "$ENV_FILE"; then
  echo -e "${GREEN}✅${NC} EXPO_PUBLIC_API_URL set to production"
else
  echo -e "${YELLOW}⚠️${NC} EXPO_PUBLIC_API_URL not production (may be development)"
fi

if grep -q "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live" "$ENV_FILE"; then
  echo -e "${GREEN}✅${NC} Stripe keys are LIVE (production)"
else
  echo -e "${YELLOW}⚠️${NC} Stripe keys may be test (development)"
fi

echo ""

# Step 2: Verify TypeScript
echo "Step 2: TypeScript Compilation"
echo "------------------------------"

if npm run typecheck 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌${NC} TypeScript has errors"
  npm run typecheck
  exit 1
else
  echo -e "${GREEN}✅${NC} TypeScript clean (0 errors)"
fi

echo ""

# Step 3: Lint Baseline
echo "Step 3: Lint Baseline Capture"
echo "------------------------------"

LINT_OUTPUT=$(npm run lint:strict 2>&1 | tail -5)
LINT_COUNT=$(echo "$LINT_OUTPUT" | grep -oE '[0-9]+ problems' | head -1 | grep -oE '[0-9]+' | head -1)

if [ -z "$LINT_COUNT" ]; then
  LINT_COUNT="unknown"
fi

echo -e "${GREEN}✅${NC} Lint baseline: $LINT_COUNT issues"
echo "   (Target for Day 2: <60 critical files)"
echo ""

# Step 4: Health Endpoint
echo "Step 4: Backend Health Endpoint"
echo "------------------------------"

API_URL="https://api-production-8ac3.up.railway.app"
HEALTH_SECRET="${HEALTH_CHECK_SECRET:-}"

echo "Checking $API_URL/health..."

if [ -n "$HEALTH_SECRET" ]; then
  HEALTH=$(curl -s -H "x-health-check-secret: $HEALTH_SECRET" "$API_URL/health" 2>/dev/null || echo "{}")
else
  HEALTH=$(curl -s "$API_URL/health" 2>/dev/null || echo "{}")
fi

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo -e "${GREEN}✅${NC} Health endpoint responsive"
  if echo "$HEALTH" | grep -q '"integrations":'; then
    if echo "$HEALTH" | grep -q '"database":true'; then
      echo -e "  ${GREEN}✅${NC} Database connected"
    else
      echo -e "  ${RED}❌${NC} Database not connected"
    fi

    if echo "$HEALTH" | grep -q '"sendgrid":true'; then
      echo -e "  ${GREEN}✅${NC} SendGrid configured"
    else
      echo -e "  ${YELLOW}⚠️${NC} SendGrid not configured (verify in Railway)"
    fi

    if echo "$HEALTH" | grep -q '"sentry":true'; then
      echo -e "  ${GREEN}✅${NC} Sentry configured"
    else
      echo -e "  ${YELLOW}⚠️${NC} Sentry not configured (check Railway secrets)"
    fi

    if echo "$HEALTH" | grep -q '"stripe":true'; then
      echo -e "  ${GREEN}✅${NC} Stripe configured"
    else
      echo -e "  ${YELLOW}⚠️${NC} Stripe not configured"
    fi
  else
    echo -e "  ${YELLOW}⚠️${NC} Detailed integration status unavailable without HEALTH_CHECK_SECRET"
  fi
else
  echo -e "${YELLOW}⚠️${NC} Could not reach health endpoint"
  echo "   (Check Railway service is running)"
fi

echo ""

# Step 5: GitHub Actions Status (if repo)
echo "Step 5: CI Pipeline Status"
echo "------------------------------"

if command -v gh &> /dev/null; then
  LATEST_RUN=$(gh run list --limit 1 --json status,conclusion,displayTitle 2>/dev/null || echo "")
  
  if [ -n "$LATEST_RUN" ]; then
    if echo "$LATEST_RUN" | grep -q '"conclusion":"success"'; then
      echo -e "${GREEN}✅${NC} Latest CI run passed"
    elif echo "$LATEST_RUN" | grep -q '"conclusion":"skipped"'; then
      echo -e "${YELLOW}⚠️${NC} Latest CI run skipped (expected for some branches)"
    else
      echo -e "${RED}❌${NC} Latest CI run failed (check GitHub Actions)"
    fi
  fi
else
  echo -e "${YELLOW}⚠️${NC} GitHub CLI not installed (install with: brew install gh)"
fi

echo ""
echo "======================================"
echo "Day 0-1 Verification Complete"
echo "======================================"
echo ""
echo "📋 Next Steps:"
echo "  1. Resolve any RED (❌) items above"
echo "  2. Run: npm run typecheck (should be clean)"
echo "  3. Run: npm run lint:strict (baseline captured)"
echo "  4. Run: npm run doctor (2-3 warnings OK)"
echo "  5. Push to main with commit message:"
echo "     'Day 0-1: Observability lock-in, baselines captured'"
echo ""
echo "✅ Once all checks pass, you're ready for Day 2 quality sweep!"
echo ""
