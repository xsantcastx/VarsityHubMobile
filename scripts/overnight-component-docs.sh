#!/bin/bash
# Overnight Component Documentation Audit
# Checks React components for missing documentation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/component-docs-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Auditing component documentation..."

cd "$PROJECT_ROOT"

# Find React components
COMPONENTS=()
COMPONENTS_WITHOUT_DOCS=()
COMPONENTS_WITHOUT_PROPS=()

FILES=$(find app components -type f -name "*.tsx" 2>/dev/null | head -150)

for file in $FILES; do
  [ ! -f "$file" ] && continue
  
  # Check if it's a component file
  HAS_EXPORT=$(grep -qE "^(export )?(default )?function|^(export )?const.*=.*\(|^export.*function" "$file" && echo "yes" || echo "no")
  
  if [ "$HAS_EXPORT" = "yes" ]; then
    COMPONENT_NAME=$(basename "$file" .tsx)
    
    # Check for JSDoc comments
    HAS_JSDOC=$(grep -qE "/\*\*|/\*" "$file" && echo "yes" || echo "no")
    
    # Check for TypeScript interface/type for props
    HAS_PROPS_TYPE=$(grep -qE "interface.*Props|type.*Props" "$file" && echo "yes" || echo "no")
    
    COMPONENTS+=("{\"file\":\"$file\",\"name\":\"$COMPONENT_NAME\",\"hasJSDoc\":\"$HAS_JSDOC\",\"hasPropsType\":\"$HAS_PROPS_TYPE\"}")
    
    if [ "$HAS_JSDOC" = "no" ]; then
      COMPONENTS_WITHOUT_DOCS+=("{\"file\":\"$file\",\"name\":\"$COMPONENT_NAME\"}")
    fi
    
    if [ "$HAS_PROPS_TYPE" = "no" ]; then
      COMPONENTS_WITHOUT_PROPS+=("{\"file\":\"$file\",\"name\":\"$COMPONENT_NAME\"}")
    fi
  fi
done

TOTAL_COMPONENTS=${#COMPONENTS[@]}
MISSING_DOCS=${#COMPONENTS_WITHOUT_DOCS[@]}
MISSING_PROPS=${#COMPONENTS_WITHOUT_PROPS[@]}

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "totalComponents": $TOTAL_COMPONENTS,
    "withoutJSDoc": $MISSING_DOCS,
    "withoutPropsType": $MISSING_PROPS,
    "documentationCoverage": $(awk "BEGIN {if ($TOTAL_COMPONENTS > 0) printf \"%.1f\", ($TOTAL_COMPONENTS - $MISSING_DOCS) * 100 / $TOTAL_COMPONENTS; else printf \"0\"}")
  },
  "componentsWithoutDocs": [$(IFS=','; echo "${COMPONENTS_WITHOUT_DOCS[*]}" | head -30)],
  "componentsWithoutProps": [$(IFS=','; echo "${COMPONENTS_WITHOUT_PROPS[*]}" | head -30)],
  "recommendations": {
    "addJSDoc": "Add JSDoc comments to components describing their purpose",
    "addPropsTypes": "Define TypeScript interfaces for component props",
    "useStorybook": "Consider using Storybook for component documentation"
  }
}
EOF

echo "✅ Component documentation audit complete!"
echo "📊 Results:"
echo "   Total components: $TOTAL_COMPONENTS"
echo "   Without JSDoc: $MISSING_DOCS"
echo "   Without props types: $MISSING_PROPS"
COVERAGE=$(awk "BEGIN {if ($TOTAL_COMPONENTS > 0) printf \"%.1f\", ($TOTAL_COMPONENTS - $MISSING_DOCS) * 100 / $TOTAL_COMPONENTS; else printf \"0\"}")
echo "   Documentation coverage: ${COVERAGE}%"
echo ""
echo "📄 Report: $OUTPUT_FILE"
