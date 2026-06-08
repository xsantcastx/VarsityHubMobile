#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking regression guardrails..."

# ── Conflict marker guard ─────────────────────────────────────────────────────
# Catches git merge/stash conflict markers left in source files before commit.
# Uses rg if available, falls back to grep.
if command -v rg >/dev/null 2>&1; then
  conflict_files="$(rg -l "^<<<<<<< |^>>>>>>> |^=======$" \
    --glob '*.ts' --glob '*.tsx' --glob '*.js' --glob '*.jsx' \
    app components hooks utils api context constants lib shared server/src \
    2>/dev/null || true)"
else
  conflict_files="$(grep -rl "<<<<<<< \|>>>>>>> \|^=======$" \
    --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
    app components hooks utils api context constants lib shared server/src \
    2>/dev/null || true)"
fi
if [ -n "$conflict_files" ]; then
  echo ""
  echo "ERROR: Git conflict markers found in the following files:"
  echo "$conflict_files" | sed 's/^/  /'
  echo ""
  echo "Run: git stash list   (to see pending stashes)"
  echo "     git diff --name-only   (to see all modified files)"
  echo "Resolve all conflicts before committing."
  exit 1
fi

check_no_matches() {
  local description="$1"
  local pattern="$2"
  shift 2
  local output status
  # Run rg separately so we can distinguish "no matches" (rg exit 1, OK) from
  # "regex parse error or I/O failure" (rg exit 2+, must fail loudly). The
  # previous `|| true` masked parse errors, silently disabling the guardrail.
  output="$(rg -n "$pattern" "$@")" && status=0 || status=$?
  if [ "$status" -ge 2 ]; then
    echo "Guardrail tool error running check '$description' (rg exit $status). Pattern: $pattern"
    exit 2
  fi
  if [ -n "$output" ]; then
    echo "Guardrail failed: $description"
    echo "$output"
    exit 1
  fi
}

# Character class needs double-and-single quotes without shell escapes eating
# the backslashes. `["']` works in a bash double-quoted string because `\"`
# escapes the double quote and `'` is literal — rg receives `["']` verbatim.
check_no_matches \
  "MaterialIcons is using known Ionicons-only names" \
  "MaterialIcons[^>]*name=[\"'](arrow-up|arrow-down|chevron-back|chatbubble-ellipses|chatbubble)[\"']" \
  app components hooks utils

check_no_matches \
  "user label fallback bypasses utils/userDisplay.ts" \
  "display_name\\s*\\|\\|\\s*username|display_name\\s*\\|\\|\\s*email|username\\s*\\|\\|\\s*email" \
  app components hooks api utils \
  --glob '!utils/userDisplay.ts' \
  --glob '!**/__tests__/**'

check_no_matches \
  "router.replace to bare tabs root — use safeGoBack(router, '/(tabs)/feed') instead" \
  "router\.replace\([\"']/\(tabs\)[\"']" \
  app components hooks utils

if ! rg -n "getNotificationHref|getNotificationTitle" app/feed.tsx "app/(tabs)/notifications/index.tsx" >/dev/null 2>&1; then
  echo "Guardrail failed: feed and notifications screen must use utils/notificationPresentation.ts"
  exit 1
fi

echo "Guardrails passed."
