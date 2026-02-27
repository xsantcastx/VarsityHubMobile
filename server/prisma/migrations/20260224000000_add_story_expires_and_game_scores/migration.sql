-- Add expires_at to Story (24h expiration)
ALTER TABLE "Story" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);

-- Backfill: set expires_at = created_at + 24 hours for existing stories
UPDATE "Story" SET "expires_at" = "created_at" + INTERVAL '24 hours' WHERE "expires_at" IS NULL;

-- Add game scores and result
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "home_score" INTEGER;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "away_score" INTEGER;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "winner" TEXT;
