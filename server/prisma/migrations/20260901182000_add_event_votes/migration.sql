CREATE TABLE IF NOT EXISTS "EventVote" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "team" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventVote_event_id_user_id_key" ON "EventVote"("event_id", "user_id");
CREATE INDEX IF NOT EXISTS "EventVote_event_id_team_idx" ON "EventVote"("event_id", "team");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventVote_event_id_fkey'
  ) THEN
    ALTER TABLE "EventVote"
    ADD CONSTRAINT "EventVote_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EventVote_user_id_fkey'
  ) THEN
    ALTER TABLE "EventVote"
    ADD CONSTRAINT "EventVote_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
