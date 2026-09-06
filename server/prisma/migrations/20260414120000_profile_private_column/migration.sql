-- Promote `profile_private` from User.preferences JSON to a first-class
-- Boolean column. Rationale: Prisma's `NOT path equals true` filter on a
-- JSON field silently drops rows where the field is absent (it emits
-- `AND id IS NOT NULL` that nullifies the NOT), which blocked us from
-- pushing the feed privacy check into SQL. A plain Boolean fixes that.

ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "profile_private" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the legacy JSON location. Idempotent so it's safe to rerun.
UPDATE "User"
SET "profile_private" = true
WHERE ("preferences"->>'profile_private')::boolean = true
  AND "profile_private" = false;

-- Index supports the feed's common WHERE clause `profile_private = false`.
CREATE INDEX IF NOT EXISTS "User_profile_private_idx"
    ON "User" ("profile_private");
