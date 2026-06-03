#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

collect_changed_files() {
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    {
      git diff --name-only --diff-filter=ACMRTUXB HEAD --
      git diff --name-only --cached --diff-filter=ACMRTUXB --
    }
  fi

  git ls-files --others --exclude-standard
}

files=()
while IFS= read -r file; do
  files+=("$file")
done < <(
  collect_changed_files \
    | awk 'NF' \
    | sort -u \
    | rg '\.(ts|tsx|js|jsx|json|md)$'
)

if [ "${#files[@]}" -eq 0 ]; then
  echo "No format-relevant changed files"
  exit 0
fi

echo "Checking formatting for changed files:"
printf '  %s\n' "${files[@]}"

printf '%s\0' "${files[@]}" | xargs -0 npx prettier --check
