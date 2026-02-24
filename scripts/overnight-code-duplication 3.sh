#!/bin/bash
# Overnight Code Duplication Detection
# Finds duplicate code patterns

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/code-duplication-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for code duplication..."

cd "$PROJECT_ROOT"

# Simple duplication detection: find similar function/component patterns
DUPLICATES=()

# Scan for common patterns that might indicate duplication
PATTERNS=(
  "const.*=.*useState"
  "useEffect.*=>"
  "const.*=.*async.*=>"
  "router\.push"
  "console\.(log|error|warn)"
)

for pattern in "${PATTERNS[@]}"; do
  COUNT=$(grep -r -E "$pattern" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
  if [ "$COUNT" -gt 10 ]; then
    DUPLICATES+=("{\"pattern\":\"$pattern\",\"occurrences\":$COUNT,\"priority\":\"review\"}")
  fi
done

# Find files with very similar line counts and structure (heuristic)
SIMILAR_FILES=()
FILES=$(find app components -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | head -100)

for file1 in $FILES; do
  [ ! -f "$file1" ] && continue
  LINES1=$(wc -l < "$file1" 2>/dev/null || echo "0")
  
  for file2 in $FILES; do
    [ ! -f "$file2" ] && continue
    [ "$file1" = "$file2" ] && continue
    
    LINES2=$(wc -l < "$file2" 2>/dev/null || echo "0")
    
    # If files have similar line counts (within 10%), might be duplicates
    if [ "$LINES1" -gt 50 ] && [ "$LINES2" -gt 50 ]; then
      DIFF=$((LINES1 > LINES2 ? LINES1 - LINES2 : LINES2 - LINES1))
      PERCENT=$((DIFF * 100 / LINES1))
      
      if [ "$PERCENT" -lt 10 ]; then
        SIMILAR_FILES+=("{\"file1\":\"$file1\",\"file2\":\"$file2\",\"lines1\":$LINES1,\"lines2\":$LINES2,\"similarity\":\"${PERCENT}%\"}")
      fi
    fi
  done
done

TOTAL=$(( ${#DUPLICATES[@]} + ${#SIMILAR_FILES[@]} ))

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total": $TOTAL,
    "duplicatePatterns": ${#DUPLICATES[@]},
    "similarFiles": ${#SIMILAR_FILES[@]}
  },
  "duplicatePatterns": [$(IFS=','; echo "${DUPLICATES[*]}")],
  "similarFiles": [$(IFS=','; echo "${SIMILAR_FILES[*]}" | head -20)],
  "note": "This is a heuristic scan. For accurate duplication detection, use: jscpd, PMD, or SonarQube"
}
EOF

echo "✅ Code duplication scan complete!"
echo "📊 Results:"
echo "   Duplicate patterns found: ${#DUPLICATES[@]}"
echo "   Similar files: ${#SIMILAR_FILES[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For accurate duplication detection:"
echo "   npx jscpd app/ components/"
echo "   npx sonar-scanner"
