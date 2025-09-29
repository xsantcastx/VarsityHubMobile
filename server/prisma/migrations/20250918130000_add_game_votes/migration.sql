-- Adjust GameVote model to use team text column instead of enum choice
ALTER TABLE "GameVote" ADD COLUMN "team" TEXT;
ALTER TABLE "GameVote" ADD COLUMN "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

UPDATE "GameVote"
SET "team" = CASE "choice" WHEN 'HOME' THEN 'A' WHEN 'AWAY' THEN 'B' ELSE NULL END;

ALTER TABLE "GameVote" ALTER COLUMN "team" SET NOT NULL;
ALTER TABLE "GameVote" ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "GameVote" DROP COLUMN "choice";
DROP TYPE IF EXISTS "TeamChoice";

DROP INDEX IF EXISTS "GameVote_game_id_created_at_idx";
CREATE INDEX "GameVote_game_id_team_idx" ON "GameVote"("game_id", "team");

ALTER TABLE "GameVote" ALTER COLUMN "updated_at" DROP DEFAULT;
