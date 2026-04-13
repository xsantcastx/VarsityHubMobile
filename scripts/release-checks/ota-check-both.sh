#!/usr/bin/env bash
#
# Verify the Expo OTA endpoint for multiple runtime versions without editing app.json.
#
# Usage:
#   bash scripts/release-checks/ota-check-both.sh
#   bash scripts/release-checks/ota-check-both.sh 1.0.1 1.0.2

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

RUNTIMES=("$@")
if [[ "${#RUNTIMES[@]}" -eq 0 ]]; then
  RUNTIMES=("1.0.1" "1.0.2")
fi

for runtime in "${RUNTIMES[@]}"; do
  echo
  echo "=== OTA check for runtime ${runtime} ==="
  RUNTIME_VERSION="${runtime}" bash scripts/release-checks/ota-check.sh
done
