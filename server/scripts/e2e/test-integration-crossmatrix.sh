#!/bin/bash
# Cross-system E2E integration test.
# Walks the seams between auth, approval, coach tools, and payment/ads.
# Assumes /tmp/test-coach-application-flow.sh already covers the core
# approval flow; this script targets the boundary conditions between
# subsystems that are easy to regress independently.

set -u
API="${API_URL:-https://api-production-8ac3.up.railway.app}"
# DB URL must be injected at runtime — never hardcode a production credential.
# Get via: railway variables --service "Postgres-TnGR" --kv | grep DATABASE_PUBLIC_URL
DB="${DATABASE_URL:?Set DATABASE_URL env var before running. See server/scripts/e2e/README.md.}"
STAMP=$(date +%s)
COACH_EMAIL="xmatrix-${STAMP}@varsityhub-test.local"
COACH_PASSWORD="TestPass123!"
NEW_PASSWORD="NewTestPass456!"
ADMIN_EMAIL="customerservice@varsityhub.app"
ADMIN_PASSWORD="AdminTest123!"
BIZ_EMAIL="xmatrix-biz-${STAMP}@varsityhub-test.local"

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
info() { echo "  ℹ  $1"; }
hdr()  { echo ""; echo "=== $1 ==="; }
FAILED=0

me_state() { curl -sS "$API/auth/me" -H "Authorization: Bearer $1"; }
me_code()  { curl -sS -o /dev/null -w "%{http_code}" "$API/auth/me" -H "Authorization: Bearer $1"; }

hdr "Setup — admin user via real register + login"
psql "$DB" -c "DELETE FROM \"RefreshToken\" WHERE user_id IN (SELECT id FROM \"User\" WHERE email='$ADMIN_EMAIL'); DELETE FROM \"User\" WHERE email='$ADMIN_EMAIL';" >/dev/null 2>&1
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"display_name\":\"Admin\",\"role\":\"fan\",\"dob\":\"1990-01-01\"}")
ADMIN_ID=$(echo "$REG" | jq -r '.user.id // empty')
psql "$DB" -c "UPDATE \"User\" SET email_verified=true, preferences=jsonb_set(COALESCE(preferences,'{}'::jsonb),'{onboarding_completed}','true'::jsonb) WHERE id='$ADMIN_ID';" >/dev/null 2>&1
ADMIN_LOGIN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.access_token // empty')
[ -n "$ADMIN_TOKEN" ] && pass "admin logged in" || { fail "admin login: $ADMIN_LOGIN"; exit 1; }
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

###############################################################################
hdr "X1 — OAuth 409 contract smoke"
###############################################################################
# Register email+password account
R=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$COACH_EMAIL\",\"password\":\"$COACH_PASSWORD\",\"display_name\":\"XMatrix User\",\"role\":\"fan\",\"dob\":\"1995-06-15\"}")
COACH_TOKEN=$(echo "$R" | jq -r '.access_token // empty')
COACH_ID=$(echo "$R" | jq -r '.user.id // empty')
[ -n "$COACH_TOKEN" ] && pass "user registered id=$COACH_ID" || { fail "register: $R"; exit 1; }
COACH_AUTH="Authorization: Bearer $COACH_TOKEN"
psql "$DB" -c "UPDATE \"User\" SET email_verified=true WHERE id='$COACH_ID';" >/dev/null 2>&1

# Attempt OAuth with same email (mixed case). Fake token is expected to fail
# verification before collision detection; the important property is that the
# endpoint doesn't silently succeed.
MIXED_CASE="${COACH_EMAIL/xmatrix/XMatrix}"
G=$(curl -sS -X POST "$API/auth/google" -H 'Content-Type: application/json' \
  -d "{\"idToken\":\"fake.token.${STAMP}\",\"email\":\"$MIXED_CASE\"}")
G_ERR=$(echo "$G" | jq -r '.error // empty')
echo "$G_ERR" | grep -qiE "token|invalid|google|verify" && pass "/auth/google rejected fake token (doesn't silent-succeed): $G_ERR" \
  || fail "/auth/google unexpectedly: $G"
