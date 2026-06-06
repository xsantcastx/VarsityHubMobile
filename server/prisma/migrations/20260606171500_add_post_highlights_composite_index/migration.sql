-- Composite index for highlights endpoint: filters on country_code, deleted_at,
-- orders by upvotes_count and created_at. Covers the full WHERE + ORDER BY
-- without a table scan on large Post tables.
CREATE INDEX IF NOT EXISTS "Post_country_code_deleted_at_upvotes_count_created_at_idx"
  ON "Post"("country_code", "deleted_at", "upvotes_count", "created_at");
