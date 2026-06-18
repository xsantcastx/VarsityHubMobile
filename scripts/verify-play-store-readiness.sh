#!/bin/bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_ROOT/android"
MANIFEST_PATH="$ANDROID_DIR/app/src/main/AndroidManifest.xml"
ASSET_LINKS_PATH="$PROJECT_ROOT/docs/well-known/assetlinks.json"

source "$PROJECT_ROOT/scripts/android-java-env.sh"

PASSED=0
FAILED=0
WARNED=0

pass() {
  echo "✅ $1"
  PASSED=$((PASSED + 1))
}

fail() {
  echo "❌ $1"
  FAILED=$((FAILED + 1))
}

warn() {
  echo "⚠️  $1"
  WARNED=$((WARNED + 1))
}

echo "📦 VarsityHub Play Store Readiness"
echo "================================="
echo ""

ensure_android_java 17 >/dev/null
pass "Android checks use JDK 17"

if node - <<'NODE' "$PROJECT_ROOT"
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const eas = JSON.parse(fs.readFileSync(path.join(root, 'eas.json'), 'utf8'));
const profile = eas?.build?.production?.android ?? {};
if (
  eas?.build?.production?.distribution === 'store' &&
  profile.buildType === 'app-bundle' &&
  profile.credentialsSource === 'remote'
) {
  process.exit(0);
}
process.exit(1);
NODE
then
  pass "Production EAS Android profile uses store AAB with remote credentials"
else
  fail "Production EAS Android profile must use distribution=store, buildType=app-bundle, credentialsSource=remote"
fi

if [ -f "$PROJECT_ROOT/service-account-key.json" ]; then
  pass "Play submit service account key is present"
else
  fail "service-account-key.json is missing for Play submission"
fi

if node "$PROJECT_ROOT/scripts/verify-play-service-account.js" >/dev/null; then
  pass "Play service account has Android Publisher access for com.xsantcastx.varsityhub"
else
  fail "Play service account cannot access Android Publisher for com.xsantcastx.varsityhub"
fi

if node - <<'NODE' "$PROJECT_ROOT" "$MANIFEST_PATH" "$ASSET_LINKS_PATH"
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const manifestPath = process.argv[3];
const assetLinksPath = process.argv[4];
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const pkg = appJson.expo.android.package;
const buildGradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const manifest = fs.readFileSync(manifestPath, 'utf8');
const assetLinks = JSON.parse(fs.readFileSync(assetLinksPath, 'utf8'));
const assetTarget = assetLinks[0]?.target ?? {};
const ok =
  buildGradle.includes(`applicationId '${pkg}'`) &&
  buildGradle.includes(`namespace '${pkg}'`) &&
  assetTarget.package_name === pkg &&
  manifest.includes('android:scheme="varsityhubmobile"');
process.exit(ok ? 0 : 1);
NODE
then
  pass "Android package name is consistent across app config, Gradle, asset links, and deep links"
else
  fail "Android package or deep link config is inconsistent"
fi

if grep -q 'android:usesCleartextTraffic="false"' "$MANIFEST_PATH"; then
  pass "Release manifest explicitly disables cleartext traffic"
else
  fail "Release manifest should set android:usesCleartextTraffic=\"false\""
fi

ALLOWED_PERMISSIONS=(
  "android.permission.ACCESS_COARSE_LOCATION"
  "android.permission.ACCESS_FINE_LOCATION"
  "android.permission.CAMERA"
  "android.permission.INTERNET"
  "android.permission.MODIFY_AUDIO_SETTINGS"
  "android.permission.POST_NOTIFICATIONS"
  "android.permission.READ_MEDIA_IMAGES"
  "android.permission.READ_MEDIA_VIDEO"
  "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
  "android.permission.RECORD_AUDIO"
  "android.permission.VIBRATE"
  "com.android.vending.BILLING"
)

MANIFEST_PERMISSIONS=()
while IFS= read -r permission; do
  MANIFEST_PERMISSIONS+=("$permission")
done < <(python3 - <<'PY' "$MANIFEST_PATH"
import re
import sys

manifest = open(sys.argv[1], 'r', encoding='utf-8').read()
permissions = set()
for match in re.finditer(r'<uses-permission\b([^>]+)>', manifest):
    attrs = match.group(1)
    if 'tools:node="remove"' in attrs:
        continue
    name_match = re.search(r'android:name="([^"]+)"', attrs)
    if name_match:
        permissions.add(name_match.group(1))
for permission in sorted(permissions):
    print(permission)
PY
)
UNEXPECTED_PERMISSIONS=()
for permission in "${MANIFEST_PERMISSIONS[@]}"; do
  is_allowed=0
  for allowed in "${ALLOWED_PERMISSIONS[@]}"; do
    if [ "$permission" = "$allowed" ]; then
      is_allowed=1
      break
    fi
  done
  if [ $is_allowed -eq 0 ]; then
    UNEXPECTED_PERMISSIONS+=("$permission")
  fi