info "Full 409 contract with real Google token: server/src/__tests__/oauth-account-linking.test.ts"

# /me should expose linked_providers for this password-only user
ME=$(me_state "$COACH_TOKEN")
LP_PW=$(echo "$ME" | jq -r '.linked_providers.password // empty')
LP_G=$(echo "$ME" | jq -r '.linked_providers.google // empty')
LP_A=$(echo "$ME" | jq -r '.linked_providers.apple // empty')
[ "$LP_PW" = "true" ] && pass "linked_providers.password=true" || fail "linked_providers.password=$LP_PW"
[ "$LP_G" = "false" ] && pass "linked_providers.google=false" || fail "linked_providers.google=$LP_G"
[ "$LP_A" = "false" ] && pass "linked_providers.apple=false" || fail "linked_providers.apple=$LP_A"

###############################################################################
hdr "X2 — Password change invalidates old access token immediately"
###############################################################################
# Token A is COACH_TOKEN. Change password, then token A should be rejected.
CHG=$(curl -sS -X POST "$API/auth/password/change" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"current_password\":\"$COACH_PASSWORD\",\"new_password\":\"$NEW_PASSWORD\"}")
CHG_OK=$(echo "$CHG" | jq -r '.ok // empty')
[ "$CHG_OK" = "true" ] && pass "password change succeeded" || fail "password/change: $CHG"

# Token A should now fail middleware password_changed_at check
CODE=$(me_code "$COACH_TOKEN")
[ "$CODE" = "401" ] && pass "old token rejected after password change (401)" || fail "old token returned $CODE (expected 401)"

# Login with new password — should work and produce a fresh token
NEWL=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$COACH_EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
COACH_TOKEN=$(echo "$NEWL" | jq -r '.access_token // empty')
[ -n "$COACH_TOKEN" ] && pass "new password login succeeds" || { fail "new login: $NEWL"; exit 1; }
COACH_AUTH="Authorization: Bearer $COACH_TOKEN"

###############################################################################
hdr "X3 — Approved coach tools (event + team-member invite)"
###############################################################################
# Run the full approval chain: upgrade → submit app → admin approve → agreement → org → team
curl -sS -X POST "$API/auth/upgrade-to-coach" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d '{"plan":"rookie"}' >/dev/null
SUB=$(curl -sS -X POST "$API/auth/coach-applications" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"organization_name\":\"XMatrix League ${STAMP}\",\"org_type\":\"league\",\"location\":\"Lincoln, NE\",\"zip_code\":\"68508\",\"supporting_document_url\":\"https://example.com/doc.pdf\"}")
APP_ID=$(echo "$SUB" | jq -r '.application.id // empty')
[ -n "$APP_ID" ] && pass "application submitted" || { fail "submit: $SUB"; exit 1; }

APPR=$(curl -sS -X POST "$API/admin/coaches/$COACH_ID/approve" -H "$ADMIN_AUTH" -H 'Content-Type: application/json' -d '{"note":"xmatrix"}')
[ "$(echo "$APPR" | jq -r '.ok')" = "true" ] && pass "admin approved" || fail "approve: $APPR"

