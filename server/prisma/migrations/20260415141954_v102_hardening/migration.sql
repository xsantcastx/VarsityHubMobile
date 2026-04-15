-- v1.0.2 hardening migration
-- 1. Track coach/org rejections to enforce 48hr cooldown on re-apply
-- 2. Add Apple IAP transaction id with @unique to close double-process TOCTOU gap

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

ALTER TABLE "TransactionLog"
  ADD COLUMN IF NOT EXISTS "apple_transaction_id" TEXT;

-- Unique index (partial: only enforce when non-null) — prevents double-processing of the same
-- Apple IAP transaction while leaving historical NULLs untouched.
CREATE UNIQUE INDEX IF NOT EXISTS "TransactionLog_apple_transaction_id_key"
  ON "TransactionLog" ("apple_transaction_id")
  WHERE "apple_transaction_id" IS NOT NULL;
