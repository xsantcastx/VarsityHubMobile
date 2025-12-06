#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
GRADLEW="$ANDROID_DIR/gradlew"
PASSED=0
FAILED=0

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

echo -n "2) Release keystore variables present… "
if grep -q "MYAPP_UPLOAD_STORE_FILE" "$ANDROID_DIR/gradle.properties" && \
   grep -q "MYAPP_UPLOAD_KEY_ALIAS" "$ANDROID_DIR/gradle.properties"; then
  echo "✅"
  ((PASSED++))
else
  echo "❌ (configure values in android/gradle.properties)"
  ((FAILED++))
fi

STORE_FILE=$(grep '^MYAPP_UPLOAD_STORE_FILE=' "$ANDROID_DIR/gradle.properties" 2>/dev/null | tail -1 | cut -d'=' -f2-)
STORE_FILE="${STORE_FILE//$'\r'/}"
STORE_FILE="${STORE_FILE//[$'\t ']/}"

echo -n "3) Keystore file exists… "
if [ -n "$STORE_FILE" ]; then
  if [ -f "$STORE_FILE" ]; then
    echo "✅ ($STORE_FILE)"
    ((PASSED++))
  elif [ -f "$ANDROID_DIR/app/$STORE_FILE" ]; then
    echo "✅ ($ANDROID_DIR/app/$STORE_FILE)"
    ((PASSED++))
  else
    echo "❌ ($STORE_FILE not found)"
    ((FAILED++))
  fi
else
  echo "⚠️  (STORE_FILE not defined)"
  ((FAILED++))
fi

APP_PACKAGE=$(python3 - <<'PY'
import json, pathlib, sys
root = pathlib.Path(__file__).resolve().parents[1]
data = json.loads((root / "app.json").read_text())
print(data["expo"]["android"]["package"])
PY
)

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
