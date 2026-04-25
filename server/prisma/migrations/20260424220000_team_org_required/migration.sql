-- Make Team.organization_id NOT NULL and switch the FK to ON DELETE RESTRICT.
--
-- WHY
-- ───
-- The DB column today is `text NULL` with `ON DELETE SET NULL`, so deleting an
-- Organization quietly nulls every Team that pointed at it. The Prisma schema
-- declares `organization_id String` (non-null) with `onDelete: Restrict` —
-- those orphan rows then can't be materialized by the Prisma client and any
-- query that hits them blows up with `Error converting field "organization_id"
-- of expected non-nullable type "String"`. That's why `access-matrix.test.ts`
-- and `api-teams.test.ts` have been red.
--
-- This migration realigns the DB to the schema in three steps:
--   1. SAFETY: refuse to run if more than ORPHAN_THRESHOLD orphan rows exist.
--      Production should be 0 (CLAUDE.md: "Teams MUST have organization_id");
--      a non-zero count signals an unknown code path leaking nulls and we
--      want to investigate before destroying data.
--   2. CLEANUP: delete orphan teams (NULL organization_id). Cascading FKs
--      handle TeamMembership/TeamFollow/TeamInvite/GroupChat; Event/Post
--      team_id is set NULL by their own FK rules.
--   3. CONSTRAIN: ALTER COLUMN NOT NULL + drop SET-NULL FK + re-add as
--      RESTRICT. Future Organization deletes will fail loudly if any Team
--      still points at them, instead of silently leaking nulls.
--
-- ROLLBACK
-- ────────
-- This migration is forward-compatible and can be reverted by hand if needed:
--   ALTER TABLE "Team" ALTER COLUMN "organization_id" DROP NOT NULL;
--   ALTER TABLE "Team" DROP CONSTRAINT "Team_organization_id_fkey";
--   ALTER TABLE "Team" ADD CONSTRAINT "Team_organization_id_fkey"
--     FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
--     ON UPDATE CASCADE ON DELETE SET NULL;
-- (No data restoration — the deleted orphan teams are gone. They were
-- already broken, so this is intentional.)

DO $$
DECLARE
  orphan_count INTEGER;
  -- If there are more than this many orphans, abort and surface a runtime
  -- error so the deploy stops here instead of mass-deleting Team rows.
  -- Pick a sane ceiling that wouldn't be a normal state.
  ORPHAN_THRESHOLD CONSTANT INTEGER := 100;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "Team" WHERE "organization_id" IS NULL;

  IF orphan_count > ORPHAN_THRESHOLD THEN
    RAISE EXCEPTION
      'Refusing to migrate Team.organization_id NOT NULL: % orphan rows found (>%). Investigate the data leak before deleting them. Run: SELECT id, name, status, created_at FROM "Team" WHERE organization_id IS NULL;',
      orphan_count, ORPHAN_THRESHOLD;
  END IF;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'Deleting % orphan Team rows (organization_id IS NULL). Cascading child rows will be removed by their FK rules.', orphan_count;
  END IF;
END $$;

DELETE FROM "Team" WHERE "organization_id" IS NULL;

ALTER TABLE "Team"
  ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "Team"
  DROP CONSTRAINT IF EXISTS "Team_organization_id_fkey";

ALTER TABLE "Team"
  ADD CONSTRAINT "Team_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
