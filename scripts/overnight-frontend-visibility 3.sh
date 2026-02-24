#!/bin/bash

# Overnight Front-End Visibility Test Runner
# Runs Playwright tests to check UI visibility, component rendering, and visual regressions
#
# Usage:
#   ./scripts/overnight-frontend-visibility.sh
#   APP_URL=http://localhost:8081 ./scripts/overnight-frontend-visibility.sh

set -euo pipefail

cd /Users/varsityhub/VarsityHubMobile

APP_URL="${APP_URL:-http://localhost:8081}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="overnight-results"
LOG_FILE="${LOG_DIR}/frontend-visibility-${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"
mkdir -p "${LOG_DIR}/visibility-screenshots"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"
}

log "========================================"
log "Front-End Visibility Overnight Tests"
log "Target URL: ${APP_URL}"
log "Timestamp: ${TIMESTAMP}"
log "========================================"
log ""

# Check if app is running
log "Checking if app is accessible..."
if ! curl -sSf "${APP_URL}" > /dev/null 2>&1; then
  log "⚠️  App is not accessible at ${APP_URL}"
  log "Starting Expo dev server..."
  
  # Kill any existing Metro/Expo processes
  lsof -ti:8081,19000,19001 | xargs kill -9 2>/dev/null || true
  pkill -9 -f "expo|metro|node.*8081" 2>/dev/null || true
  sleep 2

  # Start Expo in background
  log "Starting Expo server..."
  npx expo start --web --non-interactive > "${LOG_DIR}/expo-server-${TIMESTAMP}.log" 2>&1 &
  EXPO_PID=$!
  
  # Wait for server to be ready
  log "Waiting for server to start..."
  for i in {1..60}; do
    if curl -sSf "${APP_URL}" > /dev/null 2>&1; then
      log "✓ Server is ready"
      break
    fi
    if [ $i -eq 60 ]; then
      log "✗ Server failed to start after 60 seconds"
      kill $EXPO_PID 2>/dev/null || true
      exit 1
    fi
    sleep 2
  done
fi

log "Running Playwright front-end visibility tests..."
log ""

# Run Playwright tests
export APP_URL="${APP_URL}"
export PLAYWRIGHT_SKIP_SERVER=1  # Use existing server

if npx playwright test tests/frontend-visibility.spec.ts \
  --reporter=list,json:"${LOG_DIR}/frontend-visibility-results-${TIMESTAMP}.json" \
  --output-dir="${LOG_DIR}/playwright-artifacts-${TIMESTAMP}" \
  2>&1 | tee -a "${LOG_FILE}"; then
  
  log ""
  log "✓ All front-end visibility tests passed!"
  
  # Parse results if JSON exists
  if [ -f "${LOG_DIR}/frontend-visibility-results-${TIMESTAMP}.json" ]; then
    log ""
    log "Test Results Summary:"
    # Extract summary using jq if available, otherwise basic grep
    if command -v jq &> /dev/null; then
      PASSED=$(jq '.stats.expected' "${LOG_DIR}/frontend-visibility-results-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
      FAILED=$(jq '.stats.unexpected' "${LOG_DIR}/frontend-visibility-results-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
      log "  Expected (Passed): ${PASSED}"
      log "  Unexpected (Failed): ${FAILED}"
    fi
  fi
else
  log ""
  log "✗ Some front-end visibility tests failed"
  log "Check ${LOG_FILE} for details"
  log "Screenshots available in: ${LOG_DIR}/visibility-screenshots/"
  
  # Don't exit with error - this is an overnight check, we want to continue
  exit_code=1
fi

# Check for visibility summary JSON
if [ -f "${LOG_DIR}/visibility-summary-"*.json ]; then
  LATEST_SUMMARY=$(ls -t "${LOG_DIR}/visibility-summary-"*.json 2>/dev/null | head -1)
  if [ -n "${LATEST_SUMMARY}" ]; then
    log ""
    log "Visibility Summary:"
    if command -v jq &> /dev/null; then
      jq -r '. | "  Total Tests: \(.totalTests)\n  Passed: \(.passed)\n  Failed: \(.failed)\n  Pass Rate: \(.passRate)"' "${LATEST_SUMMARY}" | tee -a "${LOG_FILE}"
    else
      cat "${LATEST_SUMMARY}" | tee -a "${LOG_FILE}"
    fi
  fi
fi

log ""
log "========================================"
log "Front-End Visibility Tests Complete"
log "Log file: ${LOG_FILE}"
log "Screenshots: ${LOG_DIR}/visibility-screenshots/"
log "========================================"

# Clean up Expo server if we started it
if [ -n "${EXPO_PID:-}" ]; then
  log "Stopping Expo server (PID: ${EXPO_PID})..."
  kill "${EXPO_PID}" 2>/dev/null || true
fi

exit ${exit_code:-0}
