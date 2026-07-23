-- Refresh-token rotation grace window.
--
-- Additive and reversible. Two nullable columns on RefreshToken so rotation can
-- supersede (mark) the old token instead of hard-deleting it. Existing rows get
-- NULL for both and behave exactly as before (never-rotated). No backfill.
--
-- `start.sh` runs `prisma migrate deploy` on every Railway deploy, so this
-- applies automatically. To roll back: DROP the two columns (no data loss for
-- live sessions — the columns only carry supersede metadata).
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "rotated_at" TIMESTAMP(3);
ALTER TABLE "RefreshToken" ADD COLUMN IF NOT EXISTS "replaced_by_key_id" TEXT;
