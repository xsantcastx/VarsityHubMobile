#!/usr/bin/env bash
# Comprehensive Westhill diagnostic: API, DB, and config check
# Run from project root: bash scripts/diagnose-westhill.sh

set -e

API_URL="${1:-https://api-production-8ac3.up.railway.app}"
echo "=== Westhill Diagnostic ==="
echo "API URL: $API_URL"
echo ""

# 1. Test API
echo "1. Testing API endpoint (GET /organizations?q=Westhill)..."
echo "---"
CURL_OUTPUT=$(curl -s "$API_URL/organizations?q=Westhill" 2>&1 || echo "FAILED")
if [ "$CURL_OUTPUT" = "FAILED" ]; then
  echo "❌ API unreachable or failed"
  echo "   Check: Is the backend running? Is the URL correct?"
else
  ORG_COUNT=$(echo "$CURL_OUTPUT" | jq 'length' 2>/dev/null || echo "0")
  if [ "$ORG_COUNT" = "0" ] || [ "$ORG_COUNT" = "null" ]; then
    echo "❌ API returned 0 organizations for 'Westhill'"
    echo "   Output: $CURL_OUTPUT" | head -5
  else
    echo "✅ API returned $ORG_COUNT organization(s)"
    echo "$CURL_OUTPUT" | jq '.'
  fi
fi
echo ""

# 2. Check DB
echo "2. Checking database (if server/ Prisma is available)..."
echo "---"
if [ -d "server" ] && [ -f "server/package.json" ]; then
  cd server
  if command -v npx &> /dev/null; then
    echo "Running Prisma query..."
    DB_RESULT=$(npx prisma db execute --stdin <<'SQLEOF' 2>&1 || echo "FAILED")
select id, name, status, place_id, zip_code, created_at
from "Organization"
where lower(name) like '%westhill%';
SQLEOF
    if [ "$DB_RESULT" = "FAILED" ]; then
      echo "❌ DB query failed (check DATABASE_URL env var)"
    else
      if echo "$DB_RESULT" | grep -q "westhill"; then
        echo "✅ Found Westhill in database:"
        echo "$DB_RESULT"
      else
        echo "❌ No 'westhill' organizations found in database"
        echo "   Full output: $DB_RESULT"
      fi
    fi
  else
    echo "⚠️  npx not found, skipping DB check"
  fi
  cd ..
else
  echo "⚠️  server/ directory not found, skipping DB check"
fi
echo ""

# 3. Check app config
echo "3. Checking app base URL config..."
echo "---"
if grep -r "EXPO_PUBLIC_API_URL\|api-production" app/.env* 2>/dev/null | head -3; then
  echo "Found API URL in .env files above"
else
  echo "No explicit API_URL in .env; app defaults to: https://api-production-8ac3.up.railway.app"
fi
echo ""

echo "=== Summary ==="
echo "Next steps:"
echo "1. If API returned empty: either Westhill doesn't exist in DB, or status is not 'active'"
echo "2. If DB query returned Westhill but status != 'active': run the UPDATE query above"
echo "3. If DB is empty: create Westhill via the app or DB insert"
echo "4. Make sure backend is running the latest code (restart/redeploy)"
echo "5. Verify app points to correct API URL"
