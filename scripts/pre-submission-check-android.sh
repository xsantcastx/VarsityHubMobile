#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
GRADLEW="$ANDROID_DIR/gradlew"
PASSED=0
FAILED=0

source "$PROJECT_ROOT/scripts/android-java-env.sh"
ensure_android_java 17

echo "🔍 VarsityHub Android Pre-Submission Checklist"
echo "============================================="
echo ""

if [ ! -f "$GRADLEW" ]; then
  echo "❌ gradlew not found in $ANDROID_DIR. Run expo prebuild first."
  exit 1
fi

chmod +x "$GRADLEW"

pushd "$ANDROID_DIR" >/dev/null

echo -n "1) Gradle can configure bundleRelease… "
if ./gradlew bundleRelease -m >/dev/null 2>&1; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

popd >/dev/null

KEYSTORE_PROPERTIES_FILE="$ANDROID_DIR/keystore.properties"
STORE_FILE=""
KEY_ALIAS=""

if [ -f "$KEYSTORE_PROPERTIES_FILE" ]; then
  STORE_FILE=$(grep '^storeFile=' "$KEYSTORE_PROPERTIES_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2-)
  KEY_ALIAS=$(grep '^keyAlias=' "$KEYSTORE_PROPERTIES_FILE" 2>/dev/null | tail -1 | cut -d'=' -f2-)
elif [ -n "${ANDROID_KEYSTORE_PATH:-}" ]; then
  STORE_FILE="${ANDROID_KEYSTORE_PATH:-}"
  KEY_ALIAS="${ANDROID_KEY_ALIAS:-}"
fi

STORE_FILE="${STORE_FILE//$'\r'/}"
STORE_FILE="${STORE_FILE//[$'\t ']/}"
KEY_ALIAS="${KEY_ALIAS//$'\r'/}"
KEY_ALIAS="${KEY_ALIAS//[$'\t ']/}"

echo -n "2) Release signing source configured… "
if [ -f "$KEYSTORE_PROPERTIES_FILE" ] && [ -n "$STORE_FILE" ] && [ -n "$KEY_ALIAS" ]; then
  echo "✅ (android/keystore.properties)"
  ((PASSED++))
elif [ -n "${ANDROID_KEYSTORE_PATH:-}" ] && [ -n "${ANDROID_KEY_ALIAS:-}" ] && [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] && [ -n "${ANDROID_KEY_PASSWORD:-}" ]; then
  echo "✅ (ANDROID_KEYSTORE_* env vars)"
  ((PASSED++))
else
  echo "❌ (configure android/keystore.properties or ANDROID_KEYSTORE_* env vars)"
  ((FAILED++))
fi

echo -n "3) Keystore file exists… "
if [ -n "$STORE_FILE" ]; then
  if [ -f "$STORE_FILE" ]; then
    echo "✅ ($STORE_FILE)"
    ((PASSED++))
  elif [ -f "$ANDROID_DIR/$STORE_FILE" ]; then
    echo "✅ ($ANDROID_DIR/$STORE_FILE)"
    ((PASSED++))
  elif [ -f "$ANDROID_DIR/app/$STORE_FILE" ]; then
    echo "✅ ($ANDROID_DIR/app/$STORE_FILE)"
    ((PASSED++))
  else
    echo "❌ ($STORE_FILE not found)"
    ((FAILED++))
  fi
else
  echo "⚠️  (storeFile not defined locally; EAS remote credentials may still be used for store builds)"
  ((FAILED++))
fi

APP_PACKAGE=$(node -e "
  const path = require('path');
  const appJson = require(path.join(process.argv[1], 'app.json'));
  process.stdout.write(appJson.expo.android.package);
" "$PROJECT_ROOT")

echo -n "4) applicationId matches app.json package ($APP_PACKAGE)… "
if grep -q "applicationId '$APP_PACKAGE'" "$ANDROID_DIR/app/build.gradle"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

VERSION_CODE=$(grep "versionCode" "$ANDROID_DIR/app/build.gradle" | head -1 | awk '{print $2}')
echo -n "5) versionCode is > 0 (current: $VERSION_CODE)… "
if [ "${VERSION_CODE:-0}" -gt 0 ] 2>/dev/null; then
  echo "✅"
  ((PASSED++))
else
  echo "❌"
  ((FAILED++))
fi

echo -n "6) Play submit service account can access Android Publisher… "
if [ -f "$PROJECT_ROOT/service-account-key.json" ]; then
  if node "$PROJECT_ROOT/scripts/verify-play-service-account.js" >/dev/null 2>&1; then
    echo "✅"
    ((PASSED++))
  else
    echo "❌"
    ((FAILED++))
  fi
else
  echo "⚠️  (service-account-key.json not present; manual Play upload is still possible)"
fi

echo ""
echo "============================================="
echo "📊 Results: $PASSED passed, $FAILED failed"
echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "🎉 Android build is ready for release!"
  echo "Next: run ./scripts/build-release-android.sh to generate the AAB."
  exit 0
else
  echo "⚠️  Resolve the failing checks above before uploading to Google Play."
  exit 1
fi
