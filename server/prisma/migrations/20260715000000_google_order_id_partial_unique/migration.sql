-- Prevent Google Play purchase-token replay across accounts.
--
-- The Google subscription order_id is deterministic — google_purchase:<sha256(token)>
-- (see getGooglePurchaseOrderId) — so two accounts claiming the same purchase
-- token produce the SAME order_id. Without a unique constraint the soft
-- findFirst dedup has a race window (audit 2026-07-14, deferred 4f).
--
-- order_id is a generic column shared by Stripe/Apple/Google rails, so a blanket
-- UNIQUE would be wrong. This is a PARTIAL unique index scoped to Google
-- purchase rows only (matched by the order_id prefix). Idempotent.
--
-- NOTE (rollback / deploy): if a real replay already created duplicate google
-- order_ids, this index creation will fail — dedupe those TransactionLog rows
-- first. Down migration: DROP INDEX "TransactionLog_google_order_id_key".
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionLog_google_order_id_key"
  ON "TransactionLog" ("order_id")
  WHERE "order_id" LIKE 'google_purchase:%';
