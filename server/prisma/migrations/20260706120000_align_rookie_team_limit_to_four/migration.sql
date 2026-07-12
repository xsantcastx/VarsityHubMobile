-- Align the persisted User.max_teams metadata with the shared Rookie plan
-- definition (now 4 free teams). Runtime enforcement already uses
-- plan-definitions.json, but the stored column still defaulted to 3 and
-- could drift during downgrade paths.
ALTER TABLE "User"
ALTER COLUMN "max_teams" SET DEFAULT 4;

UPDATE "User"
SET "max_teams" = 4
WHERE "max_teams" = 3
  AND ("plan" = 'rookie' OR "subscription_tier" = 'free');
