-- Backfill missing schema objects that current code expects:
-- 1) Story.lat/lng columns + index
-- 2) Poll, PollOption, PollVote tables + constraints/indexes

-- Story location columns (nullable)
ALTER TABLE "Story"
ADD COLUMN IF NOT EXISTS "lat" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "lng" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Story_lat_lng_idx" ON "Story"("lat", "lng");

-- Poll tables
CREATE TABLE IF NOT EXISTS "Poll" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PollOption" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "votes_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PollVote" (
    "id" TEXT NOT NULL,
    "poll_option_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Poll_post_id_key" ON "Poll"("post_id");
CREATE INDEX IF NOT EXISTS "PollOption_poll_id_idx" ON "PollOption"("poll_id");
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_poll_option_id_user_id_key" ON "PollVote"("poll_option_id", "user_id");
CREATE INDEX IF NOT EXISTS "PollVote_user_id_idx" ON "PollVote"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Poll_post_id_fkey'
  ) THEN
    ALTER TABLE "Poll"
    ADD CONSTRAINT "Poll_post_id_fkey"
    FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PollOption_poll_id_fkey'
  ) THEN
    ALTER TABLE "PollOption"
    ADD CONSTRAINT "PollOption_poll_id_fkey"
    FOREIGN KEY ("poll_id") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_poll_option_id_fkey'
  ) THEN
    ALTER TABLE "PollVote"
    ADD CONSTRAINT "PollVote_poll_option_id_fkey"
    FOREIGN KEY ("poll_option_id") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PollVote_user_id_fkey'
  ) THEN
    ALTER TABLE "PollVote"
    ADD CONSTRAINT "PollVote_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
