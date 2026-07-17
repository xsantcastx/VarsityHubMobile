-- Moderation strike ladder (owner rule 2026-07-16)
--
-- Adds structured report targets so (a) de-dupe is DB-enforced instead of an
-- app-layer read-then-write race and (b) strike counting is an indexed query
-- instead of a LIKE '%...%' scan over a JSON text column.
--
-- Deliberately additive and NULL-defaulted. Historical AbuseReport rows are NOT
-- backfilled: Postgres treats NULLs as distinct in a unique index, so no
-- existing row can collide on the new constraint, and — more importantly — a
-- brand-new automatic sanction system must not retroactively punish anyone the
-- moment it deploys. The ladder starts from zero.
--
-- ROLLBACK: fully reversible and non-destructive to pre-existing data.
--   DROP INDEX "UserWarning_source_type_source_id_key";
--   DROP INDEX "UserWarning_user_id_source_type_idx";
--   ALTER TABLE "UserWarning" DROP COLUMN "source_type", DROP COLUMN "source_id";
--   DROP INDEX "AbuseReport_reporter_id_target_type_target_id_key";
--   DROP INDEX "AbuseReport_target_user_id_idx";
--   DROP INDEX "AbuseReport_target_type_target_id_idx";
--   ALTER TABLE "AbuseReport" DROP COLUMN "target_type", DROP COLUMN "target_id",
--     DROP COLUMN "target_user_id";
-- Dropping these only discards moderation metadata added after this migration;
-- no pre-existing column is touched and no row is deleted.

ALTER TABLE "AbuseReport"
  ADD COLUMN "target_type" TEXT,
  ADD COLUMN "target_id" TEXT,
  ADD COLUMN "target_user_id" TEXT;

-- One report per (reporter, target). The de-dupe guard: without it a single
-- account could stack every rung of the strike ladder alone.
CREATE UNIQUE INDEX "AbuseReport_reporter_id_target_type_target_id_key"
  ON "AbuseReport" ("reporter_id", "target_type", "target_id");

CREATE INDEX "AbuseReport_target_user_id_idx" ON "AbuseReport" ("target_user_id");
CREATE INDEX "AbuseReport_target_type_target_id_idx" ON "AbuseReport" ("target_type", "target_id");

ALTER TABLE "UserWarning"
  ADD COLUMN "source_type" TEXT,
  ADD COLUMN "source_id" TEXT;

-- The ladder's idempotency gate: one piece of content mints at most one strike,
-- ever. Concurrent reports crossing the threshold together race here and the
-- loser becomes a no-op.
CREATE UNIQUE INDEX "UserWarning_source_type_source_id_key"
  ON "UserWarning" ("source_type", "source_id");

CREATE INDEX "UserWarning_user_id_source_type_idx" ON "UserWarning" ("user_id", "source_type");
