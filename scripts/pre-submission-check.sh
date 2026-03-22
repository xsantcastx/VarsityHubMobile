#!/bin/bash

# VarsityHub Pre-Submission Checklist
# Validates app is ready for App Store submission

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PASSED=0
FAILED=0
WARNINGS=0

echo "🔍 VarsityHub Pre-Submission Checklist"
echo "====================================="
echo "Project: $PROJECT_ROOT"
echo ""

cd "$PROJECT_ROOT"

# Check 1: App config exists and versions are set
echo -n "1) app.json and package.json versions are set... "
if [ -f "app.json" ] && [ -f "package.json" ] && \
   grep -q '"version"' app.json && grep -q '"version"' package.json; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 2: iOS App Store submission identifiers
echo -n "2) iOS submit config (Apple ID + ASC app ID)... "
if [ -f "eas.json" ] && \
   grep -q '"appleId"' eas.json && \
   grep -q '"ascAppId"' eas.json && \
   grep -q '"appleTeamId"' eas.json; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 3: Bundle identifier and team ID set
echo -n "3) iOS bundle identifier and team ID configured... "
if grep -q '"bundleIdentifier"' app.json && grep -q '"appleTeamId"' app.json; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 4: Privacy policy URL configured
echo -n "4) Privacy policy URL present in iOS Info.plist config... "
if grep -q '"NSPrivacyPolicyURL"' app.json; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 5: Required core assets exist
echo -n "5) Core app assets exist (icon/adaptive/splash)... "
if [ -f "assets/images/icon.png" ] && [ -f "assets/images/adaptive-icon.png" ] && [ -f "assets/images/splash.png" ]; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 6: Dependencies installed
echo -n "6) Dependencies installed... "
if [ -d "node_modules" ] && [ -d "server/node_modules" ]; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 7: TypeScript compiles
echo -n "7) Frontend + backend typecheck passes... "
if npm run typecheck >/dev/null 2>&1 && npx tsc --noEmit -p server/tsconfig.json >/dev/null 2>&1; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 8: Production API endpoint is configured
echo -n "8) Production API endpoint configured... "
if grep -qE '"EXPO_PUBLIC_API_URL": "https://api-production.*\.(up\.railway\.app|varsityhub\.(app|net))"' app.json || \
   ( [ -f ".env" ] && grep -qE "EXPO_PUBLIC_API_URL=https://api-production.*\.(up\.railway\.app|varsityhub\.(app|net))" .env ); then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 9: Release verification script passes
echo -n "9) Release verification script passes... "
if npm run verify:release >/dev/null 2>&1; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 10: iOS pod privacy manifests (warning-only in cloud/CI)
echo -n "10) iOS PrivacyInfo manifests found (if Pods are installed)... "
if [ -d "ios/Pods" ]; then
  PRIVACY_COUNT=$(find "ios/Pods" -name "PrivacyInfo.xcprivacy" | wc -l)
  if [ "$PRIVACY_COUNT" -gt 0 ]; then
    echo "✅ ($PRIVACY_COUNT found)"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi
else
  echo "⚠️  skipped (ios/Pods not present in this environment)"
  ((WARNINGS++))
fi

echo ""
echo "====================================="
echo "📊 Results: $PASSED passed, $FAILED failed, $WARNINGS warning(s)"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "🎉 ✅ APP IS READY FOR SUBMISSION!"
  echo ""
  echo "Next steps:"
  echo "  1. Run: npm run build:production"
  echo "  2. Submit: npm run submit:ios"
  exit 0
else
  echo "⚠️  Please fix $FAILED issue(s) before submission."
  exit 1
fi
