#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/varsityhub-web-export-check.XXXXXX")"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/varsityhub-web-export-log.XXXXXX")"

cleanup() {
  rm -rf "$EXPORT_DIR"
  rm -f "$LOG_FILE"
}

trap cleanup EXIT

cd "$ROOT_DIR"

set +e
CI=1 npx expo export --platform web --output-dir "$EXPORT_DIR" 2>&1 | tee "$LOG_FILE"
EXPORT_STATUS=${PIPESTATUS[0]}
set -e

if [[ "$EXPORT_STATUS" -ne 0 ]]; then
  echo "[web-export-guard] expo export failed with status $EXPORT_STATUS" >&2
  exit "$EXPORT_STATUS"
fi

BLOCKED_PATTERNS=(
  "props.pointerEvents is deprecated. Use style.pointerEvents"
  'Animated: `useNativeDriver` is not supported because the native animated module is missing.'
  "Warning:"
  "console.warn"
  "console.error"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if grep -Fq "$pattern" "$LOG_FILE"; then
    echo "[web-export-guard] blocked console output matched: $pattern" >&2
    exit 1
  fi
done

echo "[web-export-guard] web export completed without blocked console output."