done

if [ ${#UNEXPECTED_PERMISSIONS[@]} -eq 0 ]; then
  pass "Android manifest permissions are limited to the reviewed allowlist"
else
  fail "Unexpected Android manifest permissions: ${UNEXPECTED_PERMISSIONS[*]}"
fi

FORBIDDEN_PERMISSIONS=(
  "android.permission.ACCESS_BACKGROUND_LOCATION"
  "android.permission.MANAGE_EXTERNAL_STORAGE"
  "android.permission.QUERY_ALL_PACKAGES"
  "android.permission.REQUEST_INSTALL_PACKAGES"
  "android.permission.READ_EXTERNAL_STORAGE"
  "android.permission.WRITE_EXTERNAL_STORAGE"
  "android.permission.READ_MEDIA_AUDIO"
  "android.permission.SYSTEM_ALERT_WINDOW"
)

FORBIDDEN_FOUND=()
for permission in "${FORBIDDEN_PERMISSIONS[@]}"; do
  if python3 - <<'PY' "$MANIFEST_PATH" "$permission"
import re
import sys

manifest = open(sys.argv[1], 'r', encoding='utf-8').read()
permission = sys.argv[2]
found = False
for match in re.finditer(r'<uses-permission\b([^>]+)>', manifest):
    attrs = match.group(1)
    if 'tools:node="remove"' in attrs:
        continue
    if f'android:name="{permission}"' in attrs:
        found = True
        break
sys.exit(0 if found else 1)
PY
  then
    FORBIDDEN_FOUND+=("$permission")
  fi
done

if [ ${#FORBIDDEN_FOUND[@]} -eq 0 ]; then
  pass "Play-sensitive legacy and high-risk permissions are absent from the release manifest"
else
  fail "Release manifest still references restricted permissions: ${FORBIDDEN_FOUND[*]}"
fi

if rg -q "/privacy-policy" server/src/routes/publicSite.ts &&
   rg -q "/terms" server/src/routes/publicSite.ts &&
   rg -q "/support" server/src/routes/publicSite.ts &&
   rg -q "/account-deletion" server/src/routes/publicSite.ts; then
  pass "Public privacy, terms, support, and account-deletion routes exist"
else
  fail "Public legal/support/account-deletion routes are incomplete"
fi

if rg -q "Delete Account" app/settings/index.tsx &&
   rg -q "delete\\('/users/me'|delete\\('/me'" server/src/routes/users.ts server/src/routes/auth.ts; then
  pass "In-app account deletion UI and server deletion endpoint both exist"
else
  fail "Account deletion flow is incomplete"
fi

if rg -q "Uses Google Play Billing" app/subscription-paywall.tsx &&
   rg -q "iapPurchase\\(selectedTier" app/subscription-paywall.tsx &&
   rg -q "Android / non-iOS: use Stripe PaymentSheet" app/ad-calendar.tsx &&
   rg -q "if \\(Platform\\.OS === 'ios'\\)" app/ad-calendar.tsx; then
  pass "Subscription and ad billing paths match Play policy expectations"
else
  fail "Billing flow invariants for Play policy are missing or have drifted"
fi

# The local Gradle dry-run needs the Android SDK. EAS cloud builds always have it,
# so a missing LOCAL SDK is not a release blocker — warn (skip) instead of failing,
# and only run the real check when an SDK is actually configured.
ANDROID_SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$ANDROID_SDK_DIR" ] && [ -f "$PROJECT_ROOT/android/local.properties" ]; then
  ANDROID_SDK_DIR="$(grep -E '^sdk.dir=' "$PROJECT_ROOT/android/local.properties" | cut -d= -f2- || true)"
fi
if [ -z "$ANDROID_SDK_DIR" ] || [ ! -d "$ANDROID_SDK_DIR" ]; then
  warn "Skipping local bundleRelease Gradle dry-run — no Android SDK locally (set ANDROID_HOME to enable). EAS cloud builds provide the SDK; not a release blocker."
elif bash -lc 'cd "'"$PROJECT_ROOT"'" && export JAVA_HOME=$(/usr/libexec/java_home -v 17) && export PATH="$JAVA_HOME/bin:$PATH" && ./android/gradlew -p android bundleRelease -m >/dev/null'; then
  pass "Gradle can configure bundleRelease for Play upload"
else
  fail "bundleRelease Gradle dry-run failed"
fi

if npm --prefix "$PROJECT_ROOT/server" test -- --runInBand src/__tests__/public-site-routes.test.ts src/__tests__/iap-config-invariants.test.ts >/dev/null; then
  pass "Server invariants covering public routes and IAP policy checks pass"
else
  fail "Server public-route or IAP invariant tests failed"
fi

echo ""
echo "================================="
echo "Results: $PASSED passed, $FAILED failed, $WARNED warnings"

if [ $FAILED -eq 0 ]; then
  echo "Play Store repo checks passed."
else
  echo "Play Store repo checks failed."
  exit 1
fi
