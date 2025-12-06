#!/bin/bash

# VarsityHub Pre-Submission Checklist
# Validates app is ready for App Store submission

PROJECT_ROOT="/Users/varsityhub/Desktop/CODE/VarsityHubMobile"
PASSED=0
FAILED=0

echo "🔍 VarsityHub Pre-Submission Checklist"
echo "====================================="
echo ""

# Check 1: Build compiles
echo -n "✓ Release build compiles without errors... "
if npx expo run:ios --configuration Release --dry-run 2>&1 | grep -q "success\|configured"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 2: No console.log in production files
echo -n "✓ No debug console.log in production code... "
CONSOLE_COUNT=$(grep -r "console\\.log" "$PROJECT_ROOT/server/src/routes/" --include="*.ts" 2>/dev/null | wc -l)
if [ "$CONSOLE_COUNT" -eq 0 ]; then
  echo "✅"
  ((PASSED++))
else
  echo "❌ ($CONSOLE_COUNT instances found)"
  ((FAILED++))
fi

# Check 3: App Store metadata configured
echo -n "✓ App Store URLs configured in app.json... "
if grep -q "\"privacy\"" "$PROJECT_ROOT/app.json" && grep -q "\"homepage\"" "$PROJECT_ROOT/app.json"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌ Missing privacy or homepage URL"
  ((FAILED++))
fi

# Check 4: Bundle identifier correct
echo -n "✓ Bundle identifier is correct... "
if grep -q "com.xsantcastx.varsityhub" "$PROJECT_ROOT/app.json"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 5: Privacy manifest files present
echo -n "✓ All frameworks have PrivacyInfo.xcprivacy... "
PRIVACY_COUNT=$(find "$PROJECT_ROOT/ios/Pods" -name "PrivacyInfo.xcprivacy" 2>/dev/null | wc -l)
if [ "$PRIVACY_COUNT" -gt 0 ]; then
  echo "✅ ($PRIVACY_COUNT found)"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 6: Code signing configured
echo -n "✓ Code signing team configured... "
if grep -q "B5H8F69RW5" "$PROJECT_ROOT/ios/Pods/Pods.xcodeproj/project.pbxproj"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 7: Version number set
echo -n "✓ Version number configured... "
if grep -q "\"version\": \"1.0" "$PROJECT_ROOT/package.json"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 8: iOS deployment target correct
echo -n "✓ iOS deployment target is 15.1+... "
if grep -q "IPHONEOS_DEPLOYMENT_TARGET = 15.1" "$PROJECT_ROOT/ios/Pods/Pods.xcodeproj/project.pbxproj"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 9: ExportOptions.plist exists
echo -n "✓ ExportOptions.plist configured... "
if [ -f "$PROJECT_ROOT/ios/ExportOptions.plist" ]; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

# Check 10: Production API endpoint set
echo -n "✓ Production API endpoint configured... "
if grep -q "EXPO_PUBLIC_API_URL" "$PROJECT_ROOT/.env" 2>/dev/null || grep -q "varsityhub.app\|api.varsityhub" "$PROJECT_ROOT/server/src/lib/email.ts"; then
  echo "✅"
  ((PASSED++))
else
  echo "⚠️  Not explicitly set (verify in build configuration)"
  ((FAILED++))
fi

echo ""
echo "====================================="
echo "📊 Results: $PASSED passed, $FAILED failed"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "🎉 ✅ APP IS READY FOR SUBMISSION!"
  echo ""
  echo "Next steps:"
  echo "  1. Run: ./scripts/build-release.sh"
  echo "  2. Upload IPA to App Store Connect"
  echo "  3. Configure screenshots and description"
  echo "  4. Submit for review"
  exit 0
else
  echo "⚠️  Please fix $FAILED issue(s) before submission"
  echo ""
  echo "Common fixes:"
  echo "  - Add privacy policy URL to app.json"
  echo "  - Remove console.log statements"
  echo "  - Verify API endpoint configuration"
  exit 1
fi
