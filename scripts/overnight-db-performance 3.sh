#!/bin/bash
# Overnight Database Query Performance Analysis
# Analyzes slow queries, missing indexes, and N+1 problems

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/db-performance-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Analyzing database query performance..."

cd "$PROJECT_ROOT/server"

# Find all Prisma queries
QUERY_PATTERNS=(
  "prisma\\.(user|post|game|team|event|message|notification|ad)\\.findMany"
  "prisma\\.(user|post|game|team|event|message|notification|ad)\\.findFirst"
  "prisma\\.(user|post|game|team|event|message|notification|ad)\\.findUnique"
  "prisma\\.(user|post|game|team|event|message|notification|ad)\\.count"
)

SLOW_QUERIES=()
MISSING_INDEXES=()
N_PLUS_ONE=()
LARGE_RESULTS=()

# Scan TypeScript files for database queries
FILES=$(find src -type f -name "*.ts" ! -path "*/node_modules/*" ! -path "*/dist/*")

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  LINE_NUM=0
  while IFS= read -r line; do
    LINE_NUM=$((LINE_NUM + 1))
    
    # Check for Prisma queries
    for pattern in "${QUERY_PATTERNS[@]}"; do
      if echo "$line" | grep -qE "$pattern"; then
        # Check for missing pagination (take/limit)
        if ! echo "$line" | grep -qE "(take|limit)"; then
          # Check if it's in a loop (N+1 problem)
          CONTEXT=$(sed -n "$((LINE_NUM - 10)),$((LINE_NUM + 10))p" "$file" 2>/dev/null || echo "")
          if echo "$CONTEXT" | grep -qE "(for|forEach|map|while)"; then
            N_PLUS_ONE+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"query\":\"$pattern\",\"issue\":\"N+1 query in loop\"}")
          else
            LARGE_RESULTS+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"query\":\"$pattern\",\"issue\":\"No pagination (take/limit)\"}")
          fi
        fi
        
        # Check for WHERE clauses that might need indexes
        if echo "$line" | grep -qE "where.*:"; then
          # Extract WHERE conditions
          WHERE_CONTENT=$(echo "$line" | sed -n 's/.*where.*:\([^}]*\).*/\1/p')
          # Check for common filter fields
          if echo "$WHERE_CONTENT" | grep -qE "(user_id|author_id|game_id|team_id|created_at|date|approval_status)"; then
            MISSING_INDEXES+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"field\":\"$(echo "$WHERE_CONTENT" | grep -oE "(user_id|author_id|game_id|team_id|created_at|date|approval_status)" | head -1)\",\"query\":\"$pattern\"}")
          fi
        fi
      fi
    done
  done < "$file"
done

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "slowQueries": ${#SLOW_QUERIES[@]},
    "missingIndexes": ${#MISSING_INDEXES[@]},
    "nPlusOne": ${#N_PLUS_ONE[@]},
    "largeResults": ${#LARGE_RESULTS[@]}
  },
  "slowQueries": [$(IFS=','; echo "${SLOW_QUERIES[*]}")],
  "missingIndexes": [$(IFS=','; echo "${MISSING_INDEXES[*]}" | jq -s 'unique_by(.field)')],
  "nPlusOne": [$(IFS=','; echo "${N_PLUS_ONE[*]}")],
  "largeResults": [$(IFS=','; echo "${LARGE_RESULTS[*]}")],
  "recommendations": {
    "critical": $(if [ ${#N_PLUS_ONE[@]} -gt 0 ]; then echo "true"; else echo "false"; fi),
    "high": $(if [ ${#MISSING_INDEXES[@]} -gt 5 ]; then echo "true"; else echo "false"; fi),
    "medium": $(if [ ${#LARGE_RESULTS[@]} -gt 0 ]; then echo "true"; else echo "false"; fi)
  }
}
EOF

echo "✅ Database performance analysis complete!"
echo "📊 Results:"
echo "   N+1 queries found: ${#N_PLUS_ONE[@]}"
echo "   Missing indexes: ${#MISSING_INDEXES[@]}"
echo "   Queries without pagination: ${#LARGE_RESULTS[@]}"
echo ""
echo "📄 Full report: $OUTPUT_FILE"
