#!/usr/bin/env sh
# Quick Railway route sanity checks
# Usage:
#   API_URL="https://api-production-8ac3.up.railway.app" ./scripts/railway-route-check.sh
# Optional:
#   QUERY="Westhill" ZIP="06902" ./scripts/railway-route-check.sh

set -e

API_URL="${API_URL:-https://api-production-8ac3.up.railway.app}"
QUERY="${QUERY:-Westhill}"
ZIP="${ZIP:-}" # optional zip filter

say() { printf "%s\n" "$*"; }
header() { say "\n==> $*"; }

header "Target API: $API_URL"
header "Health Check"
code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
say "Health HTTP: $code"
if [ "$code" != "200" ]; then
  say "❌ Health not 200; inspect Railway logs and env vars"
  exit 1
fi

header "Organizations (name contains: $QUERY)"
orgs_json=$(curl -s "$API_URL/organizations?q=$QUERY")
count=$(printf "%s" "$orgs_json" | jq 'length')
say "Count: $count"
first=$(printf "%s" "$orgs_json" | jq '.[0] // null')
say "First: $first"

header "Nearby Search (query=$QUERY${ZIP:+, zip=$ZIP})"
nearby_url="$API_URL/organizations/search/nearby?query=$QUERY"
if [ -n "$ZIP" ]; then
  nearby_url="$nearby_url&zip=$ZIP"
fi
nearby_json=$(curl -s "$nearby_url")
nearby_count=$(printf "%s" "$nearby_json" | jq 'length')
names=$(printf "%s" "$nearby_json" | jq '[.[].name] | .[:10]')
say "Nearby Count: $nearby_count"
say "Nearby Names (first 10): $names"

header "Result"
if [ "$count" -eq 0 ] && [ "$nearby_count" -eq 0 ]; then
  say "⚠️ Westhill not found in active orgs; check DB status or filters."
else
  say "✅ Route checks succeeded."
fi
