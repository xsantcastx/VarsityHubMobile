#!/usr/bin/env bash
# Clean Repo Artifacts
# Safely removes local logs, overnight artifacts, and build outputs from repo root
# These should never be committed (see .gitignore)

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

patterns=(".logs" "logs" "overnight-results" "overnight-*" "overnight-health-*" "overnight-logs-*" "playwright-report" "test-results" "coverage" "coverage-*" "midnight-health.json" "overnight.log")

removed_any=false
shopt -s nullglob
for pattern in "${patterns[@]}"; do
  for path in $pattern; do
    if [ -e "$path" ]; then
      rm -rf "$path"
      removed_any=true
      echo "✅ Removed $path"
    fi
  done
done
shopt -u nullglob

# Also clean any .log files in root
for logfile in *.log; do
  if [ -f "$logfile" ]; then
    rm -f "$logfile"
    removed_any=true
    echo "✅ Removed $logfile"
  fi
done

if [ "$removed_any" = false ]; then
  echo "✅ No local artifacts found. Repo is clean."
else
  echo ""
  echo "✅ Cleanup complete. Run './scripts/check-repo-health.sh' to verify."
fi
