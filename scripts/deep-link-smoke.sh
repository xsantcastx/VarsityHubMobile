#!/usr/bin/env bash
set -euo pipefail

# Deep link smoke tests for VarsityHubMobile
# Usage:
#  ./scripts/deep-link-smoke.sh android reset
#  ./scripts/deep-link-smoke.sh android verify
#  ./scripts/deep-link-smoke.sh ios reset
#  ./scripts/deep-link-smoke.sh ios verify

PLATFORM=${1:-}
ACTION=${2:-}

if [[ -z "$PLATFORM" || -z "$ACTION" ]]; then
  echo "Usage: $0 <android|ios> <reset|verify>"
  exit 1
fi

SCHEME="varsityhubmobile"

case "$PLATFORM" in
  android)
    if ! command -v adb >/dev/null 2>&1; then
      echo "adb not found; install Android platform tools."
      exit 1
    fi
    adb start-server >/dev/null 2>&1 || true
    case "$ACTION" in
      reset)
        adb shell am start -a android.intent.action.VIEW -d "$SCHEME://reset/test"
        ;;
      verify)
        adb shell am start -a android.intent.action.VIEW -d "$SCHEME://verify-email/test"
        ;;
      *) echo "Unknown action: $ACTION"; exit 1;;
    esac
    ;;
  ios)
    if ! command -v xcrun >/dev/null 2>&1; then
      echo "xcrun not found; ensure Xcode command line tools installed."
      exit 1
    fi
    case "$ACTION" in
      reset)
        xcrun simctl openurl booted "$SCHEME://reset/test"
        ;;
      verify)
        xcrun simctl openurl booted "$SCHEME://verify-email/test"
        ;;
      *) echo "Unknown action: $ACTION"; exit 1;;
    esac
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    exit 1
    ;;

esac

echo "✅ Deep link triggered: $PLATFORM $ACTION"