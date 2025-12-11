#!/bin/bash

###############################################################################
# Railway Health & Service Verification
# 
# Monitors Railway API service health and verifies deployment status.
# Can be run locally or integrated into CI/CD for automated alerts.
#
# Usage:
#   bash scripts/railway-health-check.sh                 # Local check
#   bash scripts/railway-health-check.sh --ci             # CI mode (exit code only)
#   bash scripts/railway-health-check.sh --monitor        # Loop until failure
###############################################################################

set -e

API_URL="${RAILWAY_API_URL:-https://api-production-8ac3.up.railway.app}"
HEALTH_ENDPOINT="$API_URL/health"
TIMEOUT=10
RETRIES=3
RETRY_DELAY=2

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="${1:-local}"

# Helper functions
log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_ok() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_fail() {
  echo -e "${RED}❌ $1${NC}"
}

log_section() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_health() {
  log_info "Checking Railway API health..."
  log_info "Endpoint: $HEALTH_ENDPOINT"
  
  local attempt=1
  local response
  local http_code
  
  while [ $attempt -le $RETRIES ]; do
    log_info "Attempt $attempt/$RETRIES..."
    
    response=$(curl -s --max-time $TIMEOUT -w "\n%{http_code}" "$HEALTH_ENDPOINT" 2>/dev/null || echo "")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ] || [ "$http_code" == "202" ]; then
      echo "$body"
      return 0
    fi
    
    if [ $attempt -lt $RETRIES ]; then
      log_warn "Request failed (HTTP $http_code). Retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
    fi
    
    ((attempt++))
  done
  
  log_fail "Health check failed after $RETRIES attempts (HTTP $http_code)"
  return 1
}

verify_deployment() {
  log_section "Railway Deployment Status"
  
  local health_json
  health_json=$(check_health) || return 1
  
  log_info "Health response:"
  echo "$health_json" | jq '.' 2>/dev/null || echo "$health_json"
  
  # Parse fields
  local status=$(echo "$health_json" | jq -r '.status // "unknown"' 2>/dev/null)
  local ready=$(echo "$health_json" | jq -r '.ready // false' 2>/dev/null)
  local uptime=$(echo "$health_json" | jq -r '.uptime // "unknown"' 2>/dev/null)
  
  log_info "Parsed fields:"
  echo "  Status: $status"
  echo "  Ready: $ready"
  echo "  Uptime: $uptime"
  
  # Check status
  if [ "$status" == "ok" ]; then
    log_ok "API status is OK"
  else
    log_fail "API status is not OK: $status"
    return 1
  fi
  
  # Warn if not ready (expected in some deployments)
  if [ "$ready" == "false" ]; then
    log_warn "API reports not ready (may indicate startup or DB migration)"
  else
    log_ok "API is ready for requests"
  fi
  
  return 0
}

verify_services() {
  log_section "Railway Services Configuration"
  
  log_info "Expected configuration:"
  echo "  ✓ api service (enabled, auto-deploy)"
  echo "  ✗ rare-liberation (disabled)"
  echo "  ✗ varsityhub (disabled)"
  echo "  ✗ VarsityHubMobile (disabled)"
  
  log_warn "Note: Cannot verify via API. Confirm in Railway Dashboard:"
  echo "    1. Open https://railway.app/project/[PROJECT_ID]/settings"
  echo "    2. Go to Deployments → Services"
  echo "    3. Verify only 'api' service has Auto Deploy enabled"
  echo "    4. Unused services should be disabled or deleted"
}

check_sendgrid_status() {
  log_section "Known Warnings"
  
  log_warn "SendGrid Email Templates"
  echo "  Status: Pending setup (documented in CONFIGURATION_AUDIT_COMPLETE.md:248)"
  echo "  Impact: Email sending will fail until configured"
  echo "  Action: Configure SendGrid API key in Railway env vars"
}

local_check() {
  log_section "Railway Health Check"
  echo "Date: $(date)"
  echo "URL: $HEALTH_ENDPOINT"
  echo ""
  
  verify_deployment || return 1
  verify_services
  check_sendgrid_status
  
  echo ""
  log_ok "Health check complete"
  return 0
}

ci_check() {
  # CI mode: exit code only, minimal output
  if check_health > /dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

monitor_health() {
  log_section "Railway Health Monitor"
  echo "Monitoring health endpoint every 30 seconds..."
  echo "Press Ctrl+C to stop"
  echo ""
  
  local failure_count=0
  local max_failures=3
  
  while true; do
    if check_health > /dev/null 2>&1; then
      log_ok "$(date '+%H:%M:%S') - Health check passed"
      failure_count=0
    else
      ((failure_count++))
      log_fail "$(date '+%H:%M:%S') - Health check failed ($failure_count/$max_failures)"
      
      if [ $failure_count -ge $max_failures ]; then
        log_fail "Max failures reached. API may be down."
        return 1
      fi
    fi
    
    sleep 30
  done
}

# Main
case "$MODE" in
  --ci)
    ci_check
    ;;
  --monitor)
    monitor_health
    ;;
  local|--local)
    local_check
    ;;
  *)
    local_check
    ;;
esac

exit $?
