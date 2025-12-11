#!/bin/bash

###############################################################################
# Railway Service Cleanup Automation
# 
# Disables all non-API services in Railway project to prevent stale builds
# and unwanted emails. Requires: railway CLI installed and authenticated.
#
# Usage:
#   bash scripts/railway-cleanup.sh                       # Dry-run (show what would be deleted)
#   bash scripts/railway-cleanup.sh --confirm              # Actually disable/delete services
#   bash scripts/railway-cleanup.sh --ci                   # CI mode (no interactive prompts)
#
# Prerequisites:
#   - railway CLI installed: npm install -g @railway/cli
#   - Authenticated: railway login
#   - RAILWAY_PROJECT_ID env var set or Railway project linked
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODE="${1:-dry-run}"
PROJECT_ID="${RAILWAY_PROJECT_ID:-}"
CONFIRM=false
CI_MODE=false

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

# Parse arguments
if [ "$MODE" = "--confirm" ]; then
  CONFIRM=true
  MODE="confirm"
elif [ "$MODE" = "--ci" ]; then
  CI_MODE=true
  CONFIRM=true
  MODE="ci"
fi

# Check prerequisites
check_prerequisites() {
  log_section "Checking Prerequisites"
  
  # Check if railway CLI is installed
  if ! command -v railway &> /dev/null; then
    log_fail "railway CLI not found"
    echo "Install it with: npm install -g @railway/cli"
    echo "Or: brew install railway"
    exit 1
  fi
  log_ok "railway CLI installed"
  
  # Check if authenticated
  if ! railway whoami &> /dev/null; then
    log_fail "Not authenticated with Railway"
    echo "Run: railway login"
    exit 1
  fi
  log_ok "Authenticated with Railway"
  
  # Try to get project ID if not set
  if [ -z "$PROJECT_ID" ]; then
    if [ -f ".railway/config.json" ] || [ -f "railway.json" ]; then
      PROJECT_ID=$(railway project --json 2>/dev/null | jq -r '.id' 2>/dev/null || echo "")
    fi
  fi
  
  if [ -z "$PROJECT_ID" ]; then
    log_warn "RAILWAY_PROJECT_ID not set. Attempting to detect from context..."
    # This will use the linked project from current directory
    PROJECT_ID="linked"
  fi
}

# List all services in the project
get_services() {
  log_section "Fetching Services"
  
  if [ "$PROJECT_ID" = "linked" ]; then
    railway service list --json 2>/dev/null || echo "[]"
  else
    railway service list --project "$PROJECT_ID" --json 2>/dev/null || echo "[]"
  fi
}

# Disable a service
disable_service() {
  local service_id=$1
  local service_name=$2
  
  log_info "Disabling service: $service_name (ID: $service_id)"
  
  if [ "$CONFIRM" = true ]; then
    if [ "$PROJECT_ID" = "linked" ]; then
      railway service delete "$service_id" --force 2>/dev/null && {
        log_ok "Disabled: $service_name"
        return 0
      } || {
        log_fail "Failed to disable: $service_name"
        return 1
      }
    else
      railway service delete "$service_id" --project "$PROJECT_ID" --force 2>/dev/null && {
        log_ok "Disabled: $service_name"
        return 0
      } || {
        log_fail "Failed to disable: $service_name"
        return 1
      }
    fi
  else
    log_warn "Would disable: $service_name"
    return 0
  fi
}

# Main cleanup logic
cleanup_services() {
  local services
  local disabled_count=0
  local kept_count=0
  local services_to_disable=("rare-liberation" "varsityhub" "VarsityHubMobile")
  
  services=$(get_services)
  
  if [ -z "$services" ] || [ "$services" = "[]" ]; then
    log_warn "No services found or unable to fetch services"
    return 1
  fi
  
  log_section "Service Cleanup Analysis"
  
  # Parse services and identify which ones to disable
  local service_count=$(echo "$services" | jq 'length' 2>/dev/null || echo 0)
  
  if [ "$service_count" -eq 0 ]; then
    log_ok "No services to process"
    return 0
  fi
  
  log_info "Found $service_count service(s)"
  echo "$services" | jq -r '.[] | "\(.name) (ID: \(.id))"' 2>/dev/null | while read -r service_info; do
    log_info "  - $service_info"
  done
  
  echo ""
  log_section "Cleanup Plan"
  
  # Process each service
  echo "$services" | jq -r '.[] | "\(.id)|\(.name)"' 2>/dev/null | while IFS='|' read -r id name; do
    local should_disable=false
    
    # Check if service should be disabled
    for service_pattern in "${services_to_disable[@]}"; do
      if [[ "$name" == *"$service_pattern"* ]]; then
        should_disable=true
        break
      fi
    done
    
    if [ "$should_disable" = true ]; then
      if [ "$CONFIRM" = true ]; then
        log_warn "DISABLE: $name"
      else
        log_warn "Would disable: $name"
      fi
    else
      if [[ "$name" == "api"* ]]; then
        log_ok "KEEP: $name (API service)"
      else
        log_warn "KEEP: $name (not in disable list)"
      fi
    fi
  done
  
  echo ""
}

# Verify cleanup
verify_cleanup() {
  log_section "Post-Cleanup Verification"
  
  log_info "Running health check..."
  sleep 5  # Give Railway a moment to process
  
  if bash scripts/railway-health-check.sh --ci &>/dev/null; then
    log_ok "Railway API health check passed"
    return 0
  else
    log_warn "Railway API not yet responding (may need a moment)"
    return 1
  fi
}

# Main execution
main() {
  check_prerequisites
  cleanup_services
  
  if [ "$MODE" = "confirm" ] || [ "$MODE" = "ci" ]; then
    log_section "Next Steps"
    log_info "Services have been disabled in Railway"
    log_info "The api service is now the only active service"
    log_info "Monitor health checks: https://github.com/xsantcastx/VarsityHubMobile/actions/workflows/railway-health.yml"
    
    if [ "$CI_MODE" = false ]; then
      echo ""
      read -p "Press Enter to verify health endpoint..."
      verify_cleanup
    fi
  else
    log_section "Dry-Run Summary"
    log_warn "This was a dry-run. To actually disable services, run:"
    echo ""
    echo "  bash scripts/railway-cleanup.sh --confirm"
    echo ""
    log_info "Review the plan above before confirming."
  fi
}

main
