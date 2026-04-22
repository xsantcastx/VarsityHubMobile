-- Stream 3 / Migration A:
-- Add canonical auth/onboarding columns on User, backfill from preferences JSON,
-- and leave legacy JSON keys in place for the dual-write compatibility window.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('fan', 'coach');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "coach_agreement_accepted_at" TIMESTAMP(3),
ADD COLUMN "coach_agreement_version" INTEGER,
ADD COLUMN "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "organization_id" TEXT,
ADD COLUMN "proceeding_as_fan" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'fan';

-- Backfill canonical auth/onboarding columns from legacy preferences JSON.
-- Invalid / orphaned organization ids are dropped to NULL so the FK can be added safely.
WITH auth_source AS (
  SELECT
    u."id",
    CASE
      WHEN lower(coalesce(u."preferences"->>'role', '')) = 'coach' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) IN ('fan', 'supporter') THEN 'fan'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%coach%' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%manager%' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%staff%' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%owner%' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%director%' THEN 'coach'
      WHEN lower(coalesce(u."preferences"->>'role', '')) LIKE '%admin%' THEN 'coach'
      ELSE 'fan'
    END::"UserRole" AS role_value,
    CASE lower(coalesce(u."preferences"->>'onboarding_completed', ''))
      WHEN 'true' THEN true
      WHEN 'false' THEN false
      ELSE false
    END AS onboarding_completed_value,
    CASE
      WHEN coalesce(u."preferences"->>'organization_id', '') = '' THEN NULL
      WHEN EXISTS (
        SELECT 1
        FROM "Organization" o
        WHERE o."id" = u."preferences"->>'organization_id'
      ) THEN u."preferences"->>'organization_id'
      ELSE NULL
    END AS organization_id_value,
    CASE lower(coalesce(u."preferences"->>'proceeding_as_fan', ''))
      WHEN 'true' THEN true
      WHEN 'false' THEN false
      ELSE false
    END AS proceeding_as_fan_value,
    CASE
      WHEN coalesce(u."preferences"->>'coach_agreement_accepted_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
        THEN (u."preferences"->>'coach_agreement_accepted_at')::timestamp(3)
      ELSE NULL
    END AS coach_agreement_accepted_at_value,
    CASE
      WHEN coalesce(u."preferences"->>'coach_agreement_version', '') ~ '^[0-9]+$'
        THEN (u."preferences"->>'coach_agreement_version')::integer
      ELSE NULL
    END AS coach_agreement_version_value
  FROM "User" u
)
UPDATE "User" u
SET
  "role" = s.role_value,
  "onboarding_completed" = s.onboarding_completed_value,
  "organization_id" = s.organization_id_value,
  "proceeding_as_fan" = s.proceeding_as_fan_value,
  "coach_agreement_accepted_at" = s.coach_agreement_accepted_at_value,
  "coach_agreement_version" = s.coach_agreement_version_value
FROM auth_source s
WHERE u."id" = s."id";

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");

-- AddForeignKey
ALTER TABLE "User"
ADD CONSTRAINT "User_organization_id_fkey"
FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
