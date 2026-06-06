-- Partial index for highlights queries:
--   WHERE deleted_at IS NULL AND media_url IS NOT NULL AND country_code = X
--   ORDER BY upvotes_count DESC, created_at DESC
-- Postgres can use this index directly for both the nationalTop (top-10 by upvotes)
-- and pool (recent media posts) queries, skipping all rows without media or soft-deleted.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Post_media_country_upvotes_created_partial_idx"
  ON "Post"("country_code", "upvotes_count" DESC, "created_at" DESC)
  WHERE "deleted_at" IS NULL AND "media_url" IS NOT NULL;
