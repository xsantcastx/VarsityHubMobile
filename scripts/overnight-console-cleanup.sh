#!/bin/bash
# Overnight Console.log Audit & Cleanup
# Finds all console statements and reports cleanup opportunities

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/console-audit-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for console statements..."

cd "$PROJECT_ROOT"

# Find all console statements
CONSOLE_LOGS=0
CONSOLE_ERRORS=0
CONSOLE_WARNS=0
CONSOLE_DEBUGS=0
FILES_WITH_CONSOLE=0
FILES_BY_COUNT=()

# Scan TypeScript/TSX files (focus on app/ and components/)
FILES=$(find app components hooks utils -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -200)

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  # Count console statements by type (use wc -l which always returns a number)
  LOG_COUNT=$(grep -c "console\.log" "$file" 2>/dev/null | head -1 || echo "0")
  ERROR_COUNT=$(grep -c "console\.error" "$file" 2>/dev/null | head -1 || echo "0")
  WARN_COUNT=$(grep -c "console\.warn" "$file" 2>/dev/null | head -1 || echo "0")
  DEBUG_COUNT=$(grep -c "console\.debug" "$file" 2>/dev/null | head -1 || echo "0")
  
  # Convert to integers, defaulting to 0
  LOG_COUNT=$((LOG_COUNT + 0))
  ERROR_COUNT=$((ERROR_COUNT + 0))
  WARN_COUNT=$((WARN_COUNT + 0))
  DEBUG_COUNT=$((DEBUG_COUNT + 0))
  
  TOTAL=$((LOG_COUNT + ERROR_COUNT + WARN_COUNT + DEBUG_COUNT))
  
  if [ "$TOTAL" -gt 0 ]; then
    FILES_WITH_CONSOLE=$((FILES_WITH_CONSOLE + 1))
    CONSOLE_LOGS=$((CONSOLE_LOGS + LOG_COUNT))
    CONSOLE_ERRORS=$((CONSOLE_ERRORS + ERROR_COUNT))
    CONSOLE_WARNS=$((CONSOLE_WARNS + WARN_COUNT))
    CONSOLE_DEBUGS=$((CONSOLE_DEBUGS + DEBUG_COUNT))
    
    FILE_ESCAPED=$(echo "$file" | sed 's/"/\\"/g')
    FILES_BY_COUNT+=("{\"file\":\"$FILE_ESCAPED\",\"total\":$TOTAL,\"log\":$LOG_COUNT,\"error\":$ERROR_COUNT,\"warn\":$WARN_COUNT,\"debug\":$DEBUG_COUNT}")
  fi
done

# Check for __DEV__ guards
FILES_WITH_GUARDS=0
for file_entry in "${FILES_BY_COUNT[@]}"; do
  FILE_PATH=$(echo "$file_entry" | jq -r '.file' 2>/dev/null || echo "")
  if [ -n "$FILE_PATH" ] && [ -f "$FILE_PATH" ] && grep -q "__DEV__" "$FILE_PATH" 2>/dev/null; then
    FILES_WITH_GUARDS=$((FILES_WITH_GUARDS + 1))
  fi
done

# Generate JSON report
TOTAL_CONSOLE=$((CONSOLE_LOGS + CONSOLE_ERRORS + CONSOLE_WARNS + CONSOLE_DEBUGS))

if [ ${#FILES_BY_COUNT[@]} -eq 0 ]; then
  # No console statements found
  cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalConsoleStatements": 0,
    "consoleLog": 0,
    "consoleError": 0,
    "consoleWarn": 0,
    "consoleDebug": 0,
    "filesWithConsole": 0,
    "filesWithDevGuards": 0
  },
  "breakdown": {
    "byType": {
      "log": 0,
      "error": 0,
      "warn": 0,
      "debug": 0
    }
  },
  "topOffenders": [],
  "priorityFiles": [],
  "recommendations": {
    "remove": 0,
    "keepWithDevGuard": 0,
    "review": 0
  }
}
EOF
else
  # Sort files by total count (descending) using jq
  SORTED_JSON=$(printf '%s\n' "${FILES_BY_COUNT[@]}" | jq -s 'sort_by(.total) | reverse')
  
  cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalConsoleStatements": $TOTAL_CONSOLE,
    "consoleLog": $CONSOLE_LOGS,
    "consoleError": $CONSOLE_ERRORS,
    "consoleWarn": $CONSOLE_WARNS,
    "consoleDebug": $CONSOLE_DEBUGS,
    "filesWithConsole": $FILES_WITH_CONSOLE,
    "filesWithDevGuards": $FILES_WITH_GUARDS
  },
  "breakdown": {
    "byType": {
      "log": $CONSOLE_LOGS,
      "error": $CONSOLE_ERRORS,
      "warn": $CONSOLE_WARNS,
      "debug": $CONSOLE_DEBUGS
    }
  },
  "topOffenders": $(echo "$SORTED_JSON" | jq '.[0:20]'),
  "priorityFiles": $(echo "$SORTED_JSON" | jq '[.[] | select(.total >= 10)]'),
  "recommendations": {
    "remove": $CONSOLE_LOGS,
    "keepWithDevGuard": $((CONSOLE_ERRORS + CONSOLE_WARNS)),
    "review": $CONSOLE_DEBUGS
  }
}
EOF
fi

PRIORITY_COUNT=$(cat "$OUTPUT_FILE" 2>/dev/null | jq -r '.priorityFiles | length' 2>/dev/null || echo "0")

echo "✅ Console audit complete!"
echo "📊 Results:"
echo "   Total console statements: $TOTAL_CONSOLE"
echo "   console.log: $CONSOLE_LOGS (should be removed or wrapped)"
echo "   console.error: $CONSOLE_ERRORS (review for production)"
echo "   console.warn: $CONSOLE_WARNS (review for production)"
echo "   Files with 10+ statements: $PRIORITY_COUNT"
echo ""
echo "📄 Full report: $OUTPUT_FILE"
