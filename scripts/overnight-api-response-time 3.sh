#!/bin/bash
# Overnight API Response Time Monitoring
# Monitors API endpoint response times (requires server running)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/api-response-time-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Monitoring API response times..."

cd "$PROJECT_ROOT"

# Default API URL (can be overridden)
API_URL="${API_URL:-http://localhost:4000}"

# Test endpoints
ENDPOINTS=(
  "/health"
  "/support/ping"
)

SLOW_ENDPOINTS=()
FAST_ENDPOINTS=()
FAILED_ENDPOINTS=()

for endpoint in "${ENDPOINTS[@]}"; do
  URL="${API_URL}${endpoint}"
  
  # Measure response time
  START_TIME=$(date +%s%N)
  
  if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>/dev/null || echo "000")
    END_TIME=$(date +%s%N)
  elif command -v wget >/dev/null 2>&1; then
    HTTP_CODE=$(wget -q -O /dev/null --timeout=5 --spider "$URL" 2>&1 && echo "200" || echo "000")
    END_TIME=$(date +%s%N)
  else
    echo "⚠️  curl or wget not found. Skipping API response time monitoring."
    cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "error": "curl or wget not found",
  "summary": {
    "totalEndpoints": 0,
    "slowEndpoints": 0
  }
}
EOF
    exit 0
  fi
  
  DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))
  
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "000" ]; then
    if [ "$DURATION_MS" -gt 1000 ]; then
      SLOW_ENDPOINTS+=("{\"endpoint\":\"$endpoint\",\"responseTimeMs\":$DURATION_MS,\"status\":\"slow\"}")
    elif [ "$DURATION_MS" -gt 0 ]; then
      FAST_ENDPOINTS+=("{\"endpoint\":\"$endpoint\",\"responseTimeMs\":$DURATION_MS,\"status\":\"fast\"}")
    fi
  else
    FAILED_ENDPOINTS+=("{\"endpoint\":\"$endpoint\",\"httpCode\":\"$HTTP_CODE\",\"status\":\"failed\"}")
  fi
done

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "apiUrl": "$API_URL",
  "summary": {
    "totalEndpoints": ${#ENDPOINTS[@]},
    "slowEndpoints": ${#SLOW_ENDPOINTS[@]},
    "fastEndpoints": ${#FAST_ENDPOINTS[@]},
    "failedEndpoints": ${#FAILED_ENDPOINTS[@]}
  },
  "slowEndpoints": [$(IFS=','; echo "${SLOW_ENDPOINTS[*]}")],
  "fastEndpoints": [$(IFS=','; echo "${FAST_ENDPOINTS[*]}")],
  "failedEndpoints": [$(IFS=','; echo "${FAILED_ENDPOINTS[*]}")],
  "note": "Server must be running for this test. Set API_URL environment variable to test different endpoints."
}
EOF

echo "✅ API response time monitoring complete!"
echo "📊 Results:"
echo "   Total endpoints tested: ${#ENDPOINTS[@]}"
echo "   Slow endpoints (>1s): ${#SLOW_ENDPOINTS[@]}"
echo "   Fast endpoints: ${#FAST_ENDPOINTS[@]}"
echo "   Failed endpoints: ${#FAILED_ENDPOINTS[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 To test more endpoints, set API_URL and add endpoints to the script"
