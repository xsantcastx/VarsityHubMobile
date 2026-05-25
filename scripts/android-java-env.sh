#!/bin/bash

set -euo pipefail

ensure_android_java() {
  local required_major="${1:-17}"
  local current_major=""

  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    current_major="$("${JAVA_HOME}/bin/java" -version 2>&1 | awk -F[\".] '/version/ { print $2; exit }')"
  elif command -v java >/dev/null 2>&1; then
    current_major="$(java -version 2>&1 | awk -F[\".] '/version/ { print $2; exit }')"
  fi

  if [ "$current_major" = "$required_major" ]; then
    return 0
  fi

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    local detected_java_home
    detected_java_home="$(/usr/libexec/java_home -v "$required_major" 2>/dev/null || true)"
    if [ -n "$detected_java_home" ]; then
      export JAVA_HOME="$detected_java_home"
      export PATH="$JAVA_HOME/bin:$PATH"
      return 0
    fi
  fi

  echo "❌ Android builds require JDK $required_major. Install it and set JAVA_HOME before running this script."
  return 1
}
