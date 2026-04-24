#!/bin/bash
# Verify single-session enforcement in production.
# 1. Register a user → get access_token_A
# 2. /auth/me with token_A → 200
# 3. Login same user → get access_token_B (new session)
# 4. /auth/me with token_A → should be 401 (session invalidated)
# 5. /auth/me with token_B → 200

set -u
API="https://api-production-8ac3.up.railway.app"
DB="postgresql://postgres:SOVoxCsjuXvcyRzyNFsiQWhuxRtHCUyU@turntable.proxy.rlwy.net:37170/railway"
STAMP=$(date +%s)
EMAIL="session-test-${STAMP}@varsityhub-test.local"
PASSWORD="TestPass123!"

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
hdr()  { echo ""; echo "=== $1 ==="; }
FAILED=0

hdr "1. Register user (gets session A with se=0)"
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Session Test\",\"role\":\"fan\",\"dob\":\"1995-06-15\"}")
TOKEN_A=$(echo "$REG" | jq -r '.access_token // empty')
USER_ID=$(echo "$REG" | jq -r '.user.id // empty')
[ -n "$TOKEN_A" ] && pass "registered, got token_A" || { fail "register: $REG"; exit 1; }

# Inspect the JWT payload
SE_A=$(echo "$TOKEN_A" | awk -F'.' '{print $2}' | base64 -d 2>/dev/null | jq -r '.se // "MISSING"')
[ "$SE_A" = "0" ] && pass "token_A carries se=0 claim" || fail "token_A.se=$SE_A (expected 0)"

hdr "2. Use token_A — should work"
ME_A=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A" = "200" ] && pass "/me with token_A → 200" || fail "/me token_A → $ME_A"

hdr "3. Login again as same user (bumps epoch, gets session B with se=1)"
LOGIN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN_B=$(echo "$LOGIN" | jq -r '.access_token // empty')
[ -n "$TOKEN_B" ] && pass "logged in, got token_B" || { fail "login: $LOGIN"; exit 1; }

SE_B=$(echo "$TOKEN_B" | awk -F'.' '{print $2}' | base64 -d 2>/dev/null | jq -r '.se // "MISSING"')
[ "$SE_B" = "1" ] && pass "token_B carries se=1 claim (epoch bumped)" || fail "token_B.se=$SE_B (expected 1)"

# Verify DB
EPOCH_DB=$(psql "$DB" -tA -c "SELECT session_epoch FROM \"User\" WHERE id='$USER_ID';")
[ "$EPOCH_DB" = "1" ] && pass "DB: User.session_epoch=1" || fail "DB epoch=$EPOCH_DB"

hdr "4. Use token_A — should now be rejected (single-session enforced)"
ME_A2=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_A")
[ "$ME_A2" = "401" ] && pass "/me with stale token_A → 401 (KICKED)" || fail "/me token_A → $ME_A2 (expected 401)"

hdr "5. Use token_B — should still work"
ME_B=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_B")
[ "$ME_B" = "200" ] && pass "/me with token_B → 200" || fail "/me token_B → $ME_B"

hdr "6. Third login (session C, se=2) should kick B too"
LOGIN2=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN_C=$(echo "$LOGIN2" | jq -r '.access_token // empty')
SE_C=$(echo "$TOKEN_C" | awk -F'.' '{print $2}' | base64 -d 2>/dev/null | jq -r '.se // "MISSING"')
[ "$SE_C" = "2" ] && pass "token_C.se=2 (epoch incremented again)" || fail "token_C.se=$SE_C"

ME_B2=$(curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $TOKEN_B")
[ "$ME_B2" = "401" ] && pass "/me with now-stale token_B → 401" || fail "/me token_B → $ME_B2"

hdr "CLEANUP"
psql "$DB" -c "DELETE FROM \"RefreshToken\" WHERE user_id='$USER_ID'; DELETE FROM \"User\" WHERE id='$USER_ID';" >/dev/null 2>&1
pass "test user deleted"

if [ "$FAILED" = "0" ]; then
  echo ""
  echo "🎉 SINGLE-SESSION ENFORCEMENT VERIFIED"
  exit 0
else
  echo ""
  echo "❌ enforcement failed — review above"
  exit 1
fi
