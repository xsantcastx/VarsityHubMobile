#!/usr/bin/env bash
# VarsityHub approval-flow smoke test.
# Runs a bounded happy-path + edge-case check against a real API. Use against a
# STAGING or LOCAL server, NEVER production (it creates test accounts).
#
# Usage:
#   cd server
#   API_BASE=http://localhost:4000 \
#   ADMIN_EMAIL=support@varsityhub.app \
#   ADMIN_PASSWORD=secret \
#   ENABLE_DEV_CODES_CONFIRMED=1 \
#   bash scripts/smoke-test-approvals.sh
#
# Set ENABLE_DEV_CODES_CONFIRMED=1 to confirm your server is running with
# ENABLE_DEV_CODES=1 (required — otherwise email codes can't be read from responses).
#
# Exits 0 on full pass, 1 on any failure. Prints a one-line-per-check summary.

set -u
set -o pipefail

# ── Colors ─────────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[34m'; D=$'\033[2m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; D=''; N=''
fi

# ── Config ─────────────────────────────────────────────────────────────────
API_BASE="${API_BASE:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
HEALTH_SECRET="${HEALTH_CHECK_SECRET:-}"
SKIP_MIGRATION="${SKIP_MIGRATION:-0}"
SKIP_JEST="${SKIP_JEST:-0}"
SKIP_HTTP="${SKIP_HTTP:-0}"

# Tracking
PASS=0
FAIL=0
FAIL_DETAILS=()

pass() {
  printf "  ${G}✓${N} %s\n" "$1"
  PASS=$((PASS + 1))
}
fail() {
  printf "  ${R}✗${N} %s\n" "$1"
  [[ -n "${2:-}" ]] && printf "    ${D}%s${N}\n" "$2"
  FAIL=$((FAIL + 1))
  FAIL_DETAILS+=("$1")
}
skip() {
  printf "  ${Y}⚠${N}  %s %s\n" "$1" "${D}(skipped: ${2:-})${N}"
}
section() {
  printf "\n${B}── %s ${N}\n" "$1"
}

# ── Preflight ──────────────────────────────────────────────────────────────
section "Preflight"

if ! command -v curl >/dev/null 2>&1; then
  fail "curl required but not found"
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  fail "jq required but not found (brew install jq)"
  exit 1
fi
pass "curl + jq available"

if [[ "$SKIP_HTTP" != "1" ]]; then
  if ! curl -fsSL --max-time 3 "$API_BASE/health" >/dev/null 2>&1; then
    fail "API at $API_BASE not reachable" "start the server first (npm run build && node dist/index.js)"
    exit 1
  fi
  pass "API reachable at $API_BASE"
fi

# ── Step 1: Prisma migration ──────────────────────────────────────────────
section "Step 1 · Prisma migration"

if [[ "$SKIP_MIGRATION" == "1" ]]; then
  skip "prisma migrate deploy" "SKIP_MIGRATION=1"
else
  if npx prisma migrate deploy 2>&1 | tee /tmp/smoke-migrate.log | grep -qE "All migrations have been successfully applied|No pending migrations|Applying migration"; then
    pass "prisma migrate deploy succeeded"
  else
    fail "prisma migrate deploy failed" "see /tmp/smoke-migrate.log"
  fi
fi

# ── Step 2: Jest regression tests ─────────────────────────────────────────
section "Step 2 · Jest regression (approval + onboarding + group-chats)"

if [[ "$SKIP_JEST" == "1" ]]; then
  skip "jest" "SKIP_JEST=1"
else
  JEST_OUT=$(
    CI=1 node --experimental-vm-modules ./node_modules/jest/bin/jest.js \
      --watchman=false --silent --no-coverage \
      src/__tests__/api-group-chats.test.ts \
      src/__tests__/api-events.test.ts \
      src/__tests__/coach-approval.test.ts \
      src/__tests__/payment-flow.test.ts 2>&1 || true
  )
  TESTS_PASSED=$(echo "$JEST_OUT" | grep -oE "Tests: +[0-9]+ passed" | grep -oE "[0-9]+" | head -1)
  TESTS_FAILED=$(echo "$JEST_OUT" | grep -oE "Tests: +.*[0-9]+ failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+" | head -1)
  if [[ -n "${TESTS_FAILED:-}" && "$TESTS_FAILED" != "0" ]]; then
    fail "jest: $TESTS_FAILED failed, $TESTS_PASSED passed" "run the command directly to see failures"
    echo "$JEST_OUT" | tail -20
  else
    pass "jest: $TESTS_PASSED passed, 0 failed"
  fi
