#!/bin/bash
# Overnight Environment Variable Audit
# Checks for missing, unused, or misconfigured environment variables

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/env-audit-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Auditing environment variables..."

cd "$PROJECT_ROOT"

# Find all environment variable references
ENV_REFS=()
MISSING_ENV=()
USED_ENV=()

# Scan server code for process.env usage
if [ -d "server/src" ]; then
  ENV_USAGE=$(grep -r "process\.env\." server/src --include="*.ts" --include="*.js" 2>/dev/null | grep -oE "process\.env\.[A-Z_]+" | sort -u || true)
  
  while IFS= read -r env_var; do
    [ -z "$env_var" ] && continue
    VAR_NAME=$(echo "$env_var" | sed 's/process\.env\.//')
    USED_ENV+=("$VAR_NAME")
    
    # Check if it's in .env.example
    if [ -f ".env.example" ]; then
      if ! grep -q "^$VAR_NAME=" .env.example 2>/dev/null; then
        MISSING_ENV+=("{\"variable\":\"$VAR_NAME\",\"issue\":\"Used in code but not in .env.example\"}")
      fi
    fi
  done <<< "$ENV_USAGE"
fi

# Check .env.example for documented variables
DOCUMENTED_ENV=()
if [ -f ".env.example" ]; then
  DOCUMENTED_ENV=($(grep -E "^[A-Z_]+=" .env.example 2>/dev/null | cut -d'=' -f1 | sort -u || true))
fi

# Find potentially unused env vars (in .env.example but not in code)
UNUSED_ENV=()
if [ ${#DOCUMENTED_ENV[@]} -gt 0 ]; then
  for var in "${DOCUMENTED_ENV[@]}"; do
    if ! printf '%s\n' "${USED_ENV[@]}" | grep -q "^${var}$"; then
      UNUSED_ENV+=("{\"variable\":\"$var\",\"issue\":\"In .env.example but not found in code\"}")
    fi
  done
fi

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalUsed": ${#USED_ENV[@]},
    "totalDocumented": ${#DOCUMENTED_ENV[@]},
    "missingFromExample": ${#MISSING_ENV[@]},
    "potentiallyUnused": ${#UNUSED_ENV[@]}
  },
  "usedVariables": [$(IFS=','; printf '"%s"' "${USED_ENV[@]}" | sed 's/"/"/g' | sed 's/^/[/; s/$/]/' | tr '\n' ',' | sed 's/,$//')],
  "missingFromExample": [$(IFS=','; echo "${MISSING_ENV[*]}")],
  "potentiallyUnused": [$(IFS=','; echo "${UNUSED_ENV[*]}")],
  "note": "Review potentially unused variables - they may be used in build scripts, CI/CD, or runtime"
}
EOF

echo "✅ Environment variable audit complete!"
echo "📊 Results:"
echo "   Variables used in code: ${#USED_ENV[@]}"
echo "   Documented in .env.example: ${#DOCUMENTED_ENV[@]}"
echo "   Missing from .env.example: ${#MISSING_ENV[@]}"
echo "   Potentially unused: ${#UNUSED_ENV[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
