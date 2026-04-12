#!/usr/bin/env bash
#
# Release-pass driver. Walks the RELEASE_PASS_CHECKLIST.md sections, running
# every check we can automate and pausing for human confirmation on the ones
# that require a device, a browser, or a third-party console. Nothing in this
# script mutates production on its own — everything either reads, triggers a
# test-only canary, or prints the command you'd run manually.
#
# Usage:
#   API_URL=https://api-production-…up.railway.app \
#   bash scripts/release-checks/release-pass.sh
#
# Optional env:
#   STRIPE_API_KEY     — enables §3 Stripe webhook replay
#   AUTH_JWT           — enables §6 pool stress + §7 sentry canary calls
#   SENTRY_CANARY_TOKEN — shared token set in Railway to hit the canary route

set -uo pipefail  # not -e: we want each section to run independently

API_URL="${API_URL:?API_URL is required, e.g. https://api-production-…up.railway.app}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

FAILED=()
PAUSED=()

pass() { printf '\033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$1"; FAILED+=("$1"); }
warn() { printf '\033[33m!\033[0m %s\n' "$1"; }
hr()   { printf '\n%s\n\n' "────────────────────────────────────────────────────────────"; }

confirm() {
  # Human-gated step. Prints a prompt, reads y/n, records the choice.
  local label="$1"; shift
  echo
  echo "MANUAL CHECK: ${label}"
  for line in "$@"; do echo "  - ${line}"; done
  printf '    → Did it pass? [y/N/s=skip] '
  read -r ans || ans=''
  case "${ans,,}" in
    y|yes) pass "${label}" ;;
    s|skip) warn "${label} (skipped)"; PAUSED+=("${label}") ;;
    *) fail "${label}" ;;
  esac
}

hr
echo "§1 Env parity — probing /health"
HEALTH=$(curl -sS --max-time 10 "${API_URL%/}/health" || true)
if [[ -z "$HEALTH" ]]; then
  fail "Health endpoint unreachable at ${API_URL}/health"
else
  echo "$HEALTH" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(json.dumps(d.get("integrations",{}), indent=2))' || echo "$HEALTH"
  READY=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("ready", False))' 2>/dev/null || echo "false")
  if [[ "$READY" == "True" ]]; then
    pass "Health reports ready=true"
  else
    fail "Health reports ready=false — see integrations above"
  fi
fi

hr
echo "§2 Migrations"
if [[ -n "$HEALTH" ]]; then
  PT=$(echo "$HEALTH" | python3 -c 'import json,sys; print(json.loads(sys.stdin.read()).get("integrations",{}).get("pushTicketMigration", False))' 2>/dev/null || echo "false")
  if [[ "$PT" == "True" ]]; then
    pass "PushTicket migration applied"
  else
    fail "PushTicket migration missing — run: cd server && npx prisma migrate deploy"
  fi
fi

hr
echo "§3 Stripe webhook idempotency"
if [[ -n "${STRIPE_API_KEY:-}" ]]; then
  bash "${SCRIPT_DIR}/stripe-webhook-replay.sh" || fail "Stripe webhook replay script errored"
  confirm "Stripe TransactionLog shows processed_count = 1 for the replayed event" \
    "Run the SQL printed above against Railway Postgres"
else
  warn "STRIPE_API_KEY not set — skipping automated Stripe replay"
  PAUSED+=("Stripe webhook idempotency (STRIPE_API_KEY unset)")
fi

hr
echo "§4 Auth + OAuth on real devices"
confirm "Email signup → verification code → /me returns email_verified=true" \
  "Install the release build on a real device" \
  "Fresh email signup flow"
confirm "Sign in with Apple sets email_verified correctly (only when Apple confirmed)" \
  "Check server logs for 'raw_nonce missing' warnings during the flow"
confirm "Sign in with Google completes on device" \
  "Confirm token verified against GOOGLE_OAUTH_CLIENT_IDS"
confirm "Access-token refresh holds across a long background window" \
  "Kill the app for >15 min, reopen, no forced logout"
