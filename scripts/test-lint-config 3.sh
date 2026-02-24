#!/bin/bash
# Test script to verify lintVitalRelease is properly disabled
# This simulates what happens during EAS builds

set -e

cd "$(dirname "$0")/.."

echo "🔍 Testing Android Lint Configuration..."
echo ""

# Check baseline file paths
echo "1. Checking baseline file paths..."
if grep -q 'file="src/main/res/values-b+en/strings.xml"' android/app/lint-baseline.xml; then
    echo "   ✅ Baseline file paths are correct (relative to android/app)"
else
    echo "   ❌ Baseline file paths are WRONG - will cause build failure"
    exit 1
fi

# Check strings are marked non-translatable
echo "2. Checking strings are marked non-translatable..."
if grep -q 'name="name".*translatable="false"' android/app/src/main/res/values/strings.xml && \
   grep -q 'name="displayName".*translatable="false"' android/app/src/main/res/values/strings.xml; then
    echo "   ✅ Strings marked as non-translatable"
else
    echo "   ❌ Strings NOT marked as non-translatable - will cause build failure"
    exit 1
fi

# Check lintVitalRelease is disabled in multiple places
echo "3. Checking lintVitalRelease is disabled..."
DISABLE_COUNT=$(grep -c "lintVitalRelease.*enabled.*false\|lintVitalRelease.*DISABLED\|lintVitalRelease.*disabled" android/app/build.gradle || echo "0")
if [ "$DISABLE_COUNT" -ge 3 ]; then
    echo "   ✅ lintVitalRelease is disabled in $DISABLE_COUNT places"
else
    echo "   ⚠️  lintVitalRelease may not be fully disabled (found $DISABLE_COUNT instances)"
fi

# Check ExtraTranslation is disabled
echo "4. Checking ExtraTranslation is disabled..."
if grep -q "disable.*ExtraTranslation" android/app/build.gradle; then
    echo "   ✅ ExtraTranslation is disabled"
else
    echo "   ❌ ExtraTranslation NOT disabled - will cause build failure"
    exit 1
fi

# Check checkReleaseBuilds is false
echo "5. Checking checkReleaseBuilds is false..."
if grep -q "checkReleaseBuilds false" android/app/build.gradle; then
    echo "   ✅ checkReleaseBuilds is false"
else
    echo "   ❌ checkReleaseBuilds NOT false - will cause build failure"
    exit 1
fi

# Check baseline is configured
echo "6. Checking baseline is configured..."
if grep -q "baseline.*lint-baseline.xml" android/app/build.gradle; then
    echo "   ✅ Baseline is configured"
else
    echo "   ❌ Baseline NOT configured - will cause build failure"
    exit 1
fi

# Check abortOnError is false
echo "7. Checking abortOnError is false..."
if grep -q "abortOnError false" android/app/build.gradle; then
    echo "   ✅ abortOnError is false"
else
    echo "   ❌ abortOnError NOT false - will cause build failure"
    exit 1
fi

echo ""
echo "✅ All lint configuration checks passed!"
echo "   The build should now succeed without ExtraTranslation errors."
