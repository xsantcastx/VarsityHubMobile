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
# DB URL must be injected at runtime — never hardcode a production credential.
# Get via: railway variables --service "Postgres-TnGR" --kv | grep DATABASE_PUBLIC_URL
DB="${DATABASE_URL:?Set DATABASE_URL env var before running. See server/scripts/e2e/README.md.}"
STAMP=$(date +%s)
EMAIL="session-test-${STAMP}@varsityhub-test.local"
PASSWORD="TestPass123!"

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
hdr()  { echo ""; echo "=== $1 ==="; }
FAILED=0

hdr "1. Register user (gets session A)"
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Session Test\",\"role\":\"fan\",\"dob\":\"1995-06-15\"}")
TOKEN_A=$(echo "$REG" | jq -r '.access_token // empty')
USER_ID=$(echo "$REG" | jq -r '.user.id // empty')
[ -n "$TOKEN_A" ] && pass "registered, got token_A" || { fail "register: $REG"; exit 1; }

hdr "2. Use token_A — should work"
ME_A=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A" = "200" ] && pass "/me with token_A → 200" || fail "/me token_A → $ME_A"

hdr "3. Login again as same user (token_B should coexist with token_A)"
LOGIN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN_B=$(echo "$LOGIN" | jq -r '.access_token // empty')
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
[ -n "$PW_OK" ] && pass "password changed" || fail "password change: $PW"

ME_A3=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A3" = "401" ] && pass "token_A invalid after password change" || fail "token_A after password change → $ME_A3"

ME_B2=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_B")
[ "$ME_B2" = "401" ] && pass "token_B invalid after password change" || fail "token_B after password change → $ME_B2"

hdr "7. Login with new password — token_C should work"
LOGIN2=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"${PASSWORD}X\"}")
TOKEN_C=$(echo "$LOGIN2" | jq -r '.access_token // empty')
[ -n "$TOKEN_C" ] && pass "logged in with new password, got token_C" || fail "relogin: $LOGIN2"
ME_C=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_C")
[ "$ME_C" = "200" ] && pass "/me with token_C → 200" || fail "/me token_C → $ME_C"

hdr "CLEANUP"
psql "$DB" -c "DELETE FROM \"RefreshToken\" WHERE user_id='$USER_ID'; DELETE FROM \"User\" WHERE id='$USER_ID';" >/dev/null 2>&1
pass "test user deleted"

if [ "$FAILED" = "0" ]; then
  echo ""
  echo "🎉 SESSION INVALIDATION POLICY VERIFIED"
  exit 0
else
  echo ""
  echo "❌ session policy check failed — review above"
  exit 1
fi
