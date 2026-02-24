#!/usr/bin/env bash
set -euo pipefail

base_url="${SERVICE_URL:-${EXPO_PUBLIC_API_URL:-http://localhost:4000}}"
base_url="${base_url%/}"

health_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/health")
if [ "$health_code" != "200" ]; then
  echo "❌ /health failed (expected 200, got $health_code)"
  exit 1
fi

auth_code=$(curl -s -o /dev/null -w "%{http_code}" "$base_url/auth/me")
if [ "$auth_code" != "401" ]; then
  echo "❌ /auth/me failed (expected 401, got $auth_code)"
  exit 1
fi

echo "✅ Basic smoke checks passed on $base_url"

if [ -n "${SMOKE_TEST_EMAIL:-}" ] && [ -n "${SMOKE_TEST_PASSWORD:-}" ]; then
  echo "Running optional login smoke test..."
  login_response=$(curl -s -X POST "$base_url/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$SMOKE_TEST_EMAIL\",\"password\":\"$SMOKE_TEST_PASSWORD\"}")

  if echo "$login_response" | grep -q '\"token\"'; then
    echo "✅ Login smoke test passed"
  else
    echo "❌ Login smoke test failed"
    echo "$login_response"
    exit 1
  fi
fi
