#!/bin/bash
# safe-stash-apply.sh — Apply a git stash and immediately flag any conflict markers.
#
# Usage:
#   bash scripts/safe-stash-apply.sh              # apply stash@{0}
#   bash scripts/safe-stash-apply.sh stash@{1}    # apply a specific stash
#
# On success: prints "Stash applied cleanly — no conflicts."
# On conflict: lists every file with markers and exits non-zero.

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

STASH="${1:-stash@{0}}"

echo "Applying $STASH..."
# `git stash apply` exits 0 even when there are conflicts — we check manually
git stash apply "$STASH" || true

echo ""
echo "Scanning for conflict markers..."
conflict_files="$(rg -l "^<<<<<<< |^>>>>>>> |^=======$" \
  --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx' \
  app components hooks utils api context constants lib shared server/src \
  2>/dev/null || true)"

if [ -z "$conflict_files" ]; then
  echo "✅  Stash applied cleanly — no conflicts."
  exit 0
fi

echo ""
echo "⚠️  Conflict markers found in:"
echo "$conflict_files" | sed 's/^/  /'
echo ""
echo "Files with conflicts:"
while IFS= read -r f; do
  count=$(rg -c "^<<<<<<< " "$f" 2>/dev/null || echo 0)
  echo "  $f  ($count block(s))"
done <<< "$conflict_files"
echo ""
echo "Resolve these before running 'git add' or committing."
echo "Tip: open each file and search for '<<<<<<<' to find the blocks."
exit 1
