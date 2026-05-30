#!/bin/bash
# Verify the current session policy in production.
# 1. Register a user → get access_token_A
# 2. /auth/me with token_A → 200
# 3. Login same user → get access_token_B
# 4. /auth/me with BOTH token_A and token_B → 200 (relogin does not kill prior sessions)
# 5. Change password with token_B
# 6. /auth/me with token_A and token_B → 401
# 7. Login again with new password → token_C works

set -u
API="${API_URL:-https://api-production-8ac3.up.railway.app}"
DB="${DATABASE_URL:-}"
STAMP=$(date +%s)
EMAIL="session-test-${STAMP}@varsityhub-test.local"
PASSWORD="TestPass123!"
CURRENT_PASSWORD="$PASSWORD"
ACTIVE_TOKEN=""
USER_ID=""

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
hdr()  { echo ""; echo "=== $1 ==="; }
FAILED=0

cleanup() {
  hdr "CLEANUP"

  local cleanup_token="${ACTIVE_TOKEN:-}"
  if [ -z "$cleanup_token" ] && [ -n "${CURRENT_PASSWORD:-}" ]; then
    local login
    login=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
      -d "{\"email\":\"$EMAIL\",\"password\":\"$CURRENT_PASSWORD\"}")
    cleanup_token=$(echo "$login" | jq -r '.access_token // empty')
  fi

  if [ -n "$cleanup_token" ]; then
    local delete_res delete_ok
    delete_res=$(curl -sS -X POST "$API/auth/account/delete" \
      -H "Authorization: Bearer $cleanup_token" \
      -H 'Content-Type: application/json' \
      -d "{\"password\":\"$CURRENT_PASSWORD\",\"delete_confirmation\":\"DELETE\"}")
    delete_ok=$(echo "$delete_res" | jq -r '.ok // empty')
    if [ "$delete_ok" = "true" ]; then
      pass "test user deleted via API"
      return
    fi
    fail "API cleanup failed: $delete_res"
  fi

  if [ -n "$DB" ] && [ -n "$USER_ID" ]; then
    psql "$DB" -c "DELETE FROM \"RefreshToken\" WHERE user_id='$USER_ID'; DELETE FROM \"User\" WHERE id='$USER_ID';" >/dev/null 2>&1 \
      && pass "test user deleted via DB fallback" \
      || fail "DB cleanup failed for user_id=$USER_ID"
    return
  fi

  fail "cleanup skipped: no valid token and no DATABASE_URL fallback"
}

trap cleanup EXIT

hdr "1. Register user (gets session A)"
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Session Test\",\"role\":\"fan\",\"dob\":\"1995-06-15\"}")
TOKEN_A=$(echo "$REG" | jq -r '.access_token // empty')
USER_ID=$(echo "$REG" | jq -r '.user.id // empty')
ACTIVE_TOKEN="$TOKEN_A"
[ -n "$TOKEN_A" ] && pass "registered, got token_A" || { fail "register: $REG"; exit 1; }

hdr "2. Use token_A — should work"
ME_A=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A" = "200" ] && pass "/me with token_A → 200" || fail "/me token_A → $ME_A"

hdr "3. Login again as same user (token_B should coexist with token_A)"
LOGIN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN_B=$(echo "$LOGIN" | jq -r '.access_token // empty')
[ -n "$TOKEN_B" ] && ACTIVE_TOKEN="$TOKEN_B"
[ -n "$TOKEN_B" ] && pass "logged in, got token_B" || { fail "login: $LOGIN"; exit 1; }

hdr "4. Use token_A — should still work after relogin"
ME_A2=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A2" = "200" ] && pass "/me with prior token_A → 200" || fail "/me token_A → $ME_A2 (expected 200)"

hdr "5. Use token_B — should still work"
ME_B=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_B")
[ "$ME_B" = "200" ] && pass "/me with token_B → 200" || fail "/me token_B → $ME_B"

hdr "6. Change password — should invalidate all prior tokens"
PW=$(curl -sS -X POST "$API/auth/password/change" -H "$(
  printf 'Authorization: Bearer %s' "$TOKEN_B"
)" -H 'Content-Type: application/json' \
  -d "{\"current_password\":\"$PASSWORD\",\"new_password\":\"${PASSWORD}X\"}")
PW_OK=$(echo "$PW" | jq -r '.ok // .message // empty')
[ -n "$PW_OK" ] && CURRENT_PASSWORD="${PASSWORD}X"
[ -n "$PW_OK" ] && pass "password changed" || fail "password change: $PW"

ME_A3=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A3" = "401" ] && pass "token_A invalid after password change" || fail "token_A after password change → $ME_A3"

ME_B2=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_B")
[ "$ME_B2" = "401" ] && pass "token_B invalid after password change" || fail "token_B after password change → $ME_B2"

hdr "7. Login with new password — token_C should work"
LOGIN2=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"${PASSWORD}X\"}")
TOKEN_C=$(echo "$LOGIN2" | jq -r '.access_token // empty')
[ -n "$TOKEN_C" ] && ACTIVE_TOKEN="$TOKEN_C"
[ -n "$TOKEN_C" ] && pass "logged in with new password, got token_C" || fail "relogin: $LOGIN2"
ME_C=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_C")
[ "$ME_C" = "200" ] && pass "/me with token_C → 200" || fail "/me token_C → $ME_C"

if [ "$FAILED" = "0" ]; then
  echo ""
  echo "🎉 SESSION INVALIDATION POLICY VERIFIED"
  exit 0
else
  echo ""
  echo "❌ session policy check failed — review above"
  exit 1
fi
