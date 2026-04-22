-- Add NEEDS_REVIEW to TransactionStatus enum.
-- payments.ts line 2555 (session re-verify failure branch) was writing
-- 'NEEDS_REVIEW' via an `as any` cast, which threw at runtime because the
-- value wasn't in the Postgres enum. This migration makes the value canonical
-- so the code can surface reconciliation candidates without lying about the
-- payment outcome (the prior workaround wrote 'FAILED' even though the
-- underlying payment had succeeded).
ALTER TYPE "TransactionStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
