#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

patterns=(".logs" "logs" "overnight-results" "overnight-*")

find_artifacts=()
shopt -s nullglob
for pattern in "${patterns[@]}"; do
  for path in $pattern; do
    if [ -e "$path" ]; then
      find_artifacts+=("$path")
    fi
  done
done
shopt -u nullglob

if ((${#find_artifacts[@]} > 0)); then
  echo "❌ Repo health check failed: artifacts found in repo root:"
  printf ' - %s\n' "${find_artifacts[@]}"
  echo "Run ./scripts/clean-repo-artifacts.sh to remove local artifacts."
  exit 1
fi

tracked_artifacts=$(git ls-files | grep -E '^(\.logs|logs|overnight-results)/|^overnight-[^/]+/' || true)
if [ -n "$tracked_artifacts" ]; then
  echo "❌ Repo health check failed: committed artifacts detected:"
  echo "$tracked_artifacts"
  exit 1
fi

echo "✅ Repo health check passed."
