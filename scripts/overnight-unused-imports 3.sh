#!/bin/bash
# Overnight Unused Imports Cleanup
# Finds and reports unused imports across the codebase (fast version)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/unused-imports-$TIMESTAMP.json"
TEMP_ESLINT_OUTPUT="$RESULTS_DIR/eslint-unused-temp.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for unused imports (using ESLint batch mode)..."

cd "$PROJECT_ROOT"

# Use ESLint to scan all files at once (much faster)
echo "Running ESLint analysis..."
npx eslint . \
  --ext .ts,.tsx \
  --format=json \
  --rule '@typescript-eslint/no-unused-vars: [error, { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }]' \
  --max-warnings=999999 \
  > "$TEMP_ESLINT_OUTPUT" 2>/dev/null || true

# Parse ESLint output
TOTAL_FILES=0
FILES_WITH_UNUSED=0
TOTAL_UNUSED=0
UNUSED_BY_FILE=()
REACT_COUNT=0
COMPONENT_COUNT=0
UTILITY_COUNT=0

# Process ESLint JSON output
if [ -f "$TEMP_ESLINT_OUTPUT" ] && [ -s "$TEMP_ESLINT_OUTPUT" ]; then
  # Extract files with unused import warnings
  FILES_DATA=$(cat "$TEMP_ESLINT_OUTPUT" | jq -r '.[] | select(.messages != null and (.messages | length) > 0) | {filePath: .filePath, messages: [.messages[] | select(.ruleId == "@typescript-eslint/no-unused-vars" and (.message | contains("imported") or contains("defined but never used")))]} | select(.messages | length > 0)' 2>/dev/null || echo "[]")
  
  if [ "$FILES_DATA" != "[]" ] && [ -n "$FILES_DATA" ]; then
    echo "$FILES_DATA" | jq -c '.' | while IFS= read -r file_data; do
      FILE_PATH=$(echo "$file_data" | jq -r '.filePath' | sed "s|^$PROJECT_ROOT/||")
      UNUSED_COUNT=$(echo "$file_data" | jq '.messages | length')
      
      if [ "$UNUSED_COUNT" -gt 0 ]; then
        TOTAL_FILES=$((TOTAL_FILES + 1))
        FILES_WITH_UNUSED=$((FILES_WITH_UNUSED + 1))
        TOTAL_UNUSED=$((TOTAL_UNUSED + UNUSED_COUNT))
        
        # Categorize imports
        MESSAGES=$(echo "$file_data" | jq -r '.messages[].message')
        REACT=$(echo "$MESSAGES" | grep -ci "react" || echo "0")
        COMPONENT=$(echo "$MESSAGES" | grep -ciE "(component|icon|button|view|text)" || echo "0")
        UTILITY=$(echo "$MESSAGES" | grep -ciE "(util|helper|lib|api)" || echo "0")
        
        REACT_COUNT=$((REACT_COUNT + REACT))
        COMPONENT_COUNT=$((COMPONENT_COUNT + COMPONENT))
        UTILITY_COUNT=$((UTILITY_COUNT + UTILITY))
        
        UNUSED_BY_FILE+=("{\"file\":\"$FILE_PATH\",\"count\":$UNUSED_COUNT,\"react\":$REACT,\"components\":$COMPONENT,\"utilities\":$UTILITY}")
      fi
    done
  fi
fi

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalFiles": $TOTAL_FILES,
    "filesWithUnused": $FILES_WITH_UNUSED,
    "totalUnused": $TOTAL_UNUSED,
    "averagePerFile": $(awk "BEGIN {if ($FILES_WITH_UNUSED > 0) printf \"%.2f\", $TOTAL_UNUSED / $FILES_WITH_UNUSED; else printf \"0\"}")
  },
  "breakdown": {
    "reactImports": $REACT_COUNT,
    "componentImports": $COMPONENT_COUNT,
    "utilityImports": $UTILITY_COUNT
  },
  "topOffenders": $(printf '%s\n' "${UNUSED_BY_FILE[@]}" | jq -s 'sort_by(.count) | reverse | .[0:20]'),
  "priorityFiles": $(printf '%s\n' "${UNUSED_BY_FILE[@]}" | jq -s '[sort_by(.count) | reverse | .[] | select(.count >= 5)]')
}
EOF

# Cleanup temp file
rm -f "$TEMP_ESLINT_OUTPUT"

echo "✅ Unused imports scan complete!"
echo "📊 Results:"
echo "   Files with unused imports: $FILES_WITH_UNUSED"
echo "   Total unused imports: $TOTAL_UNUSED"
PRIORITY_COUNT=$(cat "$OUTPUT_FILE" | jq '.priorityFiles | length' 2>/dev/null || echo "0")
echo "   Priority files (5+ unused): $PRIORITY_COUNT"
echo ""
echo "📄 Full report: $OUTPUT_FILE"
