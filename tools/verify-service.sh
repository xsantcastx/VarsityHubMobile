#!/usr/bin/env bash
set -euo pipefail

if [[ ${1-} == "" ]]; then
  echo "Usage: $0 https://<service>.up.railway.app" >&2
  exit 64
fi

SERVICE_URL="$1"

echo "=== GET $SERVICE_URL/health ==="
curl -i "$SERVICE_URL/health" || true

echo -e "\n=== GET $SERVICE_URL/auth/me ==="
curl -i "$SERVICE_URL/auth/me" || true
