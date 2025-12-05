#!/bin/bash

# Overnight health checker for VarsityHub APIs.
# Usage:
#   ./overnight-health-check.sh
#   API_URL=https://staging.example.com ./overnight-health-check.sh
#   AUTH_TOKEN=xxx EXTRA_ENDPOINTS="GET /support/ping|POST /notifications/test" ./overnight-health-check.sh

set -euo pipefail

API_URL="${API_URL:-https://api-production-8ac3.up.railway.app}"
LOG_DIR="${LOG_DIR:-overnight-health-$(date +%Y%m%d-%H%M%S)}"
AUTH_HEADER=()

if [[ -n "${AUTH_TOKEN:-}" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${AUTH_TOKEN}")
fi

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/health.log"

ENDPOINTS=(
  "GET|/health|Core service health"
)

IFS='|' read -r -a extra <<< "${EXTRA_ENDPOINTS:-}"
if [[ -n "${EXTRA_ENDPOINTS:-}" ]]; then
  ENDPOINTS+=("${extra[@]}")
fi

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"
}

check_endpoint() {
  local method="$1"
  local path="$2"
  local label="$3"
  local url="${API_URL}${path}"
  local body_file
  body_file="$(mktemp)"
  local status

  log "→ ${label} (${method} ${path})"
  local curl_cmd=(curl -sS -X "${method}")
  if ((${#AUTH_HEADER[@]})); then
    curl_cmd+=("${AUTH_HEADER[@]}")
  fi
  curl_cmd+=("${url}" -o "${body_file}" -w "%{http_code}")
  if ! status=$("${curl_cmd[@]}"); then
    log "✗ Request failed (curl error)"
    cat "${body_file}" | sed 's/^/  /' >> "${LOG_FILE}"
    rm -f "${body_file}"
    return 1
  fi

  local body
  body="$(<"${body_file}")"
  rm -f "${body_file}"

  log "  Status: ${status}"
  log "  Response: ${body}"

  if [[ "${path}" == "/health" && "${status}" == "200" ]]; then
    for key in stripe smtp sentry database; do
      if ! grep -q "\"${key}\": *true" <<< "${body}"; then
        log "  ⚠ ${key} not true in /health payload"
      fi
    done
  fi
}

log "========================================"
log "VarsityHub Overnight Health Check"
log "Target API: ${API_URL}"
log "Log file: ${LOG_FILE}"
log "========================================"

for entry in "${ENDPOINTS[@]}"; do
  IFS='|' read -r method path label <<< "${entry}"
  check_endpoint "${method}" "${path}" "${label:-${path}}" || true
  log ""
done

log "Health checks complete."
