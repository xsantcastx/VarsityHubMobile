#!/usr/bin/env bash
#
# Pre-flight gate before `eas update` or `eas build`.
#
# Runs the cheap checks that cost seconds here and minutes (or worse: a bad
# release) if you skip them. Exits non-zero on any failure so you can chain:
#
#   bash scripts/release-checks/preflight-ship.sh && \
#     eas update --branch production --platform all --message "…"
#
# Or for a build:
#
#   bash scripts/release-checks/preflight-ship.sh && \
#     eas build --platform ios --profile production
#
# None of the checks touch production or ship anything — they're all local
# reads + typecheck + audit + OTA reachability.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

FAILS=()
pass() { printf '\033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$1"; FAILS+=("$1"); }
hr()   { printf '\n── %s\n' "$1"; }

hr "Git tree cleanliness"
if [[ -z "$(git status --porcelain)" ]]; then
  pass "tree clean"
else
  DIRTY_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
  fail "tree dirty (${DIRTY_COUNT} files) — commit or stash before shipping"
  git status --short | head -10
fi

hr "Git HEAD is on a named ref (branch or tag)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "${BRANCH}" == "HEAD" ]]; then
  fail "detached HEAD — check out a branch or tag before shipping"
else
  pass "on ${BRANCH} (HEAD=$(git rev-parse --short HEAD))"
fi

hr "App typecheck"
if npx tsc --noEmit >/tmp/preflight-tsc-app.log 2>&1; then
  pass "app typecheck clean"
else
  fail "app typecheck failed — see /tmp/preflight-tsc-app.log"
  tail -20 /tmp/preflight-tsc-app.log
fi

hr "Server typecheck"
if (cd server && npx tsc --noEmit) >/tmp/preflight-tsc-server.log 2>&1; then
  pass "server typecheck clean"
else
  fail "server typecheck failed — see /tmp/preflight-tsc-server.log"
  tail -20 /tmp/preflight-tsc-server.log
fi

hr "npm audit (high+)"
if npm audit --audit-level=high --production >/dev/null 2>&1; then
  pass "root: no high/critical vulnerabilities in prod deps"
else
  fail "root: high/critical vulns present — review \`npm audit\`"
fi
if (cd server && npm audit --audit-level=high --omit=dev) >/dev/null 2>&1; then
  pass "server: no high/critical vulnerabilities in prod deps"
else
  fail "server: high/critical vulns present"
fi

hr "app.json sanity"
VERSION=$(node -p 'require("./app.json").expo.version' 2>/dev/null || echo "?")
RUNTIME_VERSION=$(node -p 'require("./app.json").expo.runtimeVersion' 2>/dev/null || echo "?")
UPDATE_URL=$(node -p 'require("./app.json").expo.updates?.url||""' 2>/dev/null || echo "")
if [[ "${VERSION}" != "?" && "${RUNTIME_VERSION}" != "?" && -n "${UPDATE_URL}" ]]; then
  pass "version=${VERSION}  runtimeVersion=${RUNTIME_VERSION}"
else
  fail "app.json missing version / runtimeVersion / updates.url"
fi

hr "app.config.js env-driven secrets"
# Validate that the runtime env check passes for the current shell. If it
# throws, a build with these env vars would too.
CFG_OUT=$(node -e '
  try {
    const m = require("./app.config.js");
    const fn = typeof m === "function" ? m : m.default;
    fn({config:{}});
    console.log("OK");
  } catch (e) {
    console.error("FAIL:", e.message);
    process.exit(2);
  }
' 2>&1) || true
if [[ "${CFG_OUT}" == "OK" ]]; then
  pass "app.config.js evaluates with current env"
else
  # An EAS build supplies env; running locally without it may throw the
  # production guard. That's expected and NOT a preflight failure — just
  # record it for visibility.
  printf '\033[33m!\033[0m app.config.js guard fired with current env:\n  %s\n' "${CFG_OUT}"
  echo "  (This is fine locally; the build env on EAS must supply GOOGLE_MAPS_API_KEY and EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.)"
fi

hr "OTA pipeline reachable"
if bash "${REPO_ROOT}/scripts/release-checks/ota-check.sh" >/tmp/preflight-ota.log 2>&1; then
  pass "Expo update endpoint responds with valid manifests for ios + android"
else
  fail "OTA check failed — see /tmp/preflight-ota.log"
  tail -15 /tmp/preflight-ota.log
fi

hr "Summary"
if [[ ${#FAILS[@]} -eq 0 ]]; then
  printf '\033[32mPre-flight PASSED.\033[0m  Safe to ship.\n'
  echo
  echo "Suggested next commands:"
  echo
  echo "  # 1. OTA fix to both platforms (JS-only changes):"
  echo "  eas update --branch production --platform all --message \"<summary>\""
  echo
  echo "  # 2. Verify the manifests flipped forward:"
  echo "  bash scripts/release-checks/ota-check.sh"
  echo
  echo "  # 3. New native build (only if OTA isn't enough — see ota-vs-rebuild.sh):"
  echo "  eas build --platform ios --profile production"
  echo
  exit 0
fi

printf '\033[31mPre-flight FAILED.\033[0m  Do NOT ship.\n'
for f in "${FAILS[@]}"; do printf '  - %s\n' "$f"; done
exit 1
