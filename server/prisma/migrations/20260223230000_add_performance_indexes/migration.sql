-- Add performance indexes to reduce full table scans on frequent queries
-- Post: deleted_at + created_at for feed queries filtering soft-deleted posts
-- Post: country_code + upvotes_count for geo-sorted trending queries
-- Event: status for filtering by event status

CREATE INDEX IF NOT EXISTS "Post_deleted_at_created_at_idx" ON "Post"("deleted_at", "created_at");
CREATE INDEX IF NOT EXISTS "Post_country_code_upvotes_count_idx" ON "Post"("country_code", "upvotes_count");
CREATE INDEX IF NOT EXISTS "Event_status_idx" ON "Event"("status");
