-- Align the persisted User.max_teams metadata with the shared Rookie plan
-- definition. Runtime enforcement already uses plan-definitions.json, but the
-- stored column still defaulted to 2 and could drift during downgrade paths.
ALTER TABLE "User"
ALTER COLUMN "max_teams" SET DEFAULT 3;

UPDATE "User"
SET "max_teams" = 3
WHERE "max_teams" = 2
  AND ("plan" = 'rookie' OR "subscription_tier" = 'free');
