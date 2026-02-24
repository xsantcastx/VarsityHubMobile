#!/bin/bash

# Overnight Real-World Functionality Test Runner
# Runs end-to-end tests of actual app functionality (auth, posts, teams, messaging, etc.)
#
# Usage:
#   ./scripts/overnight-functionality.sh
#   API_URL=http://localhost:4000 ./scripts/overnight-functionality.sh

set -euo pipefail

cd /Users/varsityhub/VarsityHubMobile

API_URL="${API_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:4000}}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="overnight-results"
LOG_FILE="${LOG_DIR}/functionality-${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"
}

log "========================================"
log "Real-World Functionality Overnight Tests"
log "Target API: ${API_URL}"
log "Timestamp: ${TIMESTAMP}"
log "========================================"
log ""

# Check if API is accessible
log "Checking if API is accessible..."
if ! curl -sSf "${API_URL}/health" > /dev/null 2>&1; then
  log "⚠️  API is not accessible at ${API_URL}"
  log "Please ensure the API server is running:"
  log "  cd server && npm run dev"
  log ""
  log "Or set API_URL environment variable:"
  log "  API_URL=https://api-production.example.com ./scripts/overnight-functionality.sh"
  exit 1
fi

log "✓ API is accessible"
log ""

# Check health endpoint details
log "API Health Check:"
HEALTH_RESPONSE=$(curl -sS "${API_URL}/health" || echo "{}")
log "  Response: ${HEALTH_RESPONSE}"
log ""

# Run Playwright tests
log "Running Playwright functionality tests..."
log ""

export API_URL="${API_URL}"
export PLAYWRIGHT_SKIP_SERVER=1  # Don't start web server, just test API

if npx playwright test tests/overnight-functionality.spec.ts \
  --reporter=list,json:"${LOG_DIR}/functionality-results-${TIMESTAMP}.json" \
  --output-dir="${LOG_DIR}/playwright-artifacts-${TIMESTAMP}" \
  2>&1 | tee -a "${LOG_FILE}"; then
  
  log ""
  log "✓ All functionality tests passed!"
  
  # Parse results if JSON exists
  if [ -f "${LOG_DIR}/functionality-results-${TIMESTAMP}.json" ]; then
    log ""
    log "Test Results Summary:"
    # Extract summary using jq if available
    if command -v jq &> /dev/null; then
      PASSED=$(jq '.stats.expected' "${LOG_DIR}/functionality-results-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
      FAILED=$(jq '.stats.unexpected' "${LOG_DIR}/functionality-results-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
      DURATION=$(jq '.stats.duration' "${LOG_DIR}/functionality-results-${TIMESTAMP}.json" 2>/dev/null || echo "N/A")
      log "  Expected (Passed): ${PASSED}"
      log "  Unexpected (Failed): ${FAILED}"
      log "  Duration: ${DURATION}ms"
    fi
  fi
  
  exit_code=0
else
  log ""
  log "✗ Some functionality tests failed"
  log "Check ${LOG_FILE} for details"
  
  exit_code=1
fi

# Check for functionality summary JSON
if [ -f "${LOG_DIR}/functionality-summary-"*.json ]; then
  LATEST_SUMMARY=$(ls -t "${LOG_DIR}/functionality-summary-"*.json 2>/dev/null | head -1)
  if [ -n "${LATEST_SUMMARY}" ]; then
    log ""
    log "Functionality Test Summary:"
    if command -v jq &> /dev/null; then
      jq -r '. | "  Total Tests: \(.totalTests)\n  Passed: \(.passed)\n  Failed: \(.failed)\n  Pass Rate: \(.passRate)\n  API URL: \(.apiUrl)"' "${LATEST_SUMMARY}" | tee -a "${LOG_FILE}"
      log ""
      log "Failed Tests:"
      jq -r '.results[] | select(.passed == false) | "  - \(.test): \(.details)"' "${LATEST_SUMMARY}" | tee -a "${LOG_FILE}" || true
    else
      cat "${LATEST_SUMMARY}" | tee -a "${LOG_FILE}"
    fi
  fi
fi

log ""
log "========================================"
log "Real-World Functionality Tests Complete"
log "Log file: ${LOG_FILE}"
log "Results: ${LOG_DIR}/functionality-*.json"
log "========================================"

exit ${exit_code}
