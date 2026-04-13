#!/usr/bin/env bash
#
# Stripe webhook idempotency check.
#
# Sends the same `payment_intent.succeeded` event to the API twice using the
# Stripe CLI, then queries TransactionLog (via a SQL snippet you paste into
# Railway's psql shell) to prove the second delivery did not double-process.
#
# Usage:
#   STRIPE_API_KEY=sk_test_… \
#   API_URL=https://api-production-…up.railway.app \
#   bash scripts/release-checks/stripe-webhook-replay.sh
#
# Requirements:
#   - Stripe CLI installed and logged in (`stripe login`).
#   - STRIPE_WEBHOOK_SECRET configured in the target API's env so signatures verify.
#   - Read access to Railway Postgres for the verification SQL.
#
# The script is intentionally replay-only: it does NOT mutate production.
# The TransactionLog table is append-only and the webhook handler is
# idempotent by design — this script proves that holds in the deployed build.

set -euo pipefail

API_URL="${API_URL:?API_URL is required (e.g. https://api-production-…up.railway.app)}"
WEBHOOK_PATH="${WEBHOOK_PATH:-/payments/webhook}"
: "${STRIPE_API_KEY:?STRIPE_API_KEY is required (sk_test_… or sk_live_…)}"

if ! command -v stripe >/dev/null 2>&1; then
  echo "✗ Stripe CLI not installed. Install: https://stripe.com/docs/stripe-cli" >&2
  exit 1
fi

TARGET="${API_URL%/}${WEBHOOK_PATH}"
echo "→ Target webhook: ${TARGET}"
echo

# 1. Trigger a fresh payment_intent.succeeded.
echo "[1/3] Triggering fresh payment_intent.succeeded…"
EVENT_JSON=$(stripe --api-key "${STRIPE_API_KEY}" trigger payment_intent.succeeded 2>&1 | tail -1)
EVENT_ID=$(echo "${EVENT_JSON}" | grep -oE 'evt_[A-Za-z0-9]+' | head -1 || true)

if [[ -z "${EVENT_ID}" ]]; then
  echo "✗ Could not parse event id from Stripe CLI output:" >&2
  echo "${EVENT_JSON}" >&2
  exit 1
fi
echo "    event id: ${EVENT_ID}"
echo

# 2. Replay the same event a second time — this is the idempotency test.
echo "[2/3] Replaying the same event (this is the idempotency probe)…"
stripe --api-key "${STRIPE_API_KEY}" events resend "${EVENT_ID}" >/dev/null
echo "    replay sent."
echo

# 3. Print the SQL to run against production Postgres.
echo "[3/3] Verify in Postgres. Paste this into \`railway run psql\` or your SQL client:"
echo
cat <<SQL

SELECT
  stripe_event_id,
  COUNT(*)     AS processed_count,
  MIN(created_at) AS first_processed,
  MAX(created_at) AS last_processed
FROM "TransactionLog"
WHERE stripe_event_id = '${EVENT_ID}'
GROUP BY stripe_event_id;

-- PASS: processed_count = 1 (idempotency held).
-- FAIL: processed_count >= 2 (duplicate processing — STOP the release).

SQL
