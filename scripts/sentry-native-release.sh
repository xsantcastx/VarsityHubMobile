#!/bin/bash
# Keep the existing Sentry uploader; fail release builds unless full app debug
# information for this archive's UUID is actually available in Sentry.
set -euo pipefail
if [[ "${CONFIGURATION:-}" == *Debug* ]]; then exit 0; fi
if [[ "${SENTRY_DISABLE_AUTO_UPLOAD:-}" == true || "${SENTRY_DISABLE_XCODE_DEBUG_UPLOAD:-}" == true ]]; then
  echo 'error: Native release symbol upload must not be disabled.' >&2
  exit 1
fi
if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo 'error: SENTRY_AUTH_TOKEN is required for native release symbol upload.' >&2
  exit 1
fi
NATIVE_NODE_BINARY="${NODE_BINARY:-node}"
NATIVE_SENTRY_SCRIPT="$("$NATIVE_NODE_BINARY" --print "require('path').dirname(require.resolve('@sentry/react-native/package.json')) + '/scripts/sentry-xcode-debug-files.sh'")"
/bin/bash "$NATIVE_SENTRY_SCRIPT"
"$NATIVE_NODE_BINARY" "${PROJECT_DIR}/../scripts/verify-native-debug-files.cjs"
