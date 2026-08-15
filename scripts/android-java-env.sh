#!/bin/bash

set -euo pipefail

ensure_android_java() {
  local required_major="${1:-17}"
  local current_major=""
  local version_output=""

  if [ -n "${JAVA_HOME:-}" ] && [ -x "${JAVA_HOME}/bin/java" ]; then
    version_output="$("${JAVA_HOME}/bin/java" -version 2>&1 || true)"
  elif command -v java >/dev/null 2>&1; then
    version_output="$(java -version 2>&1 || true)"
  fi

  if [ -n "$version_output" ]; then
    current_major="$(printf '%s\n' "$version_output" | sed -nE 's/.*version "([0-9]+).*/\1/p' | head -n1)"
    if [ -z "$current_major" ]; then
      current_major="$(printf '%s\n' "$version_output" | sed -nE 's/.*openjdk[[:space:]]+([0-9]+).*/\1/p' | head -n1)"
    fi
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