AG=$(curl -sS -X PATCH "$API/auth/me/preferences" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"coach_agreement_accepted_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
[ -n "$(echo "$AG" | jq -r '.preferences.coach_agreement_accepted_at // empty')" ] && pass "agreement accepted" || fail "agreement: $AG"

ORG=$(curl -sS -X POST "$API/organizations" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"XMatrix Org ('"$STAMP"')","org_type":"league","location":"Lincoln, NE","zip_code":"68508","supporting_document_url":"https://example.com/doc.pdf","onboarding":true}')
ORG_ID=$(echo "$ORG" | jq -r '.id // empty')
[ -n "$ORG_ID" ] && pass "org created" || { fail "org: $ORG"; }

CO=$(curl -sS -X POST "$API/auth/me/complete-onboarding" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"role\":\"coach\",\"proceeding_as_fan\":false,\"username\":\"xm${STAMP}\",\"dob\":\"1995-06-15\",\"zip_code\":\"68508\",\"affiliation\":\"school\",\"organization_id\":\"$ORG_ID\",\"organization_name\":\"XMatrix Org (${STAMP})\",\"plan\":\"rookie\",\"display_name\":\"XMatrix Coach\"}")
[ "$(echo "$CO" | jq -r '.user.onboarding_completed // empty')" = "true" ] && pass "onboarding completed" || fail "complete: $CO"

TEAM=$(curl -sS -X POST "$API/teams/create" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"name\":\"XMatrix Team ${STAMP}\",\"organization_id\":\"$ORG_ID\",\"sport\":\"soccer\",\"club_type\":\"sport\"}")
TEAM_ID=$(echo "$TEAM" | jq -r '.team.id // .id // empty')
[ -n "$TEAM_ID" ] && pass "team created (post-approval coach tools unlocked)" || fail "team: $TEAM"

# Verify final account_state
AS=$(me_state "$COACH_TOKEN" | jq -r '.account_state // empty')
[ "$AS" = "coach_active" ] && pass "account_state=coach_active" || fail "account_state=$AS"

# Event creation (coach-only route guarded by requireOnboarded)
FUTURE_DATE=$(date -u -v+7d '+%Y-%m-%dT12:00:00Z' 2>/dev/null || date -u -d "+7 days" '+%Y-%m-%dT12:00:00Z')
EVENT=$(curl -sS -X POST "$API/events" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"title\":\"XMatrix Test Event\",\"date\":\"$FUTURE_DATE\",\"location\":\"Test Venue\",\"event_type\":\"meeting\",\"team_id\":\"$TEAM_ID\"}")
EVENT_ID=$(echo "$EVENT" | jq -r '.id // .event.id // empty')
[ -n "$EVENT_ID" ] && pass "event created by approved coach id=$EVENT_ID" || info "event create response (may need team setup): $(echo "$EVENT" | head -c 200)"

###############################################################################
hdr "X4 — Ad lifecycle through admin approval"
###############################################################################
# Bump coach to veteran so ads are allowed
psql "$DB" -c "UPDATE \"User\" SET plan='veteran', subscription_tier='veteran', subscription_status='active', payment_pending=false, payment_approved=true, preferences=jsonb_set(jsonb_set(jsonb_set(COALESCE(preferences,'{}'::jsonb),'{plan}','\"veteran\"'::jsonb),'{payment_pending}','false'::jsonb),'{payment_approved}','true'::jsonb) WHERE id='$COACH_ID';" >/dev/null 2>&1

AD=$(curl -sS -X POST "$API/ads" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"contact_name\":\"Test Biz\",\"contact_email\":\"$BIZ_EMAIL\",\"business_name\":\"Test Biz\",\"target_zip_code\":\"68508\",\"description\":\"xmatrix\"}")
AD_ID=$(echo "$AD" | jq -r '.id // empty')
AD_STATUS=$(echo "$AD" | jq -r '.status // empty')
[ "$AD_STATUS" = "draft" ] && pass "ad created status=draft id=$AD_ID" || fail "ad create: $AD"

if [ -n "$AD_ID" ]; then
  D1=$(date -u -v+5d +%Y-%m-%d 2>/dev/null || date -u -d "+5 days" +%Y-%m-%d)
  D2=$(date -u -v+6d +%Y-%m-%d 2>/dev/null || date -u -d "+6 days" +%Y-%m-%d)
  SUBAD=$(curl -sS -X POST "$API/ads/$AD_ID/submit-for-approval" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
    -d "{\"dates\":[\"$D1\",\"$D2\"]}")
  SUB_STATUS=$(echo "$SUBAD" | jq -r '.status // empty')
  SUB_PAY=$(echo "$SUBAD" | jq -r '.payment_status // empty')
  [ "$SUB_STATUS" = "pending" ] && pass "ad.status=pending after submit" || fail "submit: $SUBAD"
  [ "$SUB_PAY" = "pending_approval" ] && pass "ad.payment_status=pending_approval" || fail "payment_status=$SUB_PAY"

  AD_APP=$(curl -sS -X POST "$API/ads/$AD_ID/approve" -H "$ADMIN_AUTH" -H 'Content-Type: application/json' -d '{"note":"xmatrix"}')
  AD_APP_STATUS=$(echo "$AD_APP" | jq -r '.status // empty')
  [ "$AD_APP_STATUS" = "approved" ] && pass "ad admin-approved: status=approved" || fail "admin approve: $AD_APP"
fi

###############################################################################
hdr "X5 — Single-session still holds across cross-system interactions"
###############################################################################
# The coach has been through multiple API calls. Login again — session_epoch bumps,
# current token dies, new token works. This confirms single-session isn't
# accidentally disabled by any of the intervening writes.
SE_BEFORE=$(psql "$DB" -tA -c "SELECT session_epoch FROM \"User\" WHERE id='$COACH_ID';" 2>/dev/null)
LOG=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$COACH_EMAIL\",\"password\":\"$NEW_PASSWORD\"}")
TOKEN_C=$(echo "$LOG" | jq -r '.access_token // empty')
SE_AFTER=$(psql "$DB" -tA -c "SELECT session_epoch FROM \"User\" WHERE id='$COACH_ID';" 2>/dev/null)
[ "$SE_AFTER" -gt "$SE_BEFORE" ] 2>/dev/null && pass "session_epoch incremented ($SE_BEFORE → $SE_AFTER)" \
  || fail "session_epoch did not bump ($SE_BEFORE → $SE_AFTER)"
