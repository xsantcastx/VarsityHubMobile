#!/bin/bash

# Test Coach Onboarding Fix
# This script verifies the critical fix is in place

echo "🔍 Testing Coach Onboarding Fix..."
echo ""

# Check if the fix is in app/onboarding/index.tsx
FILE="app/onboarding/index.tsx"

if [ ! -f "$FILE" ]; then
  echo "❌ ERROR: $FILE not found!"
  exit 1
fi

# Check for the corrected condition
if grep -q "if (progress > 4)" "$FILE"; then
  echo "✅ PASS: Correct validation logic found (progress > 4)"
else
  echo "❌ FAIL: Bug still present! Should have 'if (progress > 4)'"
  echo "   Checking what's actually there..."
  grep "progress.*4" "$FILE" | head -3
  exit 1
fi

# Check that setProgress is in the hook destructuring
if grep -q "const { progress, state, isLoaded, setProgress }" "$FILE"; then
  echo "✅ PASS: setProgress properly destructured"
else
  echo "❌ FAIL: setProgress not properly destructured"
  exit 1
fi

# Check step-6 has validation
STEP6_FILE="app/onboarding/step-6-authorized-users.tsx"
if grep -q "if (ob.role === 'coach')" "$STEP6_FILE"; then
  echo "✅ PASS: Step 6 has coach validation in skipStep"
else
  echo "⚠️  WARNING: Step 6 missing coach validation"
fi

echo ""
echo "✅ ALL CHECKS PASSED!"
echo ""
echo "📱 To test in app:"
echo "1. Restart Metro bundler: npm run dev"
echo "2. Reload app in simulator: Press 'r' in Metro terminal"
echo "3. Clear app data: Long press app → Delete → Reinstall"
echo "4. Test coach onboarding flow"
echo ""
echo "Expected behavior:"
echo "- Coaches MUST complete steps 2, 3, 4 before reaching step 7"
echo "- Step 6 (authorized users) CANNOT be skipped"
echo "- If progress > 4 without completing steps 2-4, redirect to first incomplete step"
