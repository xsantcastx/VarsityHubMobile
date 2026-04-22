-- Stream 5 / Migration A:
-- Add canonical billing state columns on User, backfill from preferences JSON,
-- and leave legacy JSON keys in place for the dual-write compatibility window.

-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('rookie', 'veteran', 'legend');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "payment_approved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payment_pending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "pending_plan" "MembershipPlan",
ADD COLUMN "plan" "MembershipPlan" NOT NULL DEFAULT 'rookie';

-- Backfill canonical billing columns from legacy preferences JSON.
WITH billing_source AS (
  SELECT
    u."id",
    CASE
      WHEN lower(coalesce(u."preferences"->>'plan', '')) IN ('legend', 'pro') THEN 'legend'
      WHEN lower(coalesce(u."preferences"->>'plan', '')) IN ('veteran', 'premium') THEN 'veteran'
      WHEN lower(coalesce(u."preferences"->>'plan', '')) IN ('rookie', 'free') THEN 'rookie'
      WHEN lower(coalesce(u."subscription_tier", '')) = 'pro' THEN 'legend'
      WHEN lower(coalesce(u."subscription_tier", '')) = 'premium' THEN 'veteran'
      ELSE 'rookie'
    END::"MembershipPlan" AS plan_value,
    CASE
      WHEN lower(coalesce(u."preferences"->>'pending_plan', '')) IN ('legend', 'pro') THEN 'legend'::"MembershipPlan"
      WHEN lower(coalesce(u."preferences"->>'pending_plan', '')) IN ('veteran', 'premium') THEN 'veteran'::"MembershipPlan"
      WHEN lower(coalesce(u."preferences"->>'pending_plan', '')) IN ('rookie', 'free') THEN 'rookie'::"MembershipPlan"
      ELSE NULL
    END AS pending_plan_value,
    CASE lower(coalesce(u."preferences"->>'payment_pending', ''))
      WHEN 'true' THEN true
      WHEN 'false' THEN false
      ELSE false
    END AS payment_pending_value,
    CASE lower(coalesce(u."preferences"->>'payment_approved', ''))
      WHEN 'true' THEN true
      WHEN 'false' THEN false
      ELSE false
    END AS payment_approved_value
  FROM "User" u
)
UPDATE "User" u
SET
  "plan" = s.plan_value,
  "pending_plan" = s.pending_plan_value,
  "payment_pending" = s.payment_pending_value,
  "payment_approved" = s.payment_approved_value
FROM billing_source s
WHERE u."id" = s."id";

-- CreateIndex
CREATE INDEX "User_plan_idx" ON "User"("plan");
CREATE INDEX "User_pending_plan_idx" ON "User"("pending_plan");
CREATE INDEX "User_payment_pending_idx" ON "User"("payment_pending");
