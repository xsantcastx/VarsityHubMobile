#!/usr/bin/env bash
set -euo pipefail

base_url="${SERVICE_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:4000}}"
base_url="${base_url%/}"

request_json() {
  local url="$1"
  shift
  curl -sS --max-time 20 "$@" "$url"
}

expect_http_code() {
  local url="$1"
  local expected="$2"
  shift 2
  local code
  code=$(curl -sS -o /tmp/smoke-body.json -w "%{http_code}" --max-time 20 "$@" "$url")
  if [ "$code" != "$expected" ]; then
    echo "❌ $url failed (expected $expected, got $code)"
    cat /tmp/smoke-body.json 2>/dev/null || true
    exit 1
  fi
}

expect_json_field() {
  local url="$1"
  local field="$2"
  shift 2
  local body
  body=$(request_json "$url" "$@")
  if ! echo "$body" | grep -q "$field"; then
    echo "❌ $url did not contain expected field '$field'"
    echo "$body"
    exit 1
  fi
}

expect_http_code "$base_url/health" "200"
expect_json_field "$base_url/health" '"status"' "-H" "Accept: application/json"

expect_http_code "$base_url/auth/me" "401"

if [ -n "${SMOKE_TEST_EMAIL:-}" ] && [ -n "${SMOKE_TEST_PASSWORD:-}" ]; then
  echo "Running optional login smoke test..."
  login_response=$(curl -sS --max-time 20 -X POST "$base_url/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SMOKE_TEST_EMAIL\",\"password\":\"$SMOKE_TEST_PASSWORD\"}")

  if echo "$login_response" | grep -q '"token"'; then
    echo "✅ Login smoke test passed"
  else
    echo "❌ Login smoke test failed"
    echo "$login_response"
    exit 1
  fi
else
  echo "ℹ️  No login credentials configured; skipped authenticated smoke test"
fi

echo "✅ Deploy smoke checks passed on $base_url"
