#!/bin/bash
# E2E test of the post-refactor coach-application flow.
# Walks the full canonical state machine: fan → coach_basic_info_required →
# application submitted → admin approve → coach agreement →
# final setup (org + team) → coach_active.
# Every assertion hits the real server via HTTP, with /auth/me as the canonical state oracle.

set -u
API="${API_URL:-https://api-production-8ac3.up.railway.app}"
# DB URL must be injected at runtime only when you intentionally create a
# temporary admin connection. Never hardcode a production credential here.
DB="${DATABASE_URL:?Set DATABASE_URL to a temporary admin connection string before running. See server/scripts/e2e/README.md.}"
: "${ADMIN_EMAIL:?Set ADMIN_EMAIL to an existing verified admin account email before running.}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD to that admin account password before running.}"
STAMP=$(date +%s)
COACH_EMAIL="coach-app-test-${STAMP}@varsityhub-test.local"
COACH_PASSWORD="TestPass123!"

pass() { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; FAILED=1; }
info() { echo "  ℹ  $1"; }
hdr()  { echo ""; echo "=== $1 ==="; }
FAILED=0

# Read account_state + next_step from /auth/me
me_state() {
  local tok=$1
  curl -sS "$API/auth/me" -H "Authorization: Bearer $tok"
}

hdr "Setup — temp admin user via real register + login"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
if [ -n "$ADMIN_TOKEN" ]; then
  pass "admin token provided by workflow preflight"
else
  ADMIN_LOGIN=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
  ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | jq -r '.access_token // empty')
  [ -n "$ADMIN_TOKEN" ] && pass "admin logged in" || { fail "admin login: $ADMIN_LOGIN"; exit 1; }
fi
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"
ADMIN_ID=$(psql "$DB" -tA -c "SELECT id FROM \"User\" WHERE lower(email)=lower('$ADMIN_EMAIL') LIMIT 1;" 2>/dev/null)
[ -n "$ADMIN_ID" ] && pass "admin user resolved id=$ADMIN_ID" || { fail "admin user lookup failed"; exit 1; }

hdr "T1 — Register as fan (canonical UX), check initial state"
REG=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$COACH_EMAIL\",\"password\":\"$COACH_PASSWORD\",\"display_name\":\"Test Coach\",\"role\":\"fan\",\"dob\":\"1995-06-15\"}")
COACH_TOKEN=$(echo "$REG" | jq -r '.access_token // empty')
COACH_ID=$(echo "$REG" | jq -r '.user.id // empty')
[ -n "$COACH_TOKEN" ] && pass "user registered id=$COACH_ID" || { fail "register: $REG"; exit 1; }
COACH_AUTH="Authorization: Bearer $COACH_TOKEN"

# Flip email_verified so downstream coach endpoints admit us
psql "$DB" -c "UPDATE \"User\" SET email_verified=true WHERE id='$COACH_ID';" >/dev/null 2>&1

ME=$(me_state "$COACH_TOKEN")
LP=$(echo "$ME" | jq -c '.linked_providers // empty')
[ -n "$LP" ] && pass "linked_providers exposed on /me: $LP" || fail "linked_providers missing"

hdr "T1b — Upgrade to coach (the 'start application' trigger)"
UPGRADE=$(curl -sS -X POST "$API/auth/upgrade-to-coach" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d '{"plan":"rookie"}')
UPGRADE_OK=$(echo "$UPGRADE" | jq -r '.ok // .user.role // empty')
[ -n "$UPGRADE_OK" ] && pass "upgrade-to-coach succeeded" || fail "upgrade: $UPGRADE"

ME=$(me_state "$COACH_TOKEN")
AS=$(echo "$ME" | jq -r '.account_state // empty')
NS=$(echo "$ME" | jq -r '.next_step // empty')
[ "$AS" = "coach_basic_info_required" ] && pass "account_state=coach_basic_info_required" || fail "account_state=$AS (expected coach_basic_info_required)"
[ "$NS" = "/onboarding/step-2-basic" ] && pass "next_step=/onboarding/step-2-basic" || fail "next_step=$NS"

hdr "T2 — Submit coach application (canonical application flow)"
SUB=$(curl -sS -X POST "$API/auth/coach-applications" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"organization_name\":\"Test League ${STAMP}\",\"org_type\":\"league\",\"location\":\"Lincoln, NE\",\"zip_code\":\"68508\",\"supporting_document_url\":\"https://example.com/doc.pdf\"}")
APP_ID=$(echo "$SUB" | jq -r '.application.id // empty')
APP_STATUS=$(echo "$SUB" | jq -r '.application.status // empty')
[ -n "$APP_ID" ] && pass "application created id=$APP_ID" || { fail "submit: $SUB"; exit 1; }
[ "$APP_STATUS" = "submitted" ] && pass "application.status=submitted" || fail "application.status=$APP_STATUS"

