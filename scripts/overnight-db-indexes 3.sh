#!/bin/bash
# Overnight Database Index Analysis
# Analyzes Prisma schema for missing indexes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/db-indexes-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Analyzing database indexes..."

cd "$PROJECT_ROOT"

# Check if Prisma schema exists
SCHEMA_FILE="server/prisma/schema.prisma"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "⚠️  Prisma schema not found at $SCHEMA_FILE"
  cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "error": "Prisma schema not found",
  "summary": {
    "totalIndexes": 0,
    "missingIndexes": []
  }
}
EOF
  exit 0
fi

# Analyze indexes in schema
TOTAL_INDEXES=0
MISSING_INDEXES=()
MODELS_WITHOUT_INDEXES=()

# Extract models and their fields
MODELS=$(grep -E "^model " "$SCHEMA_FILE" | sed 's/model //; s/ {.*//' || true)

for model in $MODELS; do
  [ -z "$model" ] && continue
  
  # Count indexes for this model
  INDEX_COUNT=$(sed -n "/^model $model/,/^}/p" "$SCHEMA_FILE" | grep -c "@@index" || echo "0")
  TOTAL_INDEXES=$((TOTAL_INDEXES + INDEX_COUNT))
  
  # Check for common fields that should be indexed
  HAS_ID=$(sed -n "/^model $model/,/^}/p" "$SCHEMA_FILE" | grep -q "@id" && echo "yes" || echo "no")
  HAS_CREATED_AT=$(sed -n "/^model $model/,/^}/p" "$SCHEMA_FILE" | grep -qE "created_at.*DateTime" && echo "yes" || echo "no")
  HAS_USER_ID=$(sed -n "/^model $model/,/^}/p" "$SCHEMA_FILE" | grep -qE "user_id.*String" && echo "yes" || echo "no")
  
  # If model has created_at or user_id but no indexes, flag it
  if [ "$INDEX_COUNT" -eq 0 ] && ([ "$HAS_CREATED_AT" = "yes" ] || [ "$HAS_USER_ID" = "yes" ]); then
    MISSING_INDEXES+=("{\"model\":\"$model\",\"issue\":\"Has created_at or user_id but no indexes\",\"recommendation\":\"Add @@index([user_id, created_at])\"}")
  fi
done

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalIndexes": $TOTAL_INDEXES,
    "totalModels": $(echo "$MODELS" | wc -l | tr -d ' '),
    "missingIndexes": ${#MISSING_INDEXES[@]}
  },
  "missingIndexes": [$(IFS=','; echo "${MISSING_INDEXES[*]}")],
  "recommendations": {
    "commonIndexes": "Consider indexes on: user_id, created_at, foreign keys, frequently queried fields"
  },
  "note": "Review Prisma query logs to identify slow queries that need indexes"
}
EOF

echo "✅ Database index analysis complete!"
echo "📊 Results:"
echo "   Total indexes: $TOTAL_INDEXES"
echo "   Models analyzed: $(echo "$MODELS" | wc -l | tr -d ' ')"
echo "   Missing indexes: ${#MISSING_INDEXES[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
