#!/bin/bash

# Overnight Real-World Functionality Test Runner
# Runs end-to-end tests of actual app functionality (auth, posts, teams, messaging, etc.)
#
# SAFETY: These tests CREATE real data (users, posts, teams, events, messages).
# By default, this script refuses to run against production. To force it (NOT recommended
# unless you have a cleanup plan), set ALLOW_PROD_TESTS=1 explicitly.
#
# Usage:
#   ./scripts/overnight-functionality.sh                                 # local API
#   API_URL=http://localhost:4000 ./scripts/overnight-functionality.sh   # explicit
#   API_URL=https://staging.varsityhub.app ./scripts/overnight-functionality.sh
#
# Required dedicated staging target:
#   API_URL=https://staging-api.varsityhub.app ALLOW_PROD_TESTS=0 ./scripts/overnight-functionality.sh

set -euo pipefail

# Resolve repo root from the script's own location so this works from any cwd
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

API_URL="${API_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:4000}}"
ALLOW_PROD_TESTS="${ALLOW_PROD_TESTS:-0}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_DIR="overnight-results"
LOG_FILE="${LOG_DIR}/functionality-${TIMESTAMP}.log"

mkdir -p "${LOG_DIR}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"
}

# ─── Production guard ──────────────────────────────────────────────────────
# These tests create real users, posts, teams, events, and messages.
# Refuse to run against anything that looks like production unless explicitly overridden.
PROD_PATTERNS="(^https?://(api\\.)?varsityhub\\.app|railway\\.app|render\\.com|herokuapp\\.com|fly\\.dev|vercel\\.app|onrender\\.com)"

if echo "${API_URL}" | grep -iE "${PROD_PATTERNS}" > /dev/null 2>&1; then
  if [ "${ALLOW_PROD_TESTS}" != "1" ]; then
    log "✗ REFUSING TO RUN against what looks like production: ${API_URL}"
    log ""
    log "These tests create REAL users, posts, teams, events, and messages."
    log "If this is genuinely a staging host, set ALLOW_PROD_TESTS=1:"
    log "  ALLOW_PROD_TESTS=1 API_URL=${API_URL} ./scripts/overnight-functionality.sh"
    log ""
    log "Recommended: point at a scratch staging DB you can wipe freely."
    exit 2
  fi
  log "⚠️  ALLOW_PROD_TESTS=1 — proceeding against ${API_URL}. You own the cleanup."
fi

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
