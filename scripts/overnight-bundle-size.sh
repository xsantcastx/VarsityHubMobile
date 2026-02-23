#!/bin/bash
# Overnight Bundle Size Analysis
# Analyzes bundle size and identifies large dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/bundle-size-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Analyzing bundle size..."

cd "$PROJECT_ROOT"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules not found. Run 'npm install' first."
  cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "error": "node_modules not found. Run 'npm install' first.",
  "summary": {
    "totalSize": 0,
    "largePackages": []
  }
}
EOF
  exit 0
fi

# Analyze node_modules size
LARGE_PACKAGES=()
TOTAL_SIZE=0

# Find largest packages in node_modules (top 20)
if [ -d "node_modules" ]; then
  while IFS= read -r package; do
    [ -z "$package" ] && continue
    SIZE=$(du -sk "$package" 2>/dev/null | cut -f1 || echo "0")
    SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $SIZE/1024}")
    PACKAGE_NAME=$(basename "$package")
    
    if [ "$SIZE" -gt 5000 ]; then  # > 5MB
      LARGE_PACKAGES+=("{\"name\":\"$PACKAGE_NAME\",\"sizeMB\":$SIZE_MB,\"sizeKB\":$SIZE}")
    fi
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
  done < <(find node_modules -maxdepth 1 -type d ! -name "node_modules" 2>/dev/null | head -20)
fi

TOTAL_SIZE_MB=$(awk "BEGIN {printf \"%.2f\", $TOTAL_SIZE/1024}")

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalSizeMB": $TOTAL_SIZE_MB,
    "totalSizeKB": $TOTAL_SIZE,
    "largePackagesCount": ${#LARGE_PACKAGES[@]}
  },
  "largePackages": [$(IFS=','; echo "${LARGE_PACKAGES[*]}")],
  "recommendations": {
    "checkDuplicates": "Run 'npm ls' to check for duplicate dependencies",
    "analyzeBundle": "Use 'npx @expo/bundle-analyzer' or 'npx source-map-explorer' for detailed analysis"
  }
}
EOF

echo "✅ Bundle size analysis complete!"
echo "📊 Results:"
echo "   Total node_modules size: ${TOTAL_SIZE_MB}MB"
echo "   Large packages (>5MB): ${#LARGE_PACKAGES[@]}"
echo ""
echo "📄 Report: $OUTPUT_FILE"
echo ""
echo "💡 For detailed bundle analysis:"
echo "   npx @expo/bundle-analyzer"
echo "   npx source-map-explorer 'dist/**/*.js'"
