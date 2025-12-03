#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <platform:ios|android> <device-name|adb-id> <output-path> [WIDTHxHEIGHT]" >&2
  exit 1
fi

PLATFORM=$(echo "$1" | tr '[:upper:]' '[:lower:]')
DEVICE="$2"
OUTPUT="$3"
TARGET_SIZE="${4:-}"

ensure_dir() {
  local dir
  dir="$(dirname "$1")"
  [[ -d "$dir" ]] || mkdir -p "$dir"
}

normalize_line_endings() {
  # Convert CRLF that Android screencap emits into LF
  python3 - "$OUTPUT" <<'PYCODE'
import sys, pathlib
path = pathlib.Path(sys.argv[1])
path.write_bytes(path.read_bytes().replace(b'\r\n', b'\n'))
PYCODE
}

resize_if_needed() {
  local path="$1"
  local size="$2"
  if [[ -z "$size" ]]; then
    return
  fi
  if ! command -v sips >/dev/null 2>&1; then
    echo "sips not available; skipping resize" >&2
    return
  fi
  local width height
  IFS="x" read -r width height <<<"$size"
  sips -z "$height" "$width" "$path" >/dev/null
}

ensure_dir "$OUTPUT"

case "$PLATFORM" in
  ios)
    if ! command -v xcrun >/dev/null 2>&1; then
      echo "xcrun not found. Install Xcode command line tools." >&2
      exit 1
    fi
    DEVICE_UDID=$(xcrun simctl list devices | sed -n "s/^\s*$DEVICE (\([^)]*\)).*/\1/p" | head -n 1)
    if [[ -z "$DEVICE_UDID" ]]; then
      echo "Simulator '$DEVICE' not found. Available devices:" >&2
      xcrun simctl list devices 1>&2
      exit 1
    fi
    xcrun simctl bootstatus "$DEVICE_UDID" -b >/dev/null
    xcrun simctl io "$DEVICE_UDID" screenshot "$OUTPUT"
    ;;
  android)
    if ! command -v adb >/dev/null 2>&1; then
      echo "adb not found. Install Android platform tools." >&2
      exit 1
    fi
    adb -s "$DEVICE" exec-out screencap -p > "$OUTPUT"
    normalize_line_endings "$OUTPUT"
    ;;
  *)
    echo "Unsupported platform '$PLATFORM'. Use ios or android." >&2
    exit 1
    ;;
esac

resize_if_needed "$OUTPUT" "$TARGET_SIZE"
echo "Saved screenshot to $OUTPUT"
