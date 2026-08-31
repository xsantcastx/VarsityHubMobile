#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking regression guardrails..."

npm run audit:structural-duplicates

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
  app components hooks utils \
  --glob '!**/__tests__/**'

# Emails MUST go through EmailService/sendTemplateEmail; only the centralized
# SendGrid provider may call sgMail.send directly (P0 invariant). Previously this
# only ran in the manually-invoked pre-release audit — promote it to the commit
# gate so a bypass can't land. Excludes the provider and test files.
check_no_matches \
  "sgMail.send outside the centralized SendGrid provider — route email through EmailService" \
  "sgMail\.send" \
  server/src \
  --glob '!**/providers/SendGridProvider.ts' \
  --glob '!**/__tests__/**'

# Text colors MUST use useColorScheme()/theme constants — never hardcode a dark
# hex text color. Matches the lowercase `color:` style prop only; backgroundColor,
# borderColor, shadowColor, tintColor all use a capital `Color` and are unaffected.
# Suppress an intentional contrast/computed color with a `// audit: <reason>` note.
check_no_matches \
  "hardcoded dark text color — use useColorScheme()/theme constants (or add // audit: <reason>)" \
  "color:\s*[\"'](#000000|#111111|#111827|#1a1a1a|#333333|#374151|#000|#111|#333|black)[\"'](?!.*audit)" \
  app components \
  -P \
  --glob '!**/__tests__/**'

# react-query: exactly one QueryClient (lib/queryClient.ts). A second client
# splits the cache and breaks the cross-screen dedupe the single client provides.
check_no_matches \
  "second QueryClient — import the shared client from lib/queryClient.ts" \
  "new QueryClient\(" \
  app components hooks utils lib \
  --glob '!**/queryClient.ts' \
  --glob '!**/__tests__/**'

# Spinners gate on isPending, never isFetching (isFetching stays true during a
# background refetch and flashes spinners). isFetchingNextPage is allowed.
check_no_matches \
  "isFetching gates a spinner — use isPending (isFetchingNextPage is fine)" \
  "\bisFetching\b(?!NextPage)" \
  app components hooks \
  -P \
  --glob '!**/__tests__/**'

if ! rg -n "getNotificationHref|getNotificationTitle" app/feed.tsx "app/(tabs)/notifications/index.tsx" >/dev/null 2>&1; then
  echo "Guardrail failed: feed and notifications screen must use utils/notificationPresentation.ts"
  exit 1
fi

# ── Navigation dead-end audit ─────────────────────────────────────────────────
# Every router.replace must be classified as SAFE or annotated with nav-safe:.
# Any REVIEW item means an unreviewed navigation pattern was introduced.
if ! bash scripts/audit-navigation.sh --fail >/dev/null 2>&1; then
  echo ""
  echo "Guardrail failed: unclassified router.replace calls (navigation dead-end risk)"
  echo "Run: npm run audit:navigation   for details."
  echo "Add a '// nav-safe: <reason>' comment to each unclassified call, or fix it."
  exit 1
fi

echo "Guardrails passed."
