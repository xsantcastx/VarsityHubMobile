-- Minors / COPPA foundation: canonical DOB column, parental-consent placeholders,
-- and soft-delete markers on User. No behavior change for existing users; the
-- application dual-writes DOB going forward and backfills from preferences here
-- so existing rows aren't left with NULL where data is available.

-- ─────────────────────────────────────────────────────────────
-- 1. Enum type for parental consent state
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "ParentalConsentStatus" AS ENUM ('not_required', 'pending', 'approved', 'denied');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. New columns on "User"
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "date_of_birth"           DATE,
    ADD COLUMN IF NOT EXISTS "dob_set_at"              TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "parent_email"            VARCHAR(320),
    ADD COLUMN IF NOT EXISTS "parental_consent_status" "ParentalConsentStatus" NOT NULL DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS "parental_consent_at"     TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deleted_at"              TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deletion_anonymized"     BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────────────────────
-- 3. Backfill DOB from preferences JSON where it's a valid YYYY-MM-DD string.
--    Rows with missing, malformed, or non-string DOB values are left NULL so
--    they'll be asked for DOB at next sign-in (once the mobile client enforces
--    it); we don't want to fabricate a date.
--    `dob_set_at = created_at` for backfilled rows so the 24h grace window
--    doesn't apply retroactively — existing users' DOB is already locked.
--
--    Per-row PL/pgSQL with EXCEPTION handling so that impossible dates that
--    pass the regex (e.g. 2023-02-30, 2024-04-31) skip gracefully instead of
--    aborting the whole migration.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    rec RECORD;
    skipped_count INT := 0;
    backfilled_count INT := 0;
BEGIN
    FOR rec IN
        SELECT id, preferences->>'dob' AS dob_text, created_at
        FROM "User"
        WHERE preferences ? 'dob'
          AND preferences->>'dob' IS NOT NULL
          AND preferences->>'dob' ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
          AND "date_of_birth" IS NULL
    LOOP
        BEGIN
            UPDATE "User"
            SET "date_of_birth" = to_date(rec.dob_text, 'YYYY-MM-DD'),
                "dob_set_at"    = rec.created_at
            WHERE id = rec.id;
            backfilled_count := backfilled_count + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Skip impossible dates (e.g. 2023-02-30). User keeps NULL DOB and
            -- will be prompted to re-enter at next sign-in.
            skipped_count := skipped_count + 1;
        END;
    END LOOP;
    RAISE NOTICE 'DOB backfill: % rows backfilled, % rows skipped (invalid dates)', backfilled_count, skipped_count;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Indexes — one for the soft-delete cleanup cron, one for consent monitoring
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "User_deleted_at_idx"              ON "User"("deleted_at");
CREATE INDEX IF NOT EXISTS "User_parental_consent_status_idx" ON "User"("parental_consent_status");
