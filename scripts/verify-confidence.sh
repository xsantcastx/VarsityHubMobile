#!/bin/bash
set -euo pipefail

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env.example"
fi

if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|\#*) continue ;;
      *=*)
        key="${line%%=*}"
        value="${line#*=}"
        export "$key=$value"
        ;;
    esac
  done < "$ENV_FILE"
fi

API_BASE_URL="${VERIFY_COACH_FLOW_BASE_URL:-http://localhost:4000}"
STARTED_API_PID=""
API_LOG_FILE="${TMPDIR:-/tmp}/varsityhub-verify-api.log"

run_step() {
  local label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

wait_for_api() {
  local attempts=0
  until curl -fsS "$API_BASE_URL/health" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Local API failed to become ready at $API_BASE_URL"
      if [ -f "$API_LOG_FILE" ]; then
        echo "--- API log tail ---"
        tail -n 80 "$API_LOG_FILE" || true
        echo "--- end API log tail ---"
      fi
      exit 1
    fi
    sleep 1
  done
}

cleanup_api() {
  if [ -n "${STARTED_API_PID:-}" ] && kill -0 "$STARTED_API_PID" >/dev/null 2>&1; then
    kill "$STARTED_API_PID" >/dev/null 2>&1 || true
    wait "$STARTED_API_PID" >/dev/null 2>&1 || true
  fi
}

ensure_local_api() {
  if curl -fsS "$API_BASE_URL/health" >/dev/null 2>&1; then
    echo "Using existing API at $API_BASE_URL"
    return
  fi

  echo "Starting local API for coach-flow verification..."
  : > "$API_LOG_FILE"
  (
    cd server
    npx tsx scripts/start-verify-api.ts
  ) >"$API_LOG_FILE" 2>&1 &
  STARTED_API_PID=$!
  trap cleanup_api EXIT
  wait_for_api
}

run_step "Typecheck" npm run typecheck
run_step "Guardrails" npm run verify:guardrails
run_step "Client and server regressions" npm run test:regressions
run_step "Server invariants" npm --prefix server run test:invariants
run_step "Coach approval wiring" npm --prefix server run verify:coach-approval
ensure_local_api
run_step "Coach route battery" npm --prefix server run verify:coach-flow
run_step "Event approval flow" npm --prefix server run verify:event-approval-flow
run_step "Ad approval flow" npm --prefix server run verify:ad-approval-flow
run_step "Ad dashboard review flow" npm --prefix server run verify:ad-dashboard-review-flow
cleanup_api
run_step "Server build" npm --prefix server run build
