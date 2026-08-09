#!/bin/bash
set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

base_url="${SERVICE_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:4000}}"
base_url="${base_url%/}"
health_url="$base_url/health"
health_secret="${HEALTH_CHECK_SECRET:-}"
errors=0
warnings=0

print_header() {
  echo "======================================"
  echo "$1"
  echo "======================================"
}

check_health_endpoint() {
  local curl_args=(curl -sS -o /tmp/ops-health.json -w '%{http_code}' --max-time 20)
  if [ -n "$health_secret" ]; then
    curl_args+=( -H "x-health-check-secret: $health_secret" )
  fi
  curl_args+=( "$health_url" )

  local code body
  if ! code=$("${curl_args[@]}"); then
    echo -e "${RED}❌${NC} Could not reach $health_url"
    errors=$((errors + 1))
    return
  fi

  if [ "$code" != "200" ]; then
    echo -e "${RED}❌${NC} /health returned $code"
    errors=$((errors + 1))
    return
  fi

  body=$(cat /tmp/ops-health.json)
  if echo "$body" | grep -q '"status":"ok"' && echo "$body" | grep -q '"ready":true'; then
    echo -e "${GREEN}✅${NC} /health returned a healthy payload"
  else
    echo -e "${RED}❌${NC} /health returned an unhealthy payload"
    echo "$body"
    errors=$((errors + 1))
  fi
}

check_sentry_configuration() {
  if [ -n "${SENTRY_DSN:-}" ] || [ -n "${EXPO_PUBLIC_SENTRY_DSN:-}" ]; then
    echo -e "${GREEN}✅${NC} Sentry DSN detected in environment"
    return
  fi

  for env_file in .env server/.env .env.local server/.env.local; do
    if [ -f "$env_file" ] && grep -qE 'SENTRY_DSN|EXPO_PUBLIC_SENTRY_DSN' "$env_file"; then
      echo -e "${GREEN}✅${NC} Sentry DSN detected in $env_file"
      return
    fi
  done

  echo -e "${YELLOW}⚠️${NC} Sentry DSN not detected locally; verify Railway secrets before relying on alerting"
  warnings=$((warnings + 1))
}

check_railway_backups() {
  echo ""
  echo -e "${YELLOW}⚠️${NC} Manual Railway confirmation required: Postgres backups are enabled, retention is set, and a restore drill can be executed."
  warnings=$((warnings + 1))
}

check_sentry_alerts() {
  echo -e "${YELLOW}⚠️${NC} Manual Sentry confirmation required: add alerts for 5xx spikes, slow-query bursts, auth failures, and payment errors."
  warnings=$((warnings + 1))
}

print_header "Ops readiness check"
echo "Base URL: $base_url"
check_health_endpoint
check_sentry_configuration
check_railway_backups
check_sentry_alerts

echo ""
echo "Summary:"
if [ "$errors" -eq 0 ]; then
  echo -e "${GREEN}✅${NC} Health endpoint and Sentry config look ready"
else
  echo -e "${RED}❌${NC} Found $errors blocking issue(s)"
fi
if [ "$warnings" -gt 0 ]; then
  echo -e "${YELLOW}⚠️${NC} Found $warnings manual confirmation step(s)"
fi

if [ "$errors" -ne 0 ]; then
  exit 1
fi
