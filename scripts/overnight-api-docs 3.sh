#!/bin/bash
# Overnight API Documentation Generator
# Generates API endpoint documentation from routes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/api-docs-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Generating API documentation..."

cd "$PROJECT_ROOT/server"

# Find all route files
ROUTE_FILES=$(find src/routes -type f -name "*.ts" 2>/dev/null || true)
ENDPOINTS=()
TOTAL_ENDPOINTS=0

for route_file in $ROUTE_FILES; do
  [ ! -f "$route_file" ] && continue
  
  ROUTE_NAME=$(basename "$route_file" .ts)
  
  # Extract HTTP methods and paths
  GET_ENDPOINTS=$(grep -E "\.get\(|router\.get\(" "$route_file" 2>/dev/null | wc -l || echo "0")
  POST_ENDPOINTS=$(grep -E "\.post\(|router\.post\(" "$route_file" 2>/dev/null | wc -l || echo "0")
  PUT_ENDPOINTS=$(grep -E "\.put\(|router\.put\(" "$route_file" 2>/dev/null | wc -l || echo "0")
  DELETE_ENDPOINTS=$(grep -E "\.delete\(|router\.delete\(" "$route_file" 2>/dev/null | wc -l || echo "0")
  
  TOTAL=$((GET_ENDPOINTS + POST_ENDPOINTS + PUT_ENDPOINTS + DELETE_ENDPOINTS))
  TOTAL_ENDPOINTS=$((TOTAL_ENDPOINTS + TOTAL))
  
  if [ "$TOTAL" -gt 0 ]; then
    ENDPOINTS+=("{\"route\":\"$ROUTE_NAME\",\"file\":\"$route_file\",\"get\":$GET_ENDPOINTS,\"post\":$POST_ENDPOINTS,\"put\":$PUT_ENDPOINTS,\"delete\":$DELETE_ENDPOINTS,\"total\":$TOTAL}")
  fi
done

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalEndpoints": $TOTAL_ENDPOINTS,
    "totalRoutes": ${#ENDPOINTS[@]}
  },
  "routes": [$(IFS=','; echo "${ENDPOINTS[*]}")],
  "recommendations": {
    "documentation": "Consider using OpenAPI/Swagger for API documentation",
    "tools": "Use tools like: swagger-jsdoc, @apidevtools/swagger-jsdoc, or tsoa"
  },
  "note": "This is a basic endpoint count. For full API docs, use OpenAPI/Swagger"
}
EOF

echo "✅ API documentation scan complete!"
echo "📊 Results:"
echo "   Total endpoints: $TOTAL_ENDPOINTS"
echo "   Route files: ${#ENDPOINTS[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For full API documentation:"
echo "   npm install --save-dev swagger-jsdoc"
echo "   npm install --save-dev @apidevtools/swagger-jsdoc"
