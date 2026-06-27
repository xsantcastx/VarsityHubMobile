-- Link posts directly to events (not only via game_id) so event-only pages
-- (events with no linked game) can associate posts and qualify their authors
-- for the open-ended post-event upload window. Before this, the event<->post
-- relationship ran entirely through game_id, so event-only pages could never
-- store, display, or grace-qualify a post.
--
-- SAFE TO AUTO-DEPLOY: additive, nullable column + SET NULL foreign key + index.
-- No backfill — existing posts keep their game_id linkage and the grace check
-- still matches on game_id, so legacy game-backed events are unaffected.
--
-- ROLLBACK (forward-fix preferred; if needed, in order):
--   DROP INDEX "Post_event_id_created_at_idx";
--   ALTER TABLE "Post" DROP CONSTRAINT "Post_event_id_fkey";
--   ALTER TABLE "Post" DROP COLUMN "event_id";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN "event_id" TEXT;

-- CreateIndex
CREATE INDEX "Post_event_id_created_at_idx" ON "Post"("event_id", "created_at");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