fi

[[ "$SKIP_HTTP" == "1" ]] && { printf "\n${Y}Skipping HTTP checks (SKIP_HTTP=1)${N}\n"; goto_summary=1; }

if [[ "${goto_summary:-0}" != "1" ]]; then

# ── Helpers ────────────────────────────────────────────────────────────────
TMP_COOKIE=$(mktemp -t varsityhub-smoke.XXXXXX)
trap "rm -f $TMP_COOKIE" EXIT

api() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS --max-time 15 -X "$method" "$API_BASE$path" \
              -H "Content-Type: application/json" \
              -w "\n%{http_code}")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer $token")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}" 2>&1
}

extract_status() { tail -1; }
extract_body() { sed '$d'; }

# Unique test email per run
TS=$(date +%s)
TEST_EMAIL="smoketest+${TS}@varsityhub.test"
TEST_PASSWORD="TestPass123!"
TEST_USERNAME="smoke${TS}"

# ── Step 3: Health endpoints ──────────────────────────────────────────────
section "Step 3 · Health"

HEALTH_BODY=$(curl -sS --max-time 5 "$API_BASE/health" || true)
if [[ "$(echo "$HEALTH_BODY" | jq -r .status 2>/dev/null)" == "ok" ]]; then
  pass "GET /health → status:ok"
else
  fail "GET /health did not return {status:ok}" "$HEALTH_BODY"
fi

if [[ -n "$HEALTH_SECRET" ]]; then
  EMAIL_HEALTH=$(curl -sS --max-time 5 -H "X-Health-Check-Secret: $HEALTH_SECRET" "$API_BASE/health/email" || true)
  if echo "$EMAIL_HEALTH" | jq -e '.status=="ok"' >/dev/null 2>&1; then
    pass "GET /health/email → status:ok (SendGrid + templates configured)"
  elif echo "$EMAIL_HEALTH" | jq -e '.status=="degraded"' >/dev/null 2>&1; then
    missing=$(echo "$EMAIL_HEALTH" | jq -r '.missing_critical_templates | join(",")')
    fail "GET /health/email degraded" "missing: $missing"
  else
    fail "GET /health/email unexpected response" "$EMAIL_HEALTH"
  fi
else
  skip "GET /health/email" "HEALTH_CHECK_SECRET not set"
fi

# ── Step 4: Register a test fan ───────────────────────────────────────────
section "Step 4 · Register test user"

RESP=$(api POST /auth/register "$(jq -n --arg e "$TEST_EMAIL" --arg p "$TEST_PASSWORD" --arg u "$TEST_USERNAME" \
  '{email:$e, password:$p, username:$u, display_name:"Smoke Test", accept_terms:true, age_confirmed:true}')")
STATUS=$(echo "$RESP" | extract_status)
BODY=$(echo "$RESP" | extract_body)

if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  pass "POST /auth/register → $STATUS"
  USER_ID=$(echo "$BODY" | jq -r '.user.id // .id // empty')
  ACCESS_TOKEN=$(echo "$BODY" | jq -r '.access_token // empty')
  # Dev codes may be in response
  VERIFY_CODE=$(echo "$BODY" | jq -r '.verification_code // empty')
  [[ -n "$USER_ID" ]] && pass "registered user_id=$USER_ID" || fail "register: no user id in response" "$BODY"
else
  fail "POST /auth/register → $STATUS" "$BODY"
  echo "Cannot continue without registration"
  FAIL=$((FAIL + 1))
fi

# ── Step 5: Email verification (dev-codes only) ───────────────────────────
section "Step 5 · Email verification"

