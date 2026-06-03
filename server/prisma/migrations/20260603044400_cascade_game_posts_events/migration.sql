-- Deleting a game should remove game-scoped feed/event content instead of
-- leaving orphaned posts/events that disappear from game-specific surfaces.
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_game_id_fkey";
ALTER TABLE "Post"
ADD CONSTRAINT "Post_game_id_fkey"
FOREIGN KEY ("game_id") REFERENCES "Game"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_game_id_fkey";
ALTER TABLE "Event"
ADD CONSTRAINT "Event_game_id_fkey"
FOREIGN KEY ("game_id") REFERENCES "Game"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
