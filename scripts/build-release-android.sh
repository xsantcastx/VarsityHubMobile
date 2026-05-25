#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
GRADLEW="$ANDROID_DIR/gradlew"
BUNDLE_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
KEYSTORE_PROPERTIES_FILE="$ANDROID_DIR/keystore.properties"

source "$PROJECT_ROOT/scripts/android-java-env.sh"
ensure_android_java 17

echo "🤖 VarsityHub Android Release Builder"
echo "====================================="
echo ""

if [ ! -f "$GRADLEW" ]; then
  echo "❌ Cannot find gradlew in $ANDROID_DIR. Did you run expo prebuild?"
  exit 1
fi

chmod +x "$GRADLEW"

echo "📦 Project root: $PROJECT_ROOT"
echo "📁 Android dir : $ANDROID_DIR"
echo "☕ Java home   : ${JAVA_HOME:-$(command -v java)}"
echo ""

if [ -f "$KEYSTORE_PROPERTIES_FILE" ]; then
  echo "✅ Release signing will use android/keystore.properties"
elif [ -n "${ANDROID_KEYSTORE_PATH:-}" ] && [ -n "${ANDROID_KEY_ALIAS:-}" ] && [ -n "${ANDROID_KEYSTORE_PASSWORD:-}" ] && [ -n "${ANDROID_KEY_PASSWORD:-}" ]; then
  echo "✅ Release signing will use ANDROID_KEYSTORE_* env vars"
else
  echo "⚠️  Release signing is not configured for a local Play Store upload."
  echo "    The local Gradle build will fall back to the debug keystore."
  echo "    Configure android/keystore.properties or export ANDROID_KEYSTORE_* env vars."
  echo ""
fi

pushd "$ANDROID_DIR" >/dev/null

echo "🧹 Cleaning previous build artifacts..."
./gradlew clean >/dev/null

echo "📦 Bundling JavaScript via Gradle (bundleRelease)..."
./gradlew bundleRelease --warning-mode all

echo ""
echo "📱 Assembling APK (assembleRelease)..."
./gradlew assembleRelease --warning-mode all

popd >/dev/null

echo ""
if [ -f "$BUNDLE_PATH" ]; then
  echo "✅ AAB ready: $BUNDLE_PATH"
else
  echo "❌ AAB not found at $BUNDLE_PATH"
fi

if [ -f "$APK_PATH" ]; then
  echo "✅ APK ready: $APK_PATH"
else
  echo "⚠️  APK not found at $APK_PATH"
fi

echo ""
echo "Next steps:"
echo "  1. Run ./scripts/pre-submission-check-android.sh"
echo "  2. Upload the AAB to Google Play Console (Internal Testing → Production)"
echo "  3. Attach release notes & roll out"
