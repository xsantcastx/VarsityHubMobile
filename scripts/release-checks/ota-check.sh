#!/usr/bin/env bash
#
# OTA update manifest sanity check.
#
# Hits the Expo update URL with the protocol headers a real device would send
# and confirms the response is a well-formed manifest (200 + JSON) or a
# "no-update-available" 204. Anything else — 404, 5xx, unexpected body —
# means the OTA pipeline is broken and any `eas update` you push won't reach
# users.
#
# This does NOT publish an update. It only proves the endpoint exists,
# responds, and is shaped the way the device expects.
#
# Usage:
#   bash scripts/release-checks/ota-check.sh
#
# Optional env:
#   RUNTIME_VERSION — override (defaults to app.json runtimeVersion)
#   CHANNEL         — override (defaults to "production")
#   UPDATE_URL      — override (defaults to app.json updates.url)

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
APP_JSON="${REPO_ROOT}/app.json"

if [[ ! -f "${APP_JSON}" ]]; then
  echo "✗ app.json not found at ${APP_JSON}" >&2
  exit 1
fi

RUNTIME_VERSION="${RUNTIME_VERSION:-$(node -p 'require("'"${APP_JSON}"'").expo.runtimeVersion')}"
UPDATE_URL="${UPDATE_URL:-$(node -p 'require("'"${APP_JSON}"'").expo.updates?.url||""')}"
CHANNEL="${CHANNEL:-production}"

if [[ -z "${UPDATE_URL}" || "${UPDATE_URL}" == "undefined" ]]; then
  echo "✗ expo.updates.url is empty in app.json" >&2
  exit 1
fi
if [[ -z "${RUNTIME_VERSION}" || "${RUNTIME_VERSION}" == "undefined" ]]; then
  echo "✗ expo.runtimeVersion is empty in app.json" >&2
  exit 1
fi

echo "→ Update URL:       ${UPDATE_URL}"
echo "→ Runtime version:  ${RUNTIME_VERSION}"
echo "→ Channel:          ${CHANNEL}"
echo

fail() { printf '\033[31m✗\033[0m %s\n' "$1"; EXIT_CODE=1; }
pass() { printf '\033[32m✓\033[0m %s\n' "$1"; }
EXIT_CODE=0

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Query for both platforms. An update rollout typically targets both.
for PLATFORM in ios android; do
  echo "[${PLATFORM}] GET ${UPDATE_URL}"
  # EAS Update requires `multipart/mixed` Accept; older `application/json`
  # clients get 406. The real SDK sends multipart. We accept both and treat
  # the 200 body as valid if it carries a manifest `id` + `createdAt`
  # anywhere in the (potentially multipart) payload.
  HTTP_CODE=$(curl -sS -o "$TMP" -w '%{http_code}' --max-time 15 \
    -H "Accept: multipart/mixed,application/expo+json,application/json" \
    -H "Expo-Platform: ${PLATFORM}" \
    -H "Expo-Runtime-Version: ${RUNTIME_VERSION}" \
    -H "Expo-Channel-Name: ${CHANNEL}" \
    -H "Expo-Protocol-Version: 1" \
    -H "Expo-API-Version: 1" \
    -H "Expo-Expect-Signature: true" \
    "${UPDATE_URL}" || echo "000")

  case "${HTTP_CODE}" in
    200)
      # Manifest present. Body may be JSON or multipart/mixed. Look for the
      # two required manifest fields.
      if grep -q '"id"' "$TMP" && grep -q '"createdAt"' "$TMP"; then
        UPDATE_ID=$(grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]+"' "$TMP" | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
        CREATED=$(grep -oE '"createdAt"[[:space:]]*:[[:space:]]*"[^"]+"' "$TMP" | head -1 | sed -E 's/.*"([^"]+)"$/\1/')
        pass "[${PLATFORM}] 200 — manifest present (id=${UPDATE_ID:-?} createdAt=${CREATED:-?})"
      else
        head -c 400 "$TMP"; echo
        fail "[${PLATFORM}] 200 but body lacks manifest id/createdAt fields"
      fi
      ;;
    204)
      # 204 = explicit "no update available". Devices stay on their embedded
      # bundle. Still proves the pipeline works.
      pass "[${PLATFORM}] 204 — no update published yet (embedded bundle stays active)"
      ;;
    404)
      head -c 400 "$TMP"; echo
      fail "[${PLATFORM}] 404 — channel/runtimeVersion has no entry. Check 'eas update:list'"
      ;;
    000)
      fail "[${PLATFORM}] could not reach ${UPDATE_URL} (network, proxy, DNS)"
      ;;
    *)
      head -c 400 "$TMP"; echo
      fail "[${PLATFORM}] unexpected HTTP ${HTTP_CODE}"
      ;;
  esac
done

echo
if [[ "${EXIT_CODE}" -eq 0 ]]; then
  echo "OTA pipeline reachable. A real update will be delivered when you run:"
  echo "  eas update --branch ${CHANNEL} --message \"…\""
fi
echo
echo "Reminder:"
echo "  - runtimeVersion in app.json must match the installed build."
echo "  - Native changes (plugins, permissions, SDK bumps, new native deps)"
echo "    require a runtimeVersion bump AND a new store build. OTA can't ship those."

exit "${EXIT_CODE}"
