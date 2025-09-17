-- Add optional banner and game link to events
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "banner_url" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "game_id" TEXT;

-- Ensure index and FK
CREATE INDEX IF NOT EXISTS "Event_game_id_idx" ON "Event"("game_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_game_id_fkey'
  ) THEN
    ALTER TABLE "Event"
      ADD CONSTRAINT "Event_game_id_fkey"
      FOREIGN KEY ("game_id") REFERENCES "Game"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
