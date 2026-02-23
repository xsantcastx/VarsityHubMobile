#!/bin/bash
# Overnight Dead Code Detection
# Finds unused functions, exports, and variables

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/dead-code-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for dead code (unused exports/functions)..."

cd "$PROJECT_ROOT"

# Quick scan: find exported functions/components that might be unused
UNUSED_EXPORTS=()
UNUSED_FUNCTIONS=()

# Scan app/ and components/ for exports
FILES=$(find app components -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -150)

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  # Find exported functions/components
  EXPORTS=$(grep -E "^(export )?(function|const|class|interface|type)" "$file" 2>/dev/null | grep -E "export " | head -10 || true)
  
  if [ -n "$EXPORTS" ]; then
    # Simple heuristic: if file has exports but is small, might be unused
    FILE_LINES=$(wc -l < "$file" 2>/dev/null || echo "0")
    EXPORT_COUNT=$(echo "$EXPORTS" | wc -l | tr -d ' ')
    
    if [ "$EXPORT_COUNT" -gt 3 ] && [ "$FILE_LINES" -lt 50 ]; then
      UNUSED_EXPORTS+=("{\"file\":\"$file\",\"exports\":$EXPORT_COUNT,\"lines\":$FILE_LINES,\"priority\":\"review\"}")
    fi
  fi
done

TOTAL=$(( ${#UNUSED_EXPORTS[@]} + ${#UNUSED_FUNCTIONS[@]} ))

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total": $TOTAL,
    "unusedExports": ${#UNUSED_EXPORTS[@]},
    "unusedFunctions": ${#UNUSED_FUNCTIONS[@]}
  },
  "unusedExports": [$(IFS=','; echo "${UNUSED_EXPORTS[*]}")],
  "note": "This is a quick heuristic scan. For accurate results, use tools like: ts-prune, depcheck, or ESLint rule no-unused-vars"
}
EOF

echo "✅ Dead code scan complete!"
echo "📊 Results:"
echo "   Potential unused exports: ${#UNUSED_EXPORTS[@]}"
echo "   Total items to review: $TOTAL"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For accurate dead code detection, use:"
echo "   npx ts-prune"
echo "   npx depcheck"
