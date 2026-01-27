#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

patterns=(".logs" "logs" "overnight-results" "overnight-*" "playwright-report" "test-results" "coverage" "coverage-*")

removed_any=false
shopt -s nullglob
for pattern in "${patterns[@]}"; do
  for path in $pattern; do
    if [ -e "$path" ]; then
      rm -rf "$path"
      removed_any=true
      echo "Removed $path"
    fi
  done
done
shopt -u nullglob

if [ "$removed_any" = false ]; then
  echo "No local artifacts found."
fi
