#!/bin/bash

set -u

# VarsityHub Pre-Submission Checklist
# Validates current iOS submission config without relying on stale bundle IDs
# or pod-project implementation details.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASSED=0
FAILED=0

pass() {
  echo "✅"
  ((PASSED++))
}

fail() {
  local message="${1:-}"
  if [ -n "$message" ]; then
    echo "❌ $message"
  else
    echo "❌"
  fi
  ((FAILED++))
}

optional_warn() {
  local message="${1:-optional check not satisfied}"
  echo "⚠️  $message"
}

read_json() {
  local script="$1"
  node -e "$script"
}

APP_JSON="$PROJECT_ROOT/app.json"
PACKAGE_JSON="$PROJECT_ROOT/package.json"
PBXPROJ="$PROJECT_ROOT/ios/VarsityHub.xcodeproj/project.pbxproj"
INFO_PLIST="$PROJECT_ROOT/ios/VarsityHub/Info.plist"
PRIVACY_MANIFEST="$PROJECT_ROOT/ios/VarsityHub/PrivacyInfo.xcprivacy"
BABEL_CONFIG="$PROJECT_ROOT/babel.config.js"

EXPO_VERSION=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.version || '')")
IOS_BUILD_NUMBER=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.ios?.buildNumber || '')")
BUNDLE_ID=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.ios?.bundleIdentifier || '')")
APPLE_TEAM_ID=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.ios?.appleTeamId || '')")
WEB_BASE_URL=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.extra?.EXPO_PUBLIC_WEB_BASE_URL || '')")
APP_PRIVACY_URL=$(read_json "const app=require('$APP_JSON'); console.log(app.expo?.extra?.APP_STORE_PRIVACY_POLICY_URL || app.expo?.ios?.infoPlist?.NSPrivacyPolicyURL || '')")
PACKAGE_VERSION=$(read_json "const pkg=require('$PACKAGE_JSON'); console.log(pkg.version || '')")

echo "🔍 VarsityHub Pre-Submission Checklist"
echo "====================================="
echo ""

echo -n "✓ Release build settings are readable... "
if xcodebuild -workspace "$PROJECT_ROOT/ios/VarsityHub.xcworkspace" -scheme VarsityHub -configuration Release -showBuildSettings >/dev/null 2>&1; then
  pass
else
  fail "(xcodebuild could not read Release settings)"
fi

echo -n "✓ Production build strips console.log statements... "
if grep -q "transform-remove-console" "$BABEL_CONFIG"; then
  pass
else
  fail "(babel production log stripping not configured)"
fi

echo -n "✓ App Store URLs are configured... "
if [ -n "$APP_PRIVACY_URL" ] && [ -n "$WEB_BASE_URL" ]; then
  pass
else
  fail "(missing privacy URL or web base URL)"
fi

echo -n "✓ Bundle identifier is aligned across Expo and Xcode... "
if [ -n "$BUNDLE_ID" ] && grep -q "PRODUCT_BUNDLE_IDENTIFIER = \"$BUNDLE_ID\";" "$PBXPROJ"; then
  pass
else
  fail "(Expo/Xcode bundle identifier mismatch)"
fi

echo -n "✓ Privacy manifest is present... "
if [ -f "$PRIVACY_MANIFEST" ] && grep -q "NSPrivacyAccessedAPITypes" "$PRIVACY_MANIFEST"; then
  pass
else
  fail "(missing ios/VarsityHub/PrivacyInfo.xcprivacy)"
fi

echo -n "✓ Code signing team is configured in Expo and Xcode... "
if [ -n "$APPLE_TEAM_ID" ] && grep -q "DEVELOPMENT_TEAM = $APPLE_TEAM_ID;" "$PBXPROJ"; then
  pass
else
  fail "(Expo/Xcode team ID mismatch)"
fi

echo -n "✓ Version and build number are configured... "
if [ -n "$EXPO_VERSION" ] && [ -n "$IOS_BUILD_NUMBER" ] && [ "$EXPO_VERSION" = "$PACKAGE_VERSION" ]; then
  pass
else
  fail "(missing or mismatched version/build number)"
fi

echo -n "✓ Apple Sign In capability is enabled... "
if grep -q "com.apple.developer.applesignin" "$PROJECT_ROOT/ios/VarsityHub/VarsityHub.entitlements" && grep -q "\"usesAppleSignIn\": true" "$APP_JSON"; then
  pass
else
  fail "(missing Apple Sign In capability)"
fi

echo -n "✓ iOS privacy purpose strings exist... "
if grep -q "NSCameraUsageDescription" "$INFO_PLIST" && \
   grep -q "NSPhotoLibraryUsageDescription" "$INFO_PLIST" && \
   grep -q "NSMicrophoneUsageDescription" "$INFO_PLIST" && \
   grep -q "NSLocationWhenInUseUsageDescription" "$INFO_PLIST"; then
  pass
else
  fail "(one or more iOS permission strings are missing)"
fi

echo -n "✓ ExportOptions.plist is configured... "
if [ -f "$PROJECT_ROOT/ios/ExportOptions.plist" ]; then
  pass
else
  optional_warn "not present (fine if you ship with EAS/Transporter instead of manual xcodebuild export)"
fi

echo ""
echo "====================================="
echo "📊 Results: $PASSED passed, $FAILED failed"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "✅ Submission config checks passed"
  exit 0
fi

echo "⚠️  Please fix $FAILED blocking issue(s) before submission"
exit 1
