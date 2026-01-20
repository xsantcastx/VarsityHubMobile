#!/bin/bash
# Overnight Floating Promise Fixer
# Identifies floating promises and suggests fixes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/floating-promises-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for floating promises..."

cd "$PROJECT_ROOT"

# Patterns to detect floating promises
PATTERNS=(
  "router\\.push"
  "router\\.replace"
  "router\\.back"
  "\\.then\\(.*\\)(?!\\.catch)"
  "await.*\\.catch"
)

FLOATING_PROMISES=()
ROUTER_NAVIGATION=()
PROMISE_CHAINS=()
ASYNC_CALLS=()

# Scan TypeScript/TSX files (focus on app/ and components/ for speed)
FILES=$(find app components hooks utils api -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | head -200)

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  LINE_NUM=0
  while IFS= read -r line; do
    LINE_NUM=$((LINE_NUM + 1))
    
    # Check for router navigation (safe to add void)
    if echo "$line" | grep -qE "router\.(push|replace|back)"; then
      if ! echo "$line" | grep -qE "(void|await)"; then
        ROUTER_NAVIGATION+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"code\":\"$(echo "$line" | sed 's/^[[:space:]]*//' | cut -c1-80)\",\"fix\":\"Add 'void' operator\"}")
      fi
    fi
    
    # Check for .then() without .catch()
    if echo "$line" | grep -qE "\.then\("; then
      # Check if there's a .catch() on the same or next line
      NEXT_LINE=$(sed -n "$((LINE_NUM + 1))p" "$file" 2>/dev/null || echo "")
      if ! echo "$line$NEXT_LINE" | grep -qE "\.catch\("; then
        PROMISE_CHAINS+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"code\":\"$(echo "$line" | sed 's/^[[:space:]]*//' | cut -c1-80)\",\"fix\":\"Add .catch() handler\"}")
      fi
    fi
    
    # Check for async function calls without await/void
    if echo "$line" | grep -qE "(await|void)"; then
      continue  # Already handled
    fi
    
    # Look for common async patterns
    if echo "$line" | grep -qE "(\.(then|catch)\(|async|Promise\.|fetch\(|api\.|API\.|httpGet|httpPost|httpPut|httpDelete)"; then
      # Check if it's in a function that's already async or has error handling
      CONTEXT=$(sed -n "$((LINE_NUM - 5)),$((LINE_NUM + 5))p" "$file" 2>/dev/null || echo "")
      if ! echo "$CONTEXT" | grep -qE "(await|void|try|catch)"; then
        ASYNC_CALLS+=("{\"file\":\"$file\",\"line\":$LINE_NUM,\"code\":\"$(echo "$line" | sed 's/^[[:space:]]*//' | cut -c1-80)\",\"fix\":\"Add await or void operator\"}")
      fi
    fi
  done < "$file"
done

TOTAL=$(( ${#ROUTER_NAVIGATION[@]} + ${#PROMISE_CHAINS[@]} + ${#ASYNC_CALLS[@]} ))

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total": $TOTAL,
    "routerNavigation": ${#ROUTER_NAVIGATION[@]},
    "promiseChains": ${#PROMISE_CHAINS[@]},
    "asyncCalls": ${#ASYNC_CALLS[@]}
  },
  "routerNavigation": [$(IFS=','; echo "${ROUTER_NAVIGATION[*]}")],
  "promiseChains": [$(IFS=','; echo "${PROMISE_CHAINS[*]}")],
  "asyncCalls": [$(IFS=','; echo "${ASYNC_CALLS[*]}")],
  "safeAutoFixes": {
    "routerNavigation": ${#ROUTER_NAVIGATION[@]},
    "description": "Router navigation can safely be wrapped with 'void' operator"
  },
  "manualReview": {
    "promiseChains": ${#PROMISE_CHAINS[@]},
    "asyncCalls": ${#ASYNC_CALLS[@]},
    "description": "These need manual review to determine proper error handling"
  }
}
EOF

echo "✅ Floating promises scan complete!"
echo "📊 Results:"
echo "   Total floating promises: $TOTAL"
echo "   Router navigation (safe to fix): ${#ROUTER_NAVIGATION[@]}"
echo "   Promise chains (needs review): ${#PROMISE_CHAINS[@]}"
echo "   Async calls (needs review): ${#ASYNC_CALLS[@]}"
echo ""
echo "📄 Full report: $OUTPUT_FILE"
