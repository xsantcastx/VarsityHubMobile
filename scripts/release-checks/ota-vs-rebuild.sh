#!/usr/bin/env bash
#
# Decide: does the next release need a new native build, or is an OTA
# update sufficient?
#
# Compares HEAD against a reference commit (the SHA the currently-deployed
# store build was cut from) and flags any change that touches native code,
# plugins, native-relevant app.json fields, or runtimeVersion.
#
# If anything here changed → you need a new build (and a runtimeVersion bump
# if the native-linked modules changed their ABI).
# If nothing here changed → `eas update` against the production channel is
# enough.
#
# Usage:
#   BASE_SHA=<commit that produced the current store build> \
#   bash scripts/release-checks/ota-vs-rebuild.sh
#
# Find BASE_SHA via: eas build:list --limit 5 (look for the gitCommitHash
# column on the latest finished production build).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

BASE_SHA="${BASE_SHA:-}"
if [[ -z "$BASE_SHA" ]]; then
  echo "✗ BASE_SHA required. Find via: eas build:list --limit 5" >&2
  echo "  Then:  BASE_SHA=<sha> bash scripts/release-checks/ota-vs-rebuild.sh" >&2
  exit 1
fi

if ! git rev-parse --verify "${BASE_SHA}^{commit}" >/dev/null 2>&1; then
  echo "✗ BASE_SHA ${BASE_SHA} is not a commit in this repo." >&2
  echo "  git fetch --all and try again, or confirm the SHA." >&2
  exit 1
fi

HEAD_SHA=$(git rev-parse HEAD)
echo "→ Comparing ${BASE_SHA:0:10} (current store build) → ${HEAD_SHA:0:10} (HEAD)"
echo

NATIVE_PATTERNS=(
  'plugins/'
  'ios/'
  'android/'
  'package.json'
  'package-lock.json'
  'app.json'
  'app.config.js'
  'app.config.ts'
  'eas.json'
)

NEEDS_BUILD=false
CHANGED=()

for path in "${NATIVE_PATTERNS[@]}"; do
  diff_output=$(git diff --name-only "${BASE_SHA}" HEAD -- "${path}" 2>/dev/null || true)
  if [[ -n "${diff_output}" ]]; then
    while IFS= read -r line; do CHANGED+=("${line}"); done <<< "${diff_output}"
    NEEDS_BUILD=true
  fi
done

# runtimeVersion is extra-load-bearing: if it bumped, old builds can't even
# receive OTA updates.
OLD_RV=$(git show "${BASE_SHA}:app.json" 2>/dev/null | node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).expo.runtimeVersion' 2>/dev/null || echo "?")
NEW_RV=$(node -p 'require("./app.json").expo.runtimeVersion' 2>/dev/null || echo "?")
echo "runtimeVersion: ${OLD_RV} → ${NEW_RV}"
if [[ "${OLD_RV}" != "${NEW_RV}" ]]; then
  echo "  → runtimeVersion BUMPED — old installs cannot OTA; new store build required."
  NEEDS_BUILD=true
fi
echo

if "${NEEDS_BUILD}"; then
  printf '\033[31mVERDICT: New native build required.\033[0m\n'
  echo
  echo "Native-relevant files changed:"
  printf '  %s\n' "${CHANGED[@]}" | sort -u
  echo
  echo "Next step: eas build --platform all --profile production"
  exit 2
fi

printf '\033[32mVERDICT: OTA update is sufficient.\033[0m\n'
echo "No native-relevant changes since ${BASE_SHA:0:10}."
echo
echo "Ship with:"
echo "  eas update --branch production --platform all --message \"<summary>\""
echo
echo "After the update, run:  bash scripts/release-checks/ota-check.sh"
echo "to confirm both platforms now show the new manifest id."
