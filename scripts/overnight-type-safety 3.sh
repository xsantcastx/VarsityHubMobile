#!/bin/bash
# Overnight Type Safety Audit
# Checks for type safety issues (any types, missing types, etc.)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/type-safety-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Auditing type safety..."

cd "$PROJECT_ROOT"

# Count type safety issues
ANY_TYPES=0
AS_ANY=0
MISSING_TYPES=0
FILES_WITH_ANY=()

# Scan for 'any' types
FILES=$(find app components hooks utils api -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -200)

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  ANY_COUNT=$(grep -c ": any\|as any" "$file" 2>/dev/null || echo "0")
  AS_ANY_COUNT=$(grep -c "as any" "$file" 2>/dev/null || echo "0")
  
  if [ "$ANY_COUNT" -gt 0 ]; then
    ANY_TYPES=$((ANY_TYPES + ANY_COUNT))
    AS_ANY=$((AS_ANY + AS_ANY_COUNT))
    FILES_WITH_ANY+=("{\"file\":\"$file\",\"anyCount\":$ANY_COUNT,\"asAnyCount\":$AS_ANY_COUNT}")
  fi
  
  # Check for missing return types
  FUNCTIONS=$(grep -E "^(export )?(function|const.*=.*\(|const.*=.*=>)" "$file" 2>/dev/null | grep -v ":" | wc -l || echo "0")
  if [ "$FUNCTIONS" -gt 0 ]; then
    MISSING_TYPES=$((MISSING_TYPES + FUNCTIONS))
  fi
done

TOTAL_ISSUES=$((ANY_TYPES + MISSING_TYPES))

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalIssues": $TOTAL_ISSUES,
    "anyTypes": $ANY_TYPES,
    "asAnyCasts": $AS_ANY,
    "missingReturnTypes": $MISSING_TYPES,
    "filesWithAny": ${#FILES_WITH_ANY[@]}
  },
  "filesWithAny": [$(IFS=','; echo "${FILES_WITH_ANY[*]}" | head -30)],
  "recommendations": {
    "replaceAny": "Replace 'any' types with proper TypeScript types",
    "addReturnTypes": "Add explicit return types to functions",
    "useTypeGuards": "Use type guards instead of 'as any' casts"
  },
  "note": "Run 'npx tsc --noEmit' for full type checking"
}
EOF

echo "✅ Type safety audit complete!"
echo "📊 Results:"
echo "   Total 'any' types: $ANY_TYPES"
echo "   'as any' casts: $AS_ANY"
echo "   Missing return types: $MISSING_TYPES"
echo "   Files with 'any': ${#FILES_WITH_ANY[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For full type checking:"
echo "   npx tsc --noEmit"