if [[ -n "${VERIFY_CODE:-}" ]]; then
  RESP=$(api POST /auth/verify-email "$(jq -n --arg e "$TEST_EMAIL" --arg c "$VERIFY_CODE" '{email:$e, code:$c}')")
  STATUS=$(echo "$RESP" | extract_status)
  if [[ "$STATUS" == "200" ]]; then
    pass "POST /auth/verify-email → 200"
  else
    fail "POST /auth/verify-email → $STATUS" "$(echo "$RESP" | extract_body)"
  fi
else
  skip "verify-email" "ENABLE_DEV_CODES not active on server; code not in response"
fi

# ── Step 6: Upgrade to coach → PENDING ────────────────────────────────────
section "Step 6 · Upgrade to coach (expect approval_status=PENDING)"

if [[ -n "${ACCESS_TOKEN:-}" ]]; then
  RESP=$(api POST /auth/upgrade-to-coach '{"plan":"rookie"}' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  if [[ "$STATUS" == "200" ]]; then
    pass "POST /auth/upgrade-to-coach → 200"
  else
    fail "POST /auth/upgrade-to-coach → $STATUS" "$BODY"
  fi

  RESP=$(api GET /auth/me '' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  APPROVAL=$(echo "$BODY" | jq -r '.approval_status // empty')
  ROLE=$(echo "$BODY" | jq -r '.preferences.role // empty')
  if [[ "$APPROVAL" == "PENDING" && "$ROLE" == "coach" ]]; then
    pass "GET /auth/me → role=coach, approval_status=PENDING"
  else
    fail "expected role=coach + approval_status=PENDING, got role=$ROLE status=$APPROVAL" "$BODY"
  fi
else
  skip "upgrade-to-coach" "no access_token"
fi

# ── Step 7: Server gates the user from coach endpoints ────────────────────
section "Step 7 · Server blocks unapproved coach"

if [[ -n "${ACCESS_TOKEN:-}" ]]; then
  RESP=$(api POST /teams '{"name":"Test Team"}' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  CODE=$(echo "$BODY" | jq -r '.code // empty')
  if [[ "$STATUS" == "403" && ("$CODE" == "APPROVAL_REQUIRED" || "$CODE" == "APPROVAL_REJECTED" || "$CODE" == "COACH_AGREEMENT_REQUIRED") ]]; then
    pass "POST /teams (as PENDING coach) → 403 $CODE"
  else
    fail "expected 403 APPROVAL_REQUIRED, got $STATUS code=$CODE" "$BODY"
  fi
fi

# ── Step 8: Cooldown + reapply sanity ─────────────────────────────────────
section "Step 8 · Reapply endpoint shape"

if [[ -n "${ACCESS_TOKEN:-}" ]]; then
  # User is PENDING, not REJECTED — expect NOT_REJECTED code
  RESP=$(api POST /auth/coach/reapply '' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  CODE=$(echo "$BODY" | jq -r '.code // empty')
  if [[ "$STATUS" == "400" && "$CODE" == "NOT_REJECTED" ]]; then
    pass "POST /auth/coach/reapply (not-rejected state) → 400 NOT_REJECTED"
  else
    fail "expected 400 NOT_REJECTED, got $STATUS code=$CODE" "$BODY"
  fi
fi

# ── Step 9: Onboarding skip prevention ────────────────────────────────────
section "Step 9 · Onboarding skip protection"

if [[ -n "${ACCESS_TOKEN:-}" ]]; then
  RESP=$(api PATCH /me/preferences '{"onboarding_completed":true}' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  CODE=$(echo "$BODY" | jq -r '.code // empty')
  if [[ "$STATUS" == "400" && "$CODE" == "ONBOARDING_VALIDATION_REQUIRED" ]]; then
    pass "PATCH /me/preferences onboarding_completed=true (unmet) → 400 ONBOARDING_VALIDATION_REQUIRED"
  else
    fail "expected 400 ONBOARDING_VALIDATION_REQUIRED, got $STATUS code=$CODE" "$BODY"
  fi
fi

# ── Step 10: Ad paywall (Rookie) ──────────────────────────────────────────
section "Step 10 · Ad paywall blocks Rookie"

if [[ -n "${ACCESS_TOKEN:-}" ]]; then
  RESP=$(api POST /ads '{"business_name":"Test","target_zip_code":"90210","duration_days":1}' "$ACCESS_TOKEN")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  CODE=$(echo "$BODY" | jq -r '.code // empty')
  if [[ "$STATUS" == "403" && "$CODE" == "PLAN_REQUIRED" ]]; then
    pass "POST /ads (Rookie) → 403 PLAN_REQUIRED"
  else
    fail "expected 403 PLAN_REQUIRED, got $STATUS code=$CODE" "$BODY"
  fi
fi

# ── Step 11: Banned-user post block (unreachable as fresh user, SKIP) ─────
section "Step 11 · Banned-user block (documented)"
skip "banned DM / post block" "requires pre-existing banned user fixture"

# ── Step 12: Admin operations ─────────────────────────────────────────────
section "Step 12 · Admin approve (requires ADMIN_EMAIL + ADMIN_PASSWORD)"

if [[ -z "$ADMIN_EMAIL" || -z "$ADMIN_PASSWORD" ]]; then
  skip "admin approval / rejection flow" "set ADMIN_EMAIL + ADMIN_PASSWORD to test"
else
  RESP=$(api POST /auth/login "$(jq -n --arg e "$ADMIN_EMAIL" --arg p "$ADMIN_PASSWORD" '{email:$e, password:$p}')")
  STATUS=$(echo "$RESP" | extract_status)
  BODY=$(echo "$RESP" | extract_body)
  ADMIN_TOKEN=$(echo "$BODY" | jq -r '.access_token // empty')
  if [[ -n "$ADMIN_TOKEN" ]]; then
    pass "admin login → token acquired"

    # Approve the test coach
    RESP=$(api POST "/admin/coaches/${USER_ID}/approve" '{"note":"smoke test auto-approve"}' "$ADMIN_TOKEN")
    STATUS=$(echo "$RESP" | extract_status)
    BODY=$(echo "$RESP" | extract_body)
    if [[ "$STATUS" == "200" ]]; then
      pass "POST /admin/coaches/:id/approve → 200"
    else
      fail "admin approve failed → $STATUS" "$BODY"
    fi

    # Verify coach now sees APPROVED
    sleep 1
    RESP=$(api GET /auth/me '' "$ACCESS_TOKEN")
    APPROVAL=$(echo "$RESP" | extract_body | jq -r '.approval_status // empty')
    if [[ "$APPROVAL" == "APPROVED" ]]; then
      pass "GET /auth/me → approval_status=APPROVED"
    else
      fail "expected APPROVED after admin approve, got $APPROVAL"
    fi

    # Coach still needs agreement — should 403 on coach endpoints
    RESP=$(api POST /teams '{"name":"Test Team"}' "$ACCESS_TOKEN")
    STATUS=$(echo "$RESP" | extract_status)
    CODE=$(echo "$RESP" | extract_body | jq -r '.code // empty')
    if [[ "$STATUS" == "403" && "$CODE" == "COACH_AGREEMENT_REQUIRED" ]]; then
      pass "approved coach without agreement → 403 COACH_AGREEMENT_REQUIRED (server gate working)"
    else
      fail "expected 403 COACH_AGREEMENT_REQUIRED, got $STATUS code=$CODE"
    fi

    # Accept agreement
    RESP=$(api PATCH /me/preferences "$(jq -n --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{coach_agreement_accepted_at:$t}')" "$ACCESS_TOKEN")
    STATUS=$(echo "$RESP" | extract_status)
    if [[ "$STATUS" == "200" ]]; then
      pass "PATCH /me/preferences coach_agreement_accepted_at → 200"
    else
      fail "agreement accept failed → $STATUS"
    fi
  else
    fail "admin login failed" "check ADMIN_EMAIL + ADMIN_PASSWORD"
  fi
fi

fi # SKIP_HTTP guard

# ── Summary ───────────────────────────────────────────────────────────────
printf "\n${B}════════════════════════════════${N}\n"
TOTAL=$((PASS + FAIL))
if [[ "$FAIL" == "0" ]]; then
  printf "${G}✓ All $TOTAL checks passed${N}\n"
  exit 0
else
  printf "${R}✗ $FAIL failed, $PASS passed (of $TOTAL)${N}\n"
  printf "\n${R}Failed checks:${N}\n"
  for f in "${FAIL_DETAILS[@]}"; do
    printf "  - %s\n" "$f"
  done
  exit 1
fi
