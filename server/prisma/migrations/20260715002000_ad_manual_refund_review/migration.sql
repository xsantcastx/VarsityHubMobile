-- Terminal payment state for a rejected Apple-IAP-paid ad: the server cannot
-- issue an Apple refund, so it moves out of refund_pending (which the hourly
-- reconcile re-attempts + re-alarms) into a manual-review state. Additive enum
-- value — safe. Audit 2026-07-14 (6c).
ALTER TYPE "AdPaymentStatus" ADD VALUE IF NOT EXISTS 'manual_refund_review';
