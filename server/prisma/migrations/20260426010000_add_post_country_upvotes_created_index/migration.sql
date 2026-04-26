-- Composite index for /highlights queries: filter by country_code,
-- order by upvotes_count desc + created_at desc, then take N.
-- Without this, Postgres scans the country_code bucket and sorts in
-- memory; with 500-row takes and 5+ findMany calls per feed mount,
-- this was the dominant DB cost on feed load.
--
-- CREATE INDEX CONCURRENTLY would be ideal for production to avoid
-- table-level locks, but Prisma migrate does not support it inside
-- a migration transaction. Use a plain CREATE INDEX; the Post table
-- locks for the index-build duration. If contention becomes an
-- issue, run this manually as CONCURRENTLY and mark the migration
-- as applied.
CREATE INDEX "Post_country_code_upvotes_count_created_at_idx"
  ON "Post"("country_code", "upvotes_count", "created_at");
