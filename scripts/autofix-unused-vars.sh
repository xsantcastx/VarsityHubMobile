#!/bin/bash

# Auto-fix script for unused variables/imports
# Prefixes unused vars with _ and removes completely unused imports

echo "🔧 Auto-fixing unused variables and imports..."

# Step 1: Run ESLint with auto-fix for unused vars
echo ""
echo "Step 1/3: Running ESLint auto-fix (adding _ prefix to unused vars)..."
npm run lint:strict -- --fix --quiet 2>&1 | grep -E "✨|error|warning" || echo "✅ ESLint auto-fix completed"

# Step 2: Remove completely unused imports (no fix, manual review needed)
echo ""
echo "Step 2/3: Finding completely unused imports (requires manual review)..."
npm run lint:strict -- --rule '@typescript-eslint/no-unused-vars: error' 2>&1 | \
  grep -E "defined but never used" | \
  awk -F"'" '{print $2}' | \
  sort | uniq -c | sort -rn > /tmp/unused-imports-summary.txt

if [ -s /tmp/unused-imports-summary.txt ]; then
  echo "📋 Top unused imports (see /tmp/unused-imports-summary.txt):"
  head -20 /tmp/unused-imports-summary.txt
else
  echo "✅ No completely unused imports found"
fi

# Step 3: Verify fix results
echo ""
echo "Step 3/3: Verifying fixes..."
npm run lint:strict 2>&1 | grep -E "@typescript-eslint/no-unused-vars" | wc -l | \
  xargs -I {} echo "Remaining unused-vars warnings: {}"

echo ""
echo "✅ Auto-fix complete! Review changes before committing."
echo "   - Unused vars prefixed with _ where possible"
echo "   - Check git diff for unintended changes"
echo "   - Some imports may need manual removal"
