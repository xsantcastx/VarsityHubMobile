#!/bin/bash
# Simple Floating Promise Scanner (Fast version)
# Quick scan for common floating promise patterns

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/floating-promises-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Scanning for floating promises (quick scan)..."

cd "$PROJECT_ROOT"

# Quick scan: just count patterns
ROUTER_COUNT=$(grep -r "router\.\(push\|replace\|back\)" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "void\|await" | wc -l | tr -d ' ' || echo "0")
PROMISE_COUNT=$(grep -r "\.then(" app/ components/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v "\.catch" | wc -l | tr -d ' ' || echo "0")

TOTAL=$((ROUTER_COUNT + PROMISE_COUNT))

# Generate simple report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total": $TOTAL,
    "routerNavigation": $ROUTER_COUNT,
    "promiseChains": $PROMISE_COUNT
  },
  "note": "Quick scan of app/ and components/. For full scan, run the full script or use ESLint rule: @typescript-eslint/no-floating-promises"
}
EOF

echo "✅ Quick floating promises scan complete!"
echo "📊 Results:"
echo "   Router navigation (needs void): $ROUTER_COUNT"
echo "   Promise chains (needs .catch): $PROMISE_COUNT"
echo "   Total: $TOTAL"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For accurate results, use ESLint:"
echo "   npx eslint --ext .ts,.tsx app/ components/ --rule '@typescript-eslint/no-floating-promises: error'"
