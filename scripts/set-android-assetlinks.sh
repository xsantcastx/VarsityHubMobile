#!/usr/bin/env bash
#
# set-android-assetlinks.sh
# -------------------------
# Finalizes Android App Links (deep-link auto-verification) for the renamed
# package com.varsityhub.varsityhub.
#
# RUN THIS ONCE, AFTER your first upload to Play Console, when Play App Signing
# has generated your app-signing certificate.
#
#   1. Play Console -> your app -> Setup -> App integrity -> App signing
#   2. Copy the **SHA-256 certificate fingerprint** (colon-separated, uppercase,
#      e.g. AB:CD:12:...). Use the APP SIGNING key SHA-256, not the upload key.
#   3. From the repo root:  ./scripts/set-android-assetlinks.sh "AB:CD:12:..."
#   4. Redeploy the server + web so varsityhub.app/.well-known/assetlinks.json updates.
#
# It updates every real assetlinks source (skips dist/ build output and
# .claude/worktrees/), the server fallback in well-known.ts, and its test.
set -euo pipefail

PKG="com.varsityhub.varsityhub"
SHA="${1:-}"

if [ -z "$SHA" ]; then
  echo "ERROR: pass the Play App Signing SHA-256 as the first argument."
  echo "Usage: ./scripts/set-android-assetlinks.sh \"AB:CD:12:34:...\""
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Canonical, pretty-printed assetlinks payload.
read -r -d '' PAYLOAD <<JSON || true
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "${PKG}",
      "sha256_cert_fingerprints": [
        "${SHA}"
      ]
    }
  }
]
JSON

# Real source locations only (NOT dist/, NOT .claude/worktrees/).
FILES=(
  "public/.well-known/assetlinks.json"
  "docs/well-known/assetlinks.json"
  "server/well-known/assetlinks.json"
  "server/well-known/well-known/assetlinks.json"
)

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    printf '%s\n' "$PAYLOAD" > "$f"
    echo "updated $f"
  else
    echo "skip (missing) $f"
  fi
done

# Server dynamic fallback (well-known.ts) + its test assertion.
node - "$PKG" "$SHA" <<'NODE'
const fs = require('fs');
const [, , pkg, sha] = process.argv;

const wk = 'server/src/routes/well-known.ts';
let s = fs.readFileSync(wk, 'utf8');
s = s.replace(/package_name: '[^']*'/, `package_name: '${pkg}'`);
s = s.replace(/sha256_cert_fingerprints: \[\s*'[^']*',?\s*\]/,
  `sha256_cert_fingerprints: [\n        '${sha}',\n      ]`);
fs.writeFileSync(wk, s);
console.log('updated ' + wk);

const test = 'server/src/__tests__/well-known.test.ts';
let t = fs.readFileSync(test, 'utf8');
t = t.replace(/package_name\)\.toBe\('[^']*'\)/, `package_name).toBe('${pkg}')`);
fs.writeFileSync(test, t);
console.log('updated ' + test);
NODE

echo ""
echo "Done. Next:"
echo "  1. cd server && npm test -- --testPathPattern=well-known   # should pass"
echo "  2. Commit + push (Railway auto-deploys the server assetlinks)."
echo "  3. Redeploy the web/static host so /.well-known/assetlinks.json is live."
echo "  4. Verify: curl -s https://varsityhub.app/.well-known/assetlinks.json"