confirm "Deep link from terminated state routes correctly" \
  "Tap varsityhubmobile://post/<id> from the home screen with the app closed"

hr
echo "§5 Push notifications end-to-end"
if [[ -n "${AUTH_JWT:-}" && -n "${RECIPIENT_ID:-}" ]]; then
  bash "${SCRIPT_DIR}/push-verify.sh" || fail "push-verify script errored"
  confirm "Notification appeared on the device within ~10s" \
    "PushTicket row inserted with status='pending'"
  confirm "After 15 min, PushTicket row flipped to status='ok'" \
    "Run the SQL printed by push-verify.sh"
else
  warn "AUTH_JWT / RECIPIENT_ID not set — skipping automated push trigger"
  PAUSED+=("Push notifications (AUTH_JWT/RECIPIENT_ID unset)")
fi

hr
echo "§6 Approval workflows"
confirm "Coach signup → admin approval → coach can create org" \
  "Unverified coach hits 403 on POST /organizations"
confirm "Fan signup → POST /organizations returns 403 COACH_ROLE_REQUIRED" ""
confirm "Coach without managed team → POST /games returns 400 HOME_TEAM_REQUIRED" ""
confirm "Ad approval → ad becomes active when payment was already recorded" ""

hr
echo "§7 Observability"
if [[ -n "${SENTRY_CANARY_TOKEN:-}" ]]; then
  CANARY=$(curl -sS -X POST "${API_URL%/}/health/sentry-canary" \
    -H "X-Canary-Token: ${SENTRY_CANARY_TOKEN}" || true)
  MARKER=$(echo "$CANARY" | python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(d.get("marker",""))' 2>/dev/null || echo "")
  if [[ -n "$MARKER" ]]; then
    pass "Sentry canary fired (marker: ${MARKER})"
    confirm "Sentry issue tagged 'health_sentry_canary' appeared with marker ${MARKER}" ""
  else
    fail "Sentry canary did not fire — response: ${CANARY}"
  fi
else
  warn "SENTRY_CANARY_TOKEN not set — skipping server-side Sentry probe"
  PAUSED+=("Sentry ingestion (SENTRY_CANARY_TOKEN unset)")
fi
confirm "railway logs show '[Redacted]' where auth/password/OTP appear" \
  "Trigger a failed login; grep 'password' in logs and confirm no raw values"

hr
echo "§8 Pool stress"
if [[ -n "${AUTH_JWT:-}" ]]; then
  CONCURRENCY=50 REQUESTS=500 ENDPOINT=/posts?limit=20 \
    bash "${SCRIPT_DIR}/pool-stress.sh" || fail "pool-stress script errored"
  confirm "Pool stress: error rate <1% and p95 <1000ms" ""
else
  warn "AUTH_JWT not set — skipping authenticated pool stress"
  PAUSED+=("Pool stress (AUTH_JWT unset)")
fi

hr
echo "§9 OTA update pipeline"
bash "${SCRIPT_DIR}/ota-check.sh" || fail "OTA manifest check failed"

hr
echo "§10 Release artifact integrity"
(
  cd "$REPO_ROOT"
  echo "App version / runtimeVersion:"
  node -e 'const c=require("./app.json"); console.log(" ",c.expo.version,"|",c.expo.runtimeVersion)' 2>/dev/null || cat app.json | head -5
  echo
  echo "Git state:"
  git status --short | head -5 || true
  git log --oneline -3 || true
)
confirm "Version numbers, runtime-version, and tag match the release intent" ""

hr
echo "Summary"
echo "-------"
if [[ ${#FAILED[@]} -eq 0 ]]; then
  pass "All automated checks passed."
else
  for f in "${FAILED[@]}"; do fail "$f"; done
fi
if [[ ${#PAUSED[@]} -gt 0 ]]; then
  echo
  echo "Paused / skipped — require env or human follow-up:"
  for p in "${PAUSED[@]}"; do printf '  - %s\n' "$p"; done
fi
echo
if [[ ${#FAILED[@]} -gt 0 ]]; then exit 1; fi
exit 0
