-- Add team_id and is_pinned to Post for coach team page features
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "team_id" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Post_team_id_idx" ON "Post"("team_id");
CREATE INDEX IF NOT EXISTS "Post_team_id_is_pinned_idx" ON "Post"("team_id", "is_pinned");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_team_id_fkey'
  ) THEN
    ALTER TABLE "Post"
    ADD CONSTRAINT "Post_team_id_fkey"
    FOREIGN KEY ("team_id") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
