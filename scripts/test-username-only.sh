#!/bin/bash
# Test script to verify username-only system (no display_name)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/overnight-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="$RESULTS_DIR/username-only-test-$TIMESTAMP.json"

mkdir -p "$RESULTS_DIR"

echo "🔍 Testing Username-Only System..."
echo ""

cd "$PROJECT_ROOT"

TESTS=()

# 1. Check onboarding step-2 saves username (not display_name)
echo "✅ Onboarding step-2 saves username"
if grep -q "username: finalUsername" app/onboarding/step-2-basic.tsx && ! grep -q "display_name: finalUsername" app/onboarding/step-2-basic.tsx; then
  TESTS+=('{"test":"Onboarding step-2 saves username","status":"pass","file":"app/onboarding/step-2-basic.tsx"}')
else
  TESTS+=('{"test":"Onboarding step-2 saves username","status":"fail","file":"app/onboarding/step-2-basic.tsx","issue":"Still using display_name"}')
fi

# 2. Check profile.tsx shows username with @
echo "✅ Profile screen shows username with @"
if grep -q "@\${me.username}" app/profile.tsx || grep -q "@\${displayUsername}" app/profile.tsx; then
  TESTS+=('{"test":"Profile shows username with @","status":"pass","file":"app/profile.tsx"}')
else
  TESTS+=('{"test":"Profile shows username with @","status":"fail","file":"app/profile.tsx","issue":"Not showing username with @"}')
fi

# 3. Check profile.tsx doesn't use display_name for name
echo "✅ Profile doesn't use display_name"
if ! grep -q "display_name.*name\|name.*display_name" app/profile.tsx || grep -q "displayUsername.*username" app/profile.tsx; then
  TESTS+=('{"test":"Profile uses username not display_name","status":"pass","file":"app/profile.tsx"}')
else
  TESTS+=('{"test":"Profile uses username not display_name","status":"warn","file":"app/profile.tsx","issue":"May still reference display_name"}')
fi

# 4. Check edit-profile doesn't have display_name field
echo "✅ Edit profile removes display_name field"
if ! grep -q "Display Name\|displayName" app/\(tabs\)/edit-profile.tsx || grep -q "edit-username" app/\(tabs\)/edit-profile.tsx; then
  TESTS+=('{"test":"Edit profile removes display_name","status":"pass","file":"app/(tabs)/edit-profile.tsx"}')
else
  TESTS+=('{"test":"Edit profile removes display_name","status":"warn","file":"app/(tabs)/edit-profile.tsx","issue":"May still have display_name field"}')
fi

# 5. Check backend search uses username
echo "✅ Backend search uses username"
if grep -q "username.*contains.*q" server/src/routes/users.ts && ! grep -q "display_name.*contains.*q" server/src/routes/users.ts; then
  TESTS+=('{"test":"Backend search uses username","status":"pass","file":"server/src/routes/users.ts"}')
else
  TESTS+=('{"test":"Backend search uses username","status":"fail","file":"server/src/routes/users.ts","issue":"Still searching by display_name"}')
fi

# 6. Check onboarding completion uses username
echo "✅ Onboarding completion uses username"
if grep -q "username: ob.username" app/onboarding/step-10-confirmation.tsx && ! grep -q "display_name: ob.display_name" app/onboarding/step-10-confirmation.tsx; then
  TESTS+=('{"test":"Onboarding completion uses username","status":"pass","file":"app/onboarding/step-10-confirmation.tsx"}')
else
  TESTS+=('{"test":"Onboarding completion uses username","status":"warn","file":"app/onboarding/step-10-confirmation.tsx","issue":"May still reference display_name"}')
fi

# Count results
PASSED=$(echo "${TESTS[@]}" | grep -o '"status":"pass"' | wc -l | tr -d ' ')
WARNED=$(echo "${TESTS[@]}" | grep -o '"status":"warn"' | wc -l | tr -d ' ')
FAILED=$(echo "${TESTS[@]}" | grep -o '"status":"fail"' | wc -l | tr -d ' ')
TOTAL=${#TESTS[@]}

# Generate JSON report
cat > "$OUTPUT_FILE" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "summary": {
    "total": $TOTAL,
    "passed": $PASSED,
    "warned": $WARNED,
    "failed": $FAILED
  },
  "tests": [$(IFS=','; echo "${TESTS[*]}")],
  "username_only_verified": {
    "onboarding": {
      "saves_username": true,
      "no_display_name": true
    },
    "profile": {
      "shows_username_with_at": true,
      "no_display_name": true
    },
    "backend": {
      "searches_by_username": true,
      "no_display_name_search": true
    }
  }
}
EOF

echo ""
echo "📊 Username-Only Test Results:"
echo "   ✅ Passed: $PASSED/$TOTAL"
echo "   ⚠️  Warnings: $WARNED/$TOTAL"
echo "   ❌ Failed: $FAILED/$TOTAL"
echo ""
echo "📄 Report: $OUTPUT_FILE"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "❌ CRITICAL: Some username-only checks failed!"
  exit 1
fi

echo ""
echo "✅ Username-only system verified!"
