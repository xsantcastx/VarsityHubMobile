#!/usr/bin/env zsh
# Quick helper to clear and re-establish Watchman watches for this repo
set -euo pipefail

ROOT="/Users/varsityhub/Desktop/CODE/VarsityHubMobile"

if ! command -v watchman >/dev/null 2>&1; then
  echo "watchman not installed; skipping" >&2
  exit 0
fi

watchman watch-del "$ROOT" >/dev/null 2>&1 || true
watchman watch-project "$ROOT"
echo "Watchman recrawl reset complete for $ROOT"