ME=$(me_state "$COACH_TOKEN")
AS=$(echo "$ME" | jq -r '.account_state // empty')
NS=$(echo "$ME" | jq -r '.next_step // empty')
APP_ON_ME=$(echo "$ME" | jq -r '.coach_application.status // empty')
[ "$AS" = "coach_application_submitted" ] && pass "account_state=coach_application_submitted" || fail "account_state=$AS"
[ "$NS" = "/onboarding/league-pending-approval" ] && pass "next_step=/onboarding/league-pending-approval" || fail "next_step=$NS"
[ "$APP_ON_ME" = "submitted" ] && pass "/me.coach_application.status=submitted" || fail "coach_app status on /me=$APP_ON_ME"

hdr "T3 — Coach-only endpoint blocked while pending"
# Team creation requires approved coach — should 403 here
GATED=$(curl -sS -X POST "$API/teams/create" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Should Fail","organization_id":"bogus"}')
GATED_CODE=$(echo "$GATED" | jq -r '.code // empty')
GATED_ERR=$(echo "$GATED" | jq -r '.error // empty')
echo "$GATED_CODE $GATED_ERR" | grep -qiE "APPROVAL_REQUIRED|onboarding|pending|coach" && pass "pre-approval team-create blocked ($GATED_CODE / $GATED_ERR)" \
  || fail "team-create didn't block: $GATED"

hdr "T4 — Admin approves via real /admin/coaches/:id/approve"
APPROVE=$(curl -sS -X POST "$API/admin/coaches/$COACH_ID/approve" -H "$ADMIN_AUTH" -H 'Content-Type: application/json' \
  -d '{"note":"e2e test approve"}')
APPROVE_OK=$(echo "$APPROVE" | jq -r '.ok // empty')
[ "$APPROVE_OK" = "true" ] && pass "admin approve returned ok=true" || fail "approve: $APPROVE"

# Verify CoachApplication status updated at DB
APP_DB_STATUS=$(psql "$DB" -tA -c "SELECT status FROM \"CoachApplication\" WHERE id='$APP_ID';")
[ "$APP_DB_STATUS" = "approved" ] && pass "DB: CoachApplication.status=approved" || fail "DB app status=$APP_DB_STATUS"

# /me should now route the coach through coach agreement
ME=$(me_state "$COACH_TOKEN")
AS=$(echo "$ME" | jq -r '.account_state // empty')
NS=$(echo "$ME" | jq -r '.next_step // empty')
case "$AS" in
  coach_agreement_required|coach_final_setup_required)
    pass "account_state=$AS (post-approval routing)"
    ;;
  *)
    fail "account_state=$AS (expected coach_agreement_required or coach_final_setup_required)"
    ;;
esac

