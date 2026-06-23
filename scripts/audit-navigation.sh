#!/bin/bash
# scripts/audit-navigation.sh
#
# Audits all client-side navigation calls and classifies them.
#
# Usage:
#   npm run audit:navigation              # full report
#   npm run audit:navigation -- --fail    # exit 1 if any UNREVIEWED items found
#
# Exit codes:
#   0 = clean (or --fail not set)
#   1 = UNREVIEWED items found (only when --fail is passed)
#
# Classification:
#   [SAFE]       Legitimate use of router.replace — auth gate, onboarding linear
#                flow, or sequential purchase flow where back is intentionally
#                blocked.
#   [POST-ACTION] router.replace used after a user-initiated success action.
#                Should usually be safeGoBack(router, fallback) so the user
#                returns to where they came from.
#   [BLOCKED]    Pattern explicitly banned by verify-guardrails.sh (will block
#                commit).
#   [REVIEW]     Unclassified — needs a human eye before the next release.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FAIL_MODE=0
for arg in "$@"; do
  [[ "$arg" == "--fail" ]] && FAIL_MODE=1
done

# Colour codes (disabled if not a tty)
if [ -t 1 ]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; RESET=''
fi

REVIEW_COUNT=0
POST_ACTION_COUNT=0

classify_line() {
  local file="$1"
  local lineno="$2"
  local text="$3"

  # ── Skip comment lines ───────────────────────────────────────────────────
  if echo "$text" | grep -qE "^//|^\*"; then
    return
  fi

  # ── nav-safe: inline suppression ─────────────────────────────────────────
  # Add   // nav-safe: <reason>   on the router.replace line to mark it as
  # reviewed and intentional. The script will skip it with a SAFE label.
  if echo "$text" | grep -qE "nav-safe:"; then
    local reason
    reason="$(echo "$text" | grep -oE 'nav-safe:.*' | sed 's/nav-safe://' | tr -d '"'"'")"
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← nav-safe: $reason"
    return
  fi

  # ── BLOCKED (already caught by pre-commit guardrail) ─────────────────────
  if echo "$text" | grep -qE "router\.replace\([\"']/\(tabs\)[\"']"; then
    echo -e "${RED}[BLOCKED   ]${RESET} $file:$lineno"
    echo "             $text"
    ((REVIEW_COUNT++)) || true
    return
  fi

  # ── SAFE: safeGoBack implementation itself ───────────────────────────────
  if echo "$file" | grep -qE "utils/navigation\.ts"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← safeGoBack implementation"
    return
  fi

  # ── SAFE: edge swipe back fallback ───────────────────────────────────────
  if echo "$file" | grep -qE "hooks/useEdgeSwipeBack\.ts"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← edge swipe back fallback"
    return
  fi

  # ── SAFE: notification/telemetry dynamic route ───────────────────────────
  if echo "$file" | grep -qE "NotificationTapHandler|authTelemetry"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← dynamic route dispatch"
    return
  fi

  # ── SAFE: auth/session gates ──────────────────────────────────────────────
  # Redirecting unauthenticated or unauthorized users. Stack must be cleared
  # so the user cannot press Back into the protected screen.
  if echo "$text" | grep -qE "'/sign-in'|'/sign-up'|'/onboarding'|'/verify'|'/verify-identity'|'/reset-password'|'/forgot-password'|pathname.*verify|pathname.*reset-password"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← auth/session gate"
    return
  fi

  # ── SAFE: startup route decisions ────────────────────────────────────────
  # app/index.tsx decides the initial route at app start.
  # create-post.tsx auth gate also replaces to /create (the hub).
  if echo "$file" | grep -qE "app/index\.tsx|app/create\.tsx"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← startup/role decision"
    return
  fi
  if echo "$text" | grep -qE "'/create'"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← auth gate → create hub"
    return
  fi

  # ── SAFE: onboarding linear steps ────────────────────────────────────────
  # Multi-step onboarding: back navigation would break the flow.
  # Also covers coach-application, step-2-basic, etc. referenced from settings.
  if echo "$file" | grep -qE "app/onboarding/"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← onboarding step"
    return
  fi
  if echo "$text" | grep -qE "onboarding/step-|onboarding/coach-application|onboarding/coach-agreement"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← redirect into onboarding flow"
    return
  fi

  # ── SAFE: auth hook guards ────────────────────────────────────────────────
  if echo "$file" | grep -qE "hooks/useRequire"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← auth guard hook"
    return
  fi

  # ── SAFE: post-auth landing (sign-in/up completion) ───────────────────────
  if echo "$text" | grep -qE "landingRoute|getPostAuthLandingRoute|GUEST_HOME_ROUTE|decision\.route|nextCta\.route|canonicalStep|preferredRoute|nextRoute|recoveryRoute|targetRoute|coachUpgradeCta"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← dynamic post-auth landing"
    return
  fi

  # ── SAFE: sequential purchase / confirmation flows ───────────────────────
  # After a payment, back-navigation to the payment form would be confusing or
  # allow re-submission. Replace is intentional.
  if echo "$text" | grep -qE "ad-confirmation|subscription-paywall|payment-success|/my-ads|/billing|manageSubscription|manage-subscription|submit-ad|/organization"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← purchase/confirmation flow"
    return
  fi

  # ── SAFE: in-app redirect shortcuts (Alert/CTA actions) ──────────────────
  # Buttons in Alert dialogs that navigate to a known settings or onboarding
  # screen are intentional deep links, not post-action navigation.
  if echo "$text" | grep -qE "/settings/|buildOrganizationRequestsRoute"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← CTA shortcut to settings/org"
    return
  fi

  # ── SAFE: settings → onboarding re-entry ─────────────────────────────────
  if echo "$file" | grep -qE "app/settings/" && echo "$text" | grep -qE "onboarding|step-1|step-2"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← settings re-entry to onboarding"
    return
  fi

  # ── SAFE: replaceRoute helper (pending-approval delegate) ─────────────────
  if echo "$text" | grep -qE "replaceRoute"; then
    echo -e "${GREEN}[SAFE      ]${RESET} $file:$lineno  ← replaceRoute delegate"
    return
  fi

  # ── POST-ACTION: navigates to a feed/tab after completing an action ────────
  # These should use safeGoBack(router, fallback) so the user returns to where
  # they came from, not always to the same hardcoded screen.
  if echo "$text" | grep -qE "router\.replace\(.*'/(tabs)/feed'|router\.replace\(.*'/(tabs)/discover'|router\.replace\(.*'/(tabs)/profile'"; then
    echo -e "${YELLOW}[POST-ACTION]${RESET} $file:$lineno  ← consider safeGoBack(router, fallback)"
    echo "              $text"
    ((POST_ACTION_COUNT++)) || true
    return
  fi

  # ── REVIEW: everything else ───────────────────────────────────────────────
  echo -e "${CYAN}[REVIEW    ]${RESET} $file:$lineno"
  echo "             $text"
  ((REVIEW_COUNT++)) || true
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  VarsityHub Navigation Audit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Find all router.replace calls in client code
while IFS=: read -r file lineno text; do
  # Strip leading whitespace from text
  text="$(echo "$text" | sed 's/^[[:space:]]*//')"
  classify_line "$file" "$lineno" "$text"
done < <(
  rg -n "router\.replace\b" \
    app/ components/ hooks/ utils/ \
    --glob "*.ts" --glob "*.tsx" \
    --glob "!**/__tests__/**" \
    --glob "!**/*.test.*" \
    2>/dev/null
)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  safeGoBack usage (healthy — more is better)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SAFE_COUNT=$(rg -c "safeGoBack" app/ components/ hooks/ utils/ --glob "*.ts" --glob "*.tsx" 2>/dev/null \
  | awk -F: '{s+=$2} END {print s}' || echo 0)
REPLACE_COUNT=$(rg -c "router\.replace" app/ components/ hooks/ utils/ --glob "*.ts" --glob "*.tsx" 2>/dev/null \
  | awk -F: '{s+=$2} END {print s}' || echo 0)

echo ""
echo "  safeGoBack calls : $SAFE_COUNT"
echo "  router.replace   : $REPLACE_COUNT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ "$REVIEW_COUNT" -gt 0 ]; then
  echo -e "  ${CYAN}[REVIEW]${RESET}     $REVIEW_COUNT item(s) need a human decision"
fi
if [ "$POST_ACTION_COUNT" -gt 0 ]; then
  echo -e "  ${YELLOW}[POST-ACTION]${RESET} $POST_ACTION_COUNT item(s) could be safeGoBack instead"
fi
if [ "$REVIEW_COUNT" -eq 0 ] && [ "$POST_ACTION_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}All router.replace calls are classified. No REVIEW items.${RESET}"
fi
echo ""

# Screen dead-end check: screens with no back button and no navigation call
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Screens with headerShown:false but no back navigation"
echo "  (potential dead ends if save/submit doesn't navigate)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DEAD_END_COUNT=0
while IFS= read -r file; do
  # Only flag if the file has no router/navigation call at all.
  # Redirect-only screens navigate via the <Redirect> component, not router.*;
  # a // nav-safe: comment also clears a screen the same way it clears replaces.
  if ! rg -q "router\.(push|replace|back|navigate)|safeGoBack|useNavigation|router\.dismiss|<Redirect|nav-safe:" "$file" 2>/dev/null; then
    echo -e "  ${YELLOW}?${RESET} $file  (no navigation found — verify it has a back button)"
    ((DEAD_END_COUNT++)) || true
  fi
done < <(
  # Layout files (_layout.tsx) are not screens — exclude them from the screen
  # dead-end scan.
  rg -l "headerShown.*false" app/ --glob "*.tsx" --glob "!**/_layout.tsx" 2>/dev/null | head -30
)

if [ "$DEAD_END_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}All headerShown:false screens have at least one navigation call.${RESET}"
fi
echo ""

if [ "$FAIL_MODE" -eq 1 ] && [ "$REVIEW_COUNT" -gt 0 ]; then
  echo -e "${RED}FAIL: $REVIEW_COUNT REVIEW item(s) must be classified before release.${RESET}"
  echo "      Run: npm run audit:navigation   for details."
  echo "      Then update the classification rules in scripts/audit-navigation.sh."
  exit 1
fi

exit 0
