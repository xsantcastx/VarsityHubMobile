#!/bin/bash
# Simple Unused Imports Scanner (Fast, no ESLint required)
# Uses pattern matching to find likely unused imports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/unused-imports-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for unused imports (simple pattern matching)..."

cd "$PROJECT_ROOT"

# Find TypeScript files
FILES=$(find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/.next/*" \
  ! -path "*/build/*" \
  ! -path "*/.git/*" \
  ! -path "*/server/dist/*" \
  2>/dev/null | head -100)  # Limit to first 100 files for speed

TOTAL_FILES=0
FILES_WITH_IMPORTS=0
UNUSED_BY_FILE=()

for file in $FILES; do
  [ ! -f "$file" ] && continue
  TOTAL_FILES=$((TOTAL_FILES + 1))
  
  # Extract import statements
  IMPORTS=$(grep -E "^import .* from" "$file" 2>/dev/null || true)
  
  if [ -n "$IMPORTS" ]; then
    FILES_WITH_IMPORTS=$((FILES_WITH_IMPORTS + 1))
    
    # Count imports
    IMPORT_COUNT=$(echo "$IMPORTS" | wc -l | tr -d ' ')
    
    # Simple heuristic: if file has many imports but is small, might have unused ones
    FILE_LINES=$(wc -l < "$file" 2>/dev/null || echo "0")
    FILE_SIZE=$(wc -c < "$file" 2>/dev/null || echo "0")
    
    # Flag files with many imports relative to size
    if [ "$IMPORT_COUNT" -gt 5 ] && [ "$FILE_LINES" -lt 200 ]; then
      UNUSED_BY_FILE+=("{\"file\":\"$file\",\"importCount\":$IMPORT_COUNT,\"fileLines\":$FILE_LINES,\"priority\":\"high\"}")
    elif [ "$IMPORT_COUNT" -gt 10 ]; then
      UNUSED_BY_FILE+=("{\"file\":\"$file\",\"importCount\":$IMPORT_COUNT,\"fileLines\":$FILE_LINES,\"priority\":\"medium\"}")
    fi
  fi
done

# Generate simple report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalFilesScanned": $TOTAL_FILES,
    "filesWithImports": $FILES_WITH_IMPORTS,
    "filesNeedingReview": ${#UNUSED_BY_FILE[@]}
  },
  "filesToReview": [$(IFS=','; echo "${UNUSED_BY_FILE[*]}")],
  "note": "This is a quick scan. For accurate results, use ESLint or run: npx eslint --ext .ts,.tsx . --rule '@typescript-eslint/no-unused-vars: error'"
}
EOF

echo "✅ Quick scan complete!"
echo "📊 Results:"
echo "   Files scanned: $TOTAL_FILES"
echo "   Files with imports: $FILES_WITH_IMPORTS"
echo "   Files needing review: ${#UNUSED_BY_FILE[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For accurate results, run ESLint manually:"
echo "   npx eslint --ext .ts,.tsx app/ components/ --rule '@typescript-eslint/no-unused-vars: error'"
