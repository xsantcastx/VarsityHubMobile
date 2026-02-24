#!/bin/bash

###############################################################################
# Test Runner Script
# 
# Runs all tests with proper setup and reporting
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:4000}"
APP_URL="${APP_URL:-http://localhost:8081}"

echo "🧪 VarsityHub Test Runner"
echo "=========================="
echo ""

# Check if backend is running
echo "📡 Checking backend health..."
if curl -s "${API_URL}/health" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Backend is running${NC}"
else
  echo -e "${YELLOW}⚠️  Backend not running at ${API_URL}${NC}"
  echo "   Start backend with: cd server && npm run dev"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check if frontend is running (for E2E tests)
echo "🌐 Checking frontend..."
if curl -s "${APP_URL}" > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Frontend is running${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend not running at ${APP_URL}${NC}"
  echo "   Start frontend with: npm run web:playwright"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo ""
echo "Select test suite to run:"
echo "1) Smoke tests (fast - 2-5 min)"
echo "2) API tests (medium - 5-10 min)"
echo "3) E2E tests (slow - 10-30 min)"
echo "4) All tests (comprehensive - 20-45 min)"
echo "5) Backend unit tests"
echo ""
read -p "Enter choice [1-5]: " choice

case $choice in
  1)
    echo ""
    echo "🚀 Running smoke tests..."
    npm run test:smoke
    ;;
  2)
    echo ""
    echo "🚀 Running API tests..."
    npm run test:api
    ;;
  3)
    echo ""
    echo "🚀 Running E2E tests..."
    npm run test:e2e
    ;;
  4)
    echo ""
    echo "🚀 Running all tests..."
    echo ""
    echo "Step 1/3: Backend unit tests..."
    npm run test:server
    echo ""
    echo "Step 2/3: API integration tests..."
    npm run test:api
    echo ""
    echo "Step 3/3: E2E tests..."
    npm run test:e2e
    ;;
  5)
    echo ""
    echo "🚀 Running backend unit tests..."
    npm run test:server
    ;;
  *)
    echo -e "${RED}Invalid choice${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ Tests completed!${NC}"
echo ""
echo "View HTML report: npx playwright show-report"
