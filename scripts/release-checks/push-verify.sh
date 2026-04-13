#!/usr/bin/env bash
#
# Push notification end-to-end verification.
#
# Triggers a real push to a logged-in user's registered device, waits for the
# scheduler's 15-minute receipt-verification window, then prints SQL that
# confirms the ticket resolved cleanly and any DeviceNotRegistered tokens got
# reaped from User.preferences.push_token.
#
# Pre-reqs:
#   1. Install the release build on a real iPhone/Android.
#   2. Sign in once so the device registers an Expo push token on the server.
#   3. Have an admin JWT (or the user's own JWT) and the user id handy.
#
# Usage:
#   API_URL=https://api-production-…up.railway.app \
#   AUTH_JWT=eyJ…          # a valid access token for the recipient
#   RECIPIENT_ID=usr_…     # the user id of the signed-in device owner
#   bash scripts/release-checks/push-verify.sh

set -euo pipefail

API_URL="${API_URL:?API_URL is required}"
: "${AUTH_JWT:?AUTH_JWT is required (a valid access token for the recipient)}"
: "${RECIPIENT_ID:?RECIPIENT_ID is required (user id receiving the push)}"

TARGET="${API_URL%/}"
echo "→ API: ${TARGET}"
echo "→ Recipient: ${RECIPIENT_ID}"
echo

# 1. Register a canary push token server-side so subsequent DMs produce a
#    receipt-trackable push. In practice the recipient should already have a
#    real push_token set; this call only refreshes the cache.
echo "[1/4] Triggering an in-app event that causes a push…"
# We use a self-DM from a second account if RECIPIENT2_JWT is set, otherwise
# we hit the self-notification debug endpoint if one exists. Fall back to a
# generic preferences ping so the scheduler has a ticket to chew on.
CAN_SEND_DM=false
if [[ -n "${RECIPIENT2_JWT:-}" ]]; then CAN_SEND_DM=true; fi

if $CAN_SEND_DM; then
  curl -sS -X POST "${TARGET}/messages" \
    -H "Authorization: Bearer ${RECIPIENT2_JWT}" \
    -H 'Content-Type: application/json' \
    -d "{\"recipient_id\":\"${RECIPIENT_ID}\",\"body\":\"Push canary $(date -u +%s)\"}" \
    | head -c 400
  echo
else
  echo "    (no RECIPIENT2_JWT set — using /notifications/test if available, else skipping send)"
  curl -sS -X POST "${TARGET}/notifications/test" \
    -H "Authorization: Bearer ${AUTH_JWT}" \
    -H 'Content-Type: application/json' \
    -d '{"message":"release-pass push canary"}' | head -c 400 || true
  echo
fi
echo

# 2. Print probe SQL.
echo "[2/4] Immediate check — did sendPushNotificationsAsync record a ticket?"
cat <<SQL

SELECT ticket_id, user_id, status, created_at
FROM "PushTicket"
WHERE user_id = '${RECIPIENT_ID}'
ORDER BY created_at DESC
LIMIT 5;

-- PASS: a row with status='pending' appears within seconds of the send.
-- FAIL (no row): either the send failed, the user had no push_token, or
--                the migration hasn't been applied in prod.
SQL

echo
echo "[3/4] Wait 15 min (scheduler cadence) then re-run this SQL to watch tickets resolve:"
cat <<SQL

SELECT status, error_code, COUNT(*) AS n
FROM "PushTicket"
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY status, error_code
ORDER BY status, error_code;

-- PASS: most tickets flip to status='ok'. DeviceNotRegistered is fine —
--       confirms the dead-token reaper path.
-- FAIL: tickets stuck at 'pending' >30 min old.
SQL

echo
echo "[4/4] If DeviceNotRegistered appeared, confirm token cleanup:"
cat <<SQL

SELECT id, preferences->>'push_token' AS push_token
FROM "User"
WHERE id IN (
  SELECT user_id FROM "PushTicket"
  WHERE error_code = 'DeviceNotRegistered'
    AND resolved_at > NOW() - INTERVAL '1 hour'
);

-- PASS: push_token is NULL or absent.
-- FAIL: dead token still populated — verifyPushReceipts did not reap.
SQL