hdr "T5 — Accept coach agreement"
AG=$(curl -sS -X PATCH "$API/auth/me/preferences" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d "{\"coach_agreement_accepted_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
AG_AT=$(echo "$AG" | jq -r '.preferences.coach_agreement_accepted_at // empty')
[ -n "$AG_AT" ] && pass "coach_agreement_accepted_at persisted: $AG_AT" || fail "agreement PATCH: $AG"

# Post-agreement, /me should indicate final setup required
ME=$(me_state "$COACH_TOKEN")
AS=$(echo "$ME" | jq -r '.account_state // empty')
NS=$(echo "$ME" | jq -r '.next_step // empty')
[ "$AS" = "coach_final_setup_required" ] && pass "account_state=coach_final_setup_required" || fail "account_state=$AS after agreement"
[ "$NS" = "/onboarding/step-3-league" ] && pass "next_step=/onboarding/step-3-league (org creation)" || fail "next_step=$NS"

hdr "T6 — Create the actual Organization (post-approval final setup)"
ORG=$(curl -sS -X POST "$API/organizations" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Test League ('"$STAMP"')","org_type":"league","location":"Lincoln, NE","zip_code":"68508","supporting_document_url":"https://example.com/doc.pdf","onboarding":true}')
ORG_ID=$(echo "$ORG" | jq -r '.id // empty')
[ -n "$ORG_ID" ] && pass "org created id=$ORG_ID" || { fail "org create: $ORG"; ORG_ID=""; }

hdr "T7 — Create team inside the new org"
if [ -n "$ORG_ID" ]; then
  # completeOnboarding + team — final setup unlocks these
  CO=$(curl -sS -X POST "$API/auth/me/complete-onboarding" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
    -d "{\"role\":\"coach\",\"proceeding_as_fan\":false,\"username\":\"coach${STAMP}\",\"dob\":\"1995-06-15\",\"zip_code\":\"68508\",\"affiliation\":\"school\",\"organization_id\":\"$ORG_ID\",\"organization_name\":\"Test League (${STAMP})\",\"plan\":\"rookie\",\"display_name\":\"Test Coach\"}")
  CO_OK=$(echo "$CO" | jq -r '.user.onboarding_completed // empty')
  [ "$CO_OK" = "true" ] && pass "completeOnboarding → onboarding_completed=true" || fail "completeOnboarding: $CO"

  TEAM=$(curl -sS -X POST "$API/teams/create" -H "$COACH_AUTH" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Test Team ${STAMP}\",\"organization_id\":\"$ORG_ID\",\"sport\":\"soccer\",\"club_type\":\"sport\"}")
  TEAM_ID=$(echo "$TEAM" | jq -r '.team.id // .id // empty')
  [ -n "$TEAM_ID" ] && pass "team created id=$TEAM_ID" || fail "team: $TEAM"
fi

hdr "T8 — Final state: coach_active, coach-only endpoints accessible"
ME=$(me_state "$COACH_TOKEN")
AS=$(echo "$ME" | jq -r '.account_state // empty')
NS=$(echo "$ME" | jq -r '.next_step // empty')
[ "$AS" = "coach_active" ] && pass "account_state=coach_active" || fail "account_state=$AS (expected coach_active)"
[ "$NS" = "/(tabs)" ] && pass "next_step=/(tabs)" || fail "next_step=$NS"

hdr "T9 — OAuth 409 collision contract (unit-level smoke; full flow needs real Google token)"
# Call /auth/google with a fake token AND matching email — we expect the endpoint to
# either validate the token (fail) or return 409 if our email-collision check runs first.
# Main goal: confirm the endpoint exists and doesn't silently succeed.
G=$(curl -sS -X POST "$API/auth/google" -H 'Content-Type: application/json' \
  -d "{\"idToken\":\"fake.token.${STAMP}\",\"email\":\"$COACH_EMAIL\"}")
G_CODE=$(echo "$G" | jq -r '.code // empty')
G_ERR=$(echo "$G" | jq -r '.error // empty')
# Fake token should fail verification; a successful 409 would mean email-check ran before token verify.
# Either way, the endpoint must NOT silently succeed.
echo "$G_ERR" | grep -qiE "token|google|invalid|verify" && pass "/auth/google rejected fake token: $G_ERR" \
  || fail "/auth/google unexpectedly: $G"
info "Full 409 path with real Google token is covered by server/src/__tests__/oauth-account-linking.test.ts"

hdr "CLEANUP"
# Delete in FK-dependency order
[ -n "${TEAM_ID:-}" ] && psql "$DB" -c "DELETE FROM \"TeamMembership\" WHERE team_id='$TEAM_ID'; DELETE FROM \"Team\" WHERE id='$TEAM_ID';" >/dev/null 2>&1
[ -n "${ORG_ID:-}" ] && psql "$DB" -c "DELETE FROM \"OrganizationMembership\" WHERE organization_id='$ORG_ID'; DELETE FROM \"Organization\" WHERE id='$ORG_ID';" >/dev/null 2>&1
psql "$DB" -c "
  DELETE FROM \"CoachApplication\" WHERE user_id='$COACH_ID';
  DELETE FROM \"Notification\" WHERE user_id='$COACH_ID';
  DELETE FROM \"RefreshToken\" WHERE user_id='$COACH_ID';
  DELETE FROM \"User\" WHERE id='$COACH_ID';
" >/dev/null 2>&1 && pass "test data cleaned" || info "cleanup had issues (non-fatal)"

TEAMS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"Team\";")
ORGS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"Organization\";")
APPS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"CoachApplication\";")
USERS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"User\";")
echo ""
echo "Final DB state: users=$USERS teams=$TEAMS orgs=$ORGS coach_apps=$APPS"

if [ "$FAILED" = "0" ]; then
  echo ""
  echo "🎉 CANONICAL COACH-APPLICATION FLOW VERIFIED"
  echo "   register → basic_info_required → submitted → approved → agreement → final_setup → active"
  exit 0
else
  echo ""
  echo "❌ SOME CHECKS FAILED — review output above"
  exit 1
fi