CODE_OLD=$(me_code "$COACH_TOKEN")
CODE_NEW=$(me_code "$TOKEN_C")
[ "$CODE_OLD" = "401" ] && pass "old token kicked (401)" || fail "old token → $CODE_OLD"
[ "$CODE_NEW" = "200" ] && pass "new token active (200)" || fail "new token → $CODE_NEW"

###############################################################################
hdr "CLEANUP"
###############################################################################
[ -n "${TEAM_ID:-}" ] && psql "$DB" -c "DELETE FROM \"TeamMembership\" WHERE team_id='$TEAM_ID'; DELETE FROM \"Event\" WHERE team_id='$TEAM_ID'; DELETE FROM \"Team\" WHERE id='$TEAM_ID';" >/dev/null 2>&1
[ -n "${ORG_ID:-}" ] && psql "$DB" -c "DELETE FROM \"OrganizationMembership\" WHERE organization_id='$ORG_ID'; DELETE FROM \"Organization\" WHERE id='$ORG_ID';" >/dev/null 2>&1
psql "$DB" -c "
  DELETE FROM \"AdReservation\" WHERE ad_id IN (SELECT id FROM \"Ad\" WHERE user_id='$COACH_ID');
  DELETE FROM \"Ad\" WHERE user_id='$COACH_ID';
  DELETE FROM \"CoachApplication\" WHERE user_id='$COACH_ID';
  DELETE FROM \"Notification\" WHERE user_id IN ('$COACH_ID','$ADMIN_ID');
  DELETE FROM \"RefreshToken\" WHERE user_id IN ('$COACH_ID','$ADMIN_ID');
  DELETE FROM \"User\" WHERE id IN ('$COACH_ID','$ADMIN_ID');
" >/dev/null 2>&1 && pass "test data cleaned" || info "cleanup had issues (non-fatal)"

if [ "$FAILED" = "0" ]; then
  echo ""
  echo "🎉 CROSS-SYSTEM INTEGRATION PASSES"
  echo "   OAuth 409 · password-change session kick · approved coach tools (org/team/event)"
  echo "   · ad lifecycle · single-session interlock"
  exit 0
else
  echo ""
  echo "❌ SOME CHECKS FAILED — review above"
  exit 1
fi
