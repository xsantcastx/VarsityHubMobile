-- Profile hot-path composite indexes.
--
-- Hand-written on purpose. `prisma migrate diff --to-schema-datamodel` wants to
-- DROP every *_trgm_idx (the trigram search indexes are created by raw-SQL
-- migrations and aren't modelled in schema.prisma), so its generated script is
-- NOT safe to use here. Only the three CREATE INDEX statements below are wanted.
--
-- Additive and reversible: to roll back, DROP the three indexes. `start.sh` runs
-- `prisma migrate deploy` on every Railway deploy, so this applies automatically.
-- Plain (non-CONCURRENT) CREATE INDEX: Prisma wraps each migration in a
-- transaction and CONCURRENTLY cannot run inside one. It takes a SHARE lock that
-- blocks writes to the table while it builds, which is acceptable at the current
-- row counts; if these tables grow large, build them CONCURRENTLY out-of-band
-- first and let this become a no-op via IF NOT EXISTS.

-- Profile posts list + its count: where { author_id, deleted_at: null } order by created_at desc.
-- @@index([author_id]) alone serves neither the deleted_at filter nor the sort.
CREATE INDEX IF NOT EXISTS "Post_author_id_deleted_at_created_at_idx"
  ON "Post"("author_id", "deleted_at", "created_at");

-- Interactions tab: where { user_id } order by created_at desc limit 200.
CREATE INDEX IF NOT EXISTS "PostUpvote_user_id_created_at_idx"
  ON "PostUpvote"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "PostBookmark_user_id_created_at_idx"
  ON "PostBookmark"("user_id", "created_at");
