-- Add team labels to Game
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "home_team" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "away_team" TEXT;

-- Create TeamChoice enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TeamChoice') THEN
    CREATE TYPE "TeamChoice" AS ENUM ('HOME','AWAY');
  END IF;
END $$;

-- Rename PostVote table to PostUpvote
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PostVote') THEN
    ALTER TABLE "PostVote" RENAME TO "PostUpvote";
  END IF;
END $$;

-- Rename indexes/constraints from PostVote -> PostUpvote
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PostVote_pkey') THEN
    ALTER INDEX "PostVote_pkey" RENAME TO "PostUpvote_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PostVote_post_id_user_id_key') THEN
    ALTER INDEX "PostVote_post_id_user_id_key" RENAME TO "PostUpvote_post_id_user_id_key";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'PostVote_post_id_created_at_idx') THEN
    ALTER INDEX "PostVote_post_id_created_at_idx" RENAME TO "PostUpvote_post_id_created_at_idx";
  END IF;
END $$;

-- Create PostBookmark table
CREATE TABLE IF NOT EXISTS "PostBookmark" (
  "post_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostBookmark_pkey" PRIMARY KEY ("post_id", "user_id"),
  CONSTRAINT "PostBookmark_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PostBookmark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PostBookmark_post_id_created_at_idx" ON "PostBookmark"("post_id", "created_at");

-- Create GameVote table
CREATE TABLE IF NOT EXISTS "GameVote" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "game_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "choice" "TeamChoice" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GameVote_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GameVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GameVote_game_id_user_id_key" UNIQUE ("game_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "GameVote_game_id_created_at_idx" ON "GameVote"("game_id", "created_at");
