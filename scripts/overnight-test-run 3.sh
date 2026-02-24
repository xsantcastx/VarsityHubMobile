#!/bin/bash
# Overnight Test Suite Run
# Runs all test suites and generates coverage reports

echo "🧪 Starting overnight test run..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

# 1. TypeScript compilation check
echo ""
echo "================================================="
echo "Phase 1: TypeScript Compilation"
echo "================================================="
{
    echo "🔍 Running TypeScript check..."
    npm run typecheck 2>&1
} 2>&1 | tee "$LOG_DIR/1-typescript.log"

# 2. Frontend unit tests
echo ""
echo "================================================="
echo "Phase 2: Frontend Unit Tests"
echo "================================================="
{
    echo "🔍 Running frontend tests..."
    npm test -- --coverage --watchAll=false 2>&1 || echo "⚠️  Tests completed with failures"
} 2>&1 | tee "$LOG_DIR/2-frontend-tests.log"

# 3. Server unit tests
echo ""
echo "================================================="
echo "Phase 3: Server Unit Tests"
echo "================================================="
{
    if [ -d "server" ] && [ -f "server/package.json" ]; then
        cd server
        echo "🔍 Running server tests..."
        npm test 2>&1 || echo "⚠️  Server tests completed with failures"
        cd ..
    else
        echo "⚠️  Server directory not found, skipping server tests"
    fi
} 2>&1 | tee "$LOG_DIR/3-server-tests.log"

# 4. E2E smoke tests
echo ""
echo "================================================="
echo "Phase 4: E2E Smoke Tests"
echo "================================================="
{
    echo "🔍 Running E2E smoke tests..."
    npm run test:smoke 2>&1 || echo "⚠️  E2E tests completed with failures"
} 2>&1 | tee "$LOG_DIR/4-e2e-tests.log"

echo ""
echo "================================================="
echo "Test Run Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Completed: $(date)"
